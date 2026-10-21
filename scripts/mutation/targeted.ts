/**
 * Targeted mutants for the e2e assertions the mechanical mutants could not reach (ADR-054).
 *
 * Each mutant breaks one assertion's target behaviour on purpose:
 *  - in the app (src/…), then rebuilt and served; or
 *  - in the test's own input (a page error injected, an accessibility violation added, a download altered).
 *
 * The test must then fail at that assertion's line. The runner applies one patch at a time, runs the
 * one test, restores the file, and records the outcome in reports/mutation-targeted.json.
 *
 * Usage: (npx vite preview --port 4173 &); npx tsx scripts/mutation/targeted.ts [id…]
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

interface Mutant {
  /** Assertion ids (spec:line) this mutant targets. */
  ids: string[];
  claim: string;
  mutant: string;
  file: string;
  patches: { find: string; replace: string }[];
  spec: string;
  grep: string;
  /** The file the failing line is reported in (the spec, or a shared helper). */
  lineFile?: string;
  outcome?: 'killed' | 'hollow' | 'fixed';
  fix?: string;
}

const PAGE_ERROR =
  "await page.evaluate(() => setTimeout(() => { throw new Error('mutant page error'); })); await page.waitForTimeout(300); ";

export const MUTANTS: Mutant[] = JSON.parse(readFileSync('scripts/mutation/targeted.json', 'utf8')).map(
  (m: Mutant) => ({
    ...m,
    patches: m.patches.map((p) => ({ ...p, replace: p.replace.replace('$PAGE_ERROR', PAGE_ERROR) })),
  }),
);

/** [first, last] line of the statement starting at `line` in `file` (multi-line assertions report later lines). */
function span(file: string, line: number): [number, number] {
  const sf = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let best: [number, number] = [line, line];
  const visit = (n: ts.Node): void => {
    if (ts.isExpressionStatement(n) || ts.isArrowFunction(n)) {
      const a = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
      if (a === line) best = [a, Math.max(best[1], sf.getLineAndCharacterOfPosition(n.getEnd()).line + 1)];
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return best;
}

function run(m: Mutant): { outcome: 'killed' | 'hollow'; detail: string } {
  const original = readFileSync(m.file, 'utf8');
  let patched = original;
  for (const p of m.patches) {
    if (!patched.includes(p.find))
      throw new Error(`${m.ids.join(',')}: patch anchor not found in ${m.file}: ${p.find.slice(0, 60)}`);
    patched = patched.replace(p.find, p.replace);
  }
  const app = m.file.startsWith('src/') || m.file.startsWith('public/');
  const lineFile = m.lineFile ?? m.spec;
  const spans = m.ids.map((id) => span(lineFile, Number(id.split(':')[1])));
  writeFileSync(m.file, patched);
  try {
    if (app) execSync('npx vite build', { stdio: 'ignore' });
    const json = `.tmp/targeted-${Date.now()}.json`;
    spawnSync(
      'npx',
      ['playwright', 'test', m.spec, '-g', m.grep, '--project=chromium', '--reporter=json', '--retries=0'],
      {
        env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: json },
        encoding: 'utf8',
        timeout: 900_000,
      },
    );
    const rep = existsSync(json) ? JSON.parse(readFileSync(json, 'utf8')) : { suites: [] };
    rmSync(json, { force: true });
    const lines: number[] = [];
    let status = 'no result';
    let message = '';
    const spec = lineFile.split('/').pop()!;
    const visit = (s: { specs?: unknown[]; suites?: unknown[] }): void => {
      for (const sp of (s.specs ?? []) as {
        tests: {
          results: {
            status: string;
            errors: { message?: string; stack?: string; location?: { line: number } }[];
          }[];
        }[];
      }[])
        for (const t of sp.tests)
          for (const r of t.results) {
            status = r.status;
            for (const e of r.errors ?? []) {
              if (e.location) lines.push(e.location.line);
              for (const x of (e.stack ?? e.message ?? '').matchAll(
                new RegExp(`${spec.replace('.', '\\.')}:(\\d+)`, 'g'),
              ))
                lines.push(Number(x[1]));
              message ||= (e.message ?? '')
                .replace(/\x1b\[[0-9;]*m/g, '')
                .split('\n')[0]
                .slice(0, 140);
            }
          }
      for (const x of (s.suites ?? []) as never[]) visit(x);
    };
    for (const s of rep.suites ?? []) visit(s);
    // A mutant with several ids targets assertions in sequence: it kills the first that fails.
    const killed = status !== 'passed' && lines.some((l) => spans.some(([a, b]) => l >= a && l <= b));
    return {
      outcome: killed ? 'killed' : 'hollow',
      detail: `${status} at ${[...new Set(lines)].join(',')}: ${message}`,
    };
  } finally {
    writeFileSync(m.file, original);
    if (app) execSync('npx vite build', { stdio: 'ignore' });
  }
}

const want = process.argv.slice(2);
const out: Record<string, unknown>[] = existsSync('reports/mutation-targeted.json')
  ? JSON.parse(readFileSync('reports/mutation-targeted.json', 'utf8'))
  : [];
for (const m of MUTANTS) {
  if (want.length && !m.ids.some((id) => want.includes(id))) continue;
  const r = run(m);
  console.log(`${m.ids.join(',')}: ${r.outcome} — ${r.detail}`);
  for (const id of m.ids) {
    const i = out.findIndex((x) => x.id === id);
    const row = {
      id,
      claim: m.claim,
      mutant: m.mutant,
      outcome: m.outcome === 'fixed' && r.outcome === 'killed' ? 'fixed' : r.outcome,
      detail: r.detail,
      ...(m.fix ? { fix: m.fix } : {}),
    };
    if (i >= 0) out[i] = { ...out[i], ...row };
    else out.push(row);
  }
  writeFileSync('reports/mutation-targeted.json', JSON.stringify(out, null, 2) + '\n');
}

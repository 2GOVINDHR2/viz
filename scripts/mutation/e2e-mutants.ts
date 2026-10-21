/**
 * Hollow-assertion audit for the e2e suite (Fix Round 2c, item 3; ADR-054).
 *
 * For every assertion statement in tests/e2e (each `expect(…)` statement, in a test or in a helper), the
 * target behaviour is deliberately broken. The assertion counts as live only if its test then fails *at that
 * assertion*.
 *
 * Two mechanical mutants are generated per assertion:
 *  - **blank:** the page is emptied just before the assertion (`document.body.replaceChildren()`), so
 *    whatever state the assertion reads from the screen is gone;
 *  - **no-action:** the nearest preceding interaction in the same function (click, fill, press, select,
 *    navigation, or a helper that performs one) is removed, so the state the assertion claims to check is
 *    never produced.
 *
 * Line numbers are preserved in every mutant, so a failure is attributed to its line exactly. An assertion
 * that survives both mutants is triaged by hand with a targeted mutant (scripts/mutation/targeted.ts).
 * Assertions on a page that should *lack* something (negative assertions) survive blanking by construction,
 * so for them only the no-action and targeted mutants count.
 *
 * Usage: npm run build; (npx vite preview --port 4173 &); npx tsx scripts/mutation/e2e-mutants.ts [--only file]
 * Writes reports/mutation-e2e.json.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import ts from 'typescript';

const DIR = 'tests/e2e';
const OUT = 'reports/mutation-e2e.json';
const BATCH = Number(process.env.MUT_BATCH ?? 24);
const WORKERS = String(process.env.MUT_WORKERS ?? 4);
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;

const ACTIONS =
  /\.(click|dblclick|fill|press|pressSequentially|type|selectOption|check|uncheck|setChecked|hover|tap|dragTo|setInputFiles|goto|reload|dispatchEvent)\(|\b(openExperiment|scrubTo|reset|detailed|setup|consentAndDemographics|answerAll|runCondition|deeper)\(/;

interface Assertion {
  id: string;
  file: string;
  line: number; // 1-based
  /** Last line of the statement: a multi-line assertion reports its failure on the matcher's line. */
  endLine: number;
  start: number;
  end: number;
  text: string;
  negative: boolean;
  fn: string; // enclosing function: test title or helper name
  inTest: boolean;
  /** [start, end] of the action removed by the no-action mutant, if any. */
  action: [number, number] | null;
  /** The assertion is an arrow function's expression body (blanking must keep it an expression). */
  exprBody?: boolean;
  /** Position of the `test` identifier of the test that exercises it. */
  testAt: { file: string; pos: number; title: string } | null;
}

const isExpect = (n: ts.Node): boolean => {
  let found = false;
  const visit = (x: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(x)) {
      const e = x.expression;
      if (ts.isIdentifier(e) && e.text === 'expect') found = true;
      if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'expect')
        found = true;
    }
    // Do not descend into nested functions: an expect inside a callback belongs to that callback's statements.
    if (ts.isArrowFunction(x) || ts.isFunctionExpression(x)) return;
    ts.forEachChild(x, visit);
  };
  visit(n);
  return found;
};

const testTitle = (call: ts.CallExpression, sf: ts.SourceFile): string | null => {
  const e = call.expression;
  const isTest =
    (ts.isIdentifier(e) && e.text === 'test') ||
    (ts.isPropertyAccessExpression(e) &&
      ts.isIdentifier(e.expression) &&
      e.expression.text === 'test' &&
      e.name.text === 'only');
  if (!isTest || call.arguments.length < 2) return null;
  const a = call.arguments[0];
  return a.getText(sf).slice(1, -1);
};

function collect(file: string, sources: Map<string, ts.SourceFile>): Assertion[] {
  const sf = sources.get(file)!;
  const text = sf.getFullText();
  const out: Assertion[] = [];
  const visitFn = (body: ts.Node, fn: string, inTest: boolean, testAt: Assertion['testAt']): void => {
    const statements: ts.Statement[] = [];
    const walk = (n: ts.Node): void => {
      if (ts.isBlock(n) || ts.isSourceFile(n)) n.statements.forEach((s) => walk(s));
      else if (
        ts.isForStatement(n) ||
        ts.isForOfStatement(n) ||
        ts.isForInStatement(n) ||
        ts.isWhileStatement(n)
      )
        walk(n.statement);
      else if (ts.isIfStatement(n)) {
        walk(n.thenStatement);
        if (n.elseStatement) walk(n.elseStatement);
      } else if (ts.isTryStatement(n)) walk(n.tryBlock);
      else statements.push(n as ts.Statement);
    };
    walk(body);
    for (let k = 0; k < statements.length; k++) {
      const s = statements[k];
      if (!isExpect(s)) continue;
      const t = s.getText(sf);
      // Nearest preceding interaction in the same function.
      let action: [number, number] | null = null;
      for (let j = k - 1; j >= 0; j--) {
        const p = statements[j];
        const pt = p.getText(sf);
        if (isExpect(p)) continue;
        if (ACTIONS.test(pt)) {
          action = [p.getStart(sf), p.getEnd()];
          break;
        }
      }
      const line = sf.getLineAndCharacterOfPosition(s.getStart(sf)).line + 1;
      out.push({
        id: `${basename(file, '.ts')}:${line}`,
        file,
        line,
        endLine: sf.getLineAndCharacterOfPosition(s.getEnd()).line + 1,
        start: s.getStart(sf),
        end: s.getEnd(),
        text: t,
        negative:
          /\.not\.|toBeHidden|toHaveCount\(0\)|toEqual\(\[\]\)|toBeNull\(\)|toBeFalsy|toBe\(false\)/.test(t),
        fn,
        inTest,
        action,
        testAt,
      });
    }
    void text;
  };
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n)) {
      const title = testTitle(n, sf);
      if (title) {
        const cb = n.arguments[n.arguments.length - 1];
        if (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))
          visitFn(cb.body, title, true, { file, pos: n.expression.getStart(sf), title });
        return;
      }
    }
    if (ts.isFunctionDeclaration(n) && n.body) {
      visitFn(n.body, n.name?.text ?? '?', false, null);
      return;
    }
    if (ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations)
        if (d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          const body = d.initializer.body;
          const name = d.name.getText(sf);
          if (ts.isBlock(body)) visitFn(body, name, false, null);
          else if (isExpect(body)) {
            // Expression-bodied helper: the expression is the assertion.
            const line = sf.getLineAndCharacterOfPosition(body.getStart(sf)).line + 1;
            out.push({
              id: `${basename(file, '.ts')}:${line}`,
              file,
              line,
              endLine: sf.getLineAndCharacterOfPosition(body.getEnd()).line + 1,
              start: body.getStart(sf),
              end: body.getEnd(),
              text: body.getText(sf),
              negative: false,
              fn: name,
              inTest: false,
              action: null,
              testAt: null,
              exprBody: true,
            });
          }
        }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** For helper assertions: the first test (in any spec) whose body calls the helper, directly or via another. */
function attachHelpers(all: Assertion[], sources: Map<string, ts.SourceFile>): void {
  const tests: { file: string; pos: number; title: string; body: string }[] = [];
  const helpers = new Map<string, string>(); // name → body text
  for (const [file, sf] of sources) {
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n)) {
        const title = testTitle(n, sf);
        if (title) {
          tests.push({ file, pos: n.expression.getStart(sf), title, body: n.getText(sf) });
          return;
        }
      }
      if (ts.isFunctionDeclaration(n) && n.name && n.body) helpers.set(n.name.text, n.body.getText(sf));
      if (ts.isVariableStatement(n))
        for (const d of n.declarationList.declarations)
          if (d.initializer && ts.isArrowFunction(d.initializer))
            helpers.set(d.name.getText(sf), d.initializer.getText(sf));
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  const calls = (body: string, name: string, seen = new Set<string>()): boolean => {
    if (new RegExp(`\\b${name}\\(`).test(body)) return true;
    for (const [h, hb] of helpers)
      if (!seen.has(h) && new RegExp(`\\b${h}\\(`).test(body)) {
        seen.add(h);
        if (calls(hb, name, seen)) return true;
      }
    return false;
  };
  for (const a of all) {
    if (a.inTest) continue;
    // Prefer a test in the helper's own file.
    const t =
      tests.find((x) => x.file === a.file && !/perf/.test(x.file) && calls(x.body, a.fn)) ??
      tests.find((x) => !/perf/.test(x.file) && calls(x.body, a.fn));
    a.testAt = t ? { file: t.file, pos: t.pos, title: t.title } : null;
  }
}

const BLANK = 'await page.evaluate(() => document.body.replaceChildren()); ';
// An empty statement keeps the syntax valid where the action was the body of an if/else.
const blankOut = (s: string): string => ';' + s.slice(1).replace(/[^\n]/g, ' ');

function mutant(
  a: Assertion,
  kind: 'blank' | 'no-action',
  sources: Map<string, ts.SourceFile>,
): string | null {
  if (!a.testAt) return null;
  const target = a.testAt.file;
  const edits: { at: number; end: number; text: string }[] = [];
  if (kind === 'blank') {
    // The assertion's own long waits are shortened so a blanked page fails fast.
    const shortened = a.text.replace(/timeout: [\d_]+/g, 'timeout: 4000');
    edits.push({
      at: a.start,
      end: a.end,
      text: a.exprBody
        ? `page.evaluate(() => document.body.replaceChildren()).then(() => ${shortened})`
        : // In a block, so a brace-less loop or if body keeps the assertion inside it.
          `{ ${BLANK}${shortened} }`,
    });
  } else {
    if (!a.action) return null;
    const src = sources.get(a.file)!.getFullText();
    edits.push({ at: a.action[0], end: a.action[1], text: blankOut(src.slice(a.action[0], a.action[1])) });
    const shortened = a.text.replace(/timeout: [\d_]+/g, 'timeout: 8000');
    edits.push({ at: a.start, end: a.end, text: shortened });
  }
  // Mark the exercising test `.only` (same file, or a different spec importing the helper).
  const files = new Map<string, { at: number; end: number; text: string }[]>();
  for (const e of edits) files.set(a.file, [...(files.get(a.file) ?? []), e]);
  files.set(target, [
    ...(files.get(target) ?? []),
    { at: a.testAt.pos, end: a.testAt.pos + 4, text: 'test.only' },
  ]);
  if (files.size > 1) return null; // a helper in helpers.ts reached from another file: handled by targeted mutants
  let out = sources.get(target)!.getFullText();
  for (const e of [...files.get(target)!].sort((x, y) => y.at - x.at))
    out = out.slice(0, e.at) + e.text + out.slice(e.end);
  return out;
}

interface Result {
  id: string;
  file: string;
  line: number;
  fn: string;
  negative: boolean;
  text: string;
  blank: 'killed' | 'survived' | 'elsewhere' | 'n/a';
  noAction: 'killed' | 'survived' | 'elsewhere' | 'n/a';
  detail: Record<string, string>;
}

function runBatch(
  jobs: { name: string; a: Assertion; kind: 'blank' | 'no-action' }[],
): Map<string, { status: string; lines: number[]; message: string }> {
  const json = join('.tmp', `mut-${Date.now()}.json`);
  const r = spawnSync(
    'npx',
    [
      'playwright',
      'test',
      ...jobs.map((j) => `${DIR}/${j.name}`),
      '--project=chromium',
      `--workers=${WORKERS}`,
      '--reporter=json',
      '--retries=0',
    ],
    {
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: json },
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      timeout: 3_600_000,
    },
  );
  const out = new Map<string, { status: string; lines: number[]; message: string }>();
  if (!existsSync(json)) {
    console.error(r.stdout?.slice(-2000), r.stderr?.slice(-2000));
    return out;
  }
  const rep = JSON.parse(readFileSync(json, 'utf8'));
  const visit = (suite: { file?: string; specs?: unknown[]; suites?: unknown[] }, file?: string): void => {
    const f = suite.file ?? file;
    for (const spec of (suite.specs ?? []) as {
      tests: {
        results: {
          status: string;
          errors: { message?: string; stack?: string; location?: { line: number } }[];
        }[];
      }[];
    }[])
      for (const t of spec.tests)
        for (const res of t.results) {
          const name = basename(f ?? '');
          const lines: number[] = [];
          let message = '';
          for (const e of res.errors ?? []) {
            if (e.location) lines.push(e.location.line);
            for (const m of (e.stack ?? e.message ?? '').matchAll(
              new RegExp(`${name.replace('.', '\\.')}:(\\d+)`, 'g'),
            ))
              lines.push(Number(m[1]));
            message ||= (e.message ?? '').split('\n')[0].slice(0, 160);
          }
          const prev = out.get(name);
          if (!prev || res.status !== 'passed')
            out.set(name, {
              status: res.status,
              lines: [...(prev?.lines ?? []), ...lines],
              message: message || prev?.message || '',
            });
        }
    for (const s of (suite.suites ?? []) as never[]) visit(s, f);
  };
  for (const s of rep.suites ?? []) visit(s);
  rmSync(json, { force: true });
  return out;
}

function main(): void {
  mkdirSync('.tmp', { recursive: true });
  for (const f of readdirSync(DIR)) if (f.startsWith('zzm-')) rmSync(join(DIR, f));
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.ts') && !f.startsWith('zzm-') && !/^perf/.test(f))
    .filter((f) => !only || f === only || f === 'helpers.ts')
    .map((f) => join(DIR, f));
  const sources = new Map(
    files.map((f) => [f, ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true)]),
  );
  const all = files.flatMap((f) => collect(f, sources));
  attachHelpers(all, sources);
  const resume = process.argv.includes('--resume') && existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')) as Result[]) : [];
  const prior = new Map(resume.map((r) => [r.id, r]));
  const results: Result[] = all.map((a) => prior.get(a.id) ?? ({
    id: a.id,
    file: a.file,
    line: a.line,
    fn: a.fn,
    negative: a.negative,
    text: a.text.replace(/\s+/g, ' ').slice(0, 160),
    blank: 'n/a',
    noAction: 'n/a',
    detail: {},
  }));
  const jobs: { name: string; a: Assertion; kind: 'blank' | 'no-action'; r: Result }[] = [];
  all.forEach((a, k) => {
    for (const kind of ['blank', 'no-action'] as const) {
      const done = results[k].detail[kind];
      const live = results[k].blank === 'killed' || results[k].noAction === 'killed';
      if (done && done !== 'no result' && !(process.argv.includes('--rerun-survivors') && !live)) continue;
      const m = mutant(a, kind, sources);
      if (!m) continue;
      const name = `zzm-${jobs.length}-${kind}-${basename(a.testAt!.file)}`;
      writeFileSync(join(DIR, name), m);
      jobs.push({ name, a, kind, r: results[k] });
    }
  });
  console.log(`${all.length} assertions, ${jobs.length} mutants`);
  for (let i = 0; i < jobs.length; i += BATCH) {
    const batch = jobs.slice(i, i + BATCH);
    const got = runBatch(batch);
    for (const j of batch) {
      const g = got.get(j.name);
      const key = j.kind === 'blank' ? 'blank' : 'noAction';
      const verdict = !g
        ? 'n/a'
        : g.status === 'passed'
          ? 'survived'
          : g.lines.some((l) => l >= j.a.line && l <= j.a.endLine)
            ? 'killed'
            : 'elsewhere';
      j.r[key] = verdict as Result['blank'];
      j.r.detail[j.kind] = g
        ? `${g.status} at ${[...new Set(g.lines)].join(',')}: ${g.message}`
        : 'no result';
      rmSync(join(DIR, j.name), { force: true });
    }
    console.log(`${Math.min(i + BATCH, jobs.length)}/${jobs.length}`);
    writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
  }
  writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
  const live = results.filter((r) => r.blank === 'killed' || r.noAction === 'killed').length;
  console.log(`live ${live} / ${results.length}`);
}

main();

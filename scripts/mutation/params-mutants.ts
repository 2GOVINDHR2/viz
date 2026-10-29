/**
 * Mutation check of invariants F, G and H (Fix Round 3, A6). Each mutant breaks the behaviour one invariant
 * guards, in the application; the invariant's tests must then fail. The runner applies one mutant at a time,
 * runs the invariant's tests, restores the file, and writes reports/mutation-params.json.
 *
 * Usage: npx tsx scripts/mutation/params-mutants.ts
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

interface Mutant {
  invariant: 'F' | 'G' | 'H';
  mutant: string;
  file: string;
  find: string;
  replace: string;
}

const MUTANTS: Mutant[] = [
  {
    invariant: 'F',
    mutant: 'the XOR experiment no longer declares its seed',
    file: 'src/experiments/registry.ts',
    find: "      { kind: 'activation', layer: 0, options: ['tanh', 'sigmoid', 'relu'], more: true },\n      { kind: 'epochs', options: [50, 150, 300], more: true },\n      { kind: 'seed', more: true },",
    replace:
      "      { kind: 'activation', layer: 0, options: ['tanh', 'sigmoid', 'relu'], more: true },\n      { kind: 'epochs', options: [50, 150, 300], more: true },",
  },
  {
    invariant: 'F',
    mutant: 'the workbench hides the "More settings" parameters',
    file: 'src/ui/components/Guide.tsx',
    find: '          {more.map(row)}',
    replace: '          {null}',
  },
  {
    invariant: 'F',
    mutant: 'numeric parameters are drag-only (a range input, no text box)',
    file: 'src/ui/components/ParamField.tsx',
    find: '          type="text"\n          inputMode="decimal"',
    replace: '          type="range"',
  },
  {
    invariant: 'F',
    mutant: 'the backpropagation novice screen drops the typed fields from its settings section',
    file: 'src/ui/novice/Backprop.tsx',
    find: '                {exp.editable.slice(1).map((p, i) => (\n                  <TryItField key={i + 1} param={p} k={i + 1} />\n                ))}',
    replace: '                {null}',
  },
  {
    invariant: 'G',
    mutant: 'a typed example input is ignored',
    file: 'src/experiments/params.ts',
    find: '      xs[p.example][p.feature] = v;',
    replace: '      xs[p.example][p.feature] = xs[p.example][p.feature];',
  },
  {
    invariant: 'G',
    mutant: 'typed numbers are rounded to one decimal place',
    file: 'src/experiments/params.ts',
    find: '  return { ok: true, value: v };\n}',
    replace: '  return { ok: true, value: Math.round(v * 10) / 10 };\n}',
  },
  {
    invariant: 'G',
    mutant: 'the initialisation scale is applied squared',
    file: 'src/experiments/params.ts',
    find: '      return { ...s, config: scaled(s.config, v) };',
    replace: '      return { ...s, config: scaled(s.config, v * v) };',
  },
  {
    invariant: 'G',
    mutant: 'reset keeps typed example values',
    file: 'src/ui/store.ts',
    find: '        JSON.stringify(get().dataset) !== JSON.stringify(e.dataset)',
    replace: '        false',
  },
  {
    invariant: 'H',
    mutant: 'an out-of-range whole number is clamped instead of rejected',
    file: 'src/experiments/params.ts',
    find: '  if (range && !range.accepts(v))\n',
    replace:
      '  if (range && !range.accepts(v) && Number.isInteger(v) && v >= 0)\n    return { ok: true, value: Math.max(1, Math.min(v, 1000)) };\n  if (range && !range.accepts(v))\n',
  },
  {
    invariant: 'H',
    mutant: 'learning rates above 10 are refused',
    file: 'src/experiments/params.ts',
    find: '  if (!range && integerKinds.has(p.kind) && !Number.isInteger(v))',
    replace:
      "  if (p.kind === 'learningRate' && v > 10) return { ok: false, message: 'Enter at most 10.' };\n  if (!range && integerKinds.has(p.kind) && !Number.isInteger(v))",
  },
  {
    invariant: 'H',
    mutant: 'the rejection message does not say what is valid',
    file: 'src/experiments/params.ts',
    find: "        : 'Enter a number, such as 0.3, −2 or 1e-3 (any size is allowed, even one that makes training diverge).',",
    replace: "        : 'Invalid.',",
  },
  {
    invariant: 'H',
    mutant: 'a cross-entropy target outside 0–1 is accepted',
    file: 'src/experiments/params.ts',
    find: "  if (p.kind === 'target' && s.config.loss === 'bce' && (v < 0 || v > 1))",
    replace: "  if (p.kind === 'target' && s.config.loss === 'bce' && v > 100)",
  },
];

const out: Record<string, unknown>[] = [];
for (const m of MUTANTS) {
  const original = readFileSync(m.file, 'utf8');
  if (!original.includes(m.find)) throw new Error(`anchor not found in ${m.file}: ${m.find.slice(0, 60)}`);
  writeFileSync(m.file, original.replace(m.find, m.replace));
  try {
    const r = spawnSync(
      'npx',
      ['vitest', 'run', 'tests/unit/parameters.test.ts', '-t', `^${m.invariant}\\. `],
      { encoding: 'utf8', timeout: 1_800_000 },
    );
    const text = r.stdout + r.stderr;
    const failed = /Tests\s+\d+ failed/.test(text);
    const passed = /Tests\s+(\d+) passed/.exec(text)?.[1];
    const outcome = failed ? 'killed' : 'survived';
    console.log(`${m.invariant}: ${m.mutant}: ${outcome}`);
    out.push({ ...m, outcome, detail: (/Tests\s+[^\n]+/.exec(text)?.[0] ?? '').trim(), passed });
  } finally {
    writeFileSync(m.file, original);
  }
}
writeFileSync(
  'reports/mutation-params.json',
  JSON.stringify(
    out.map(({ invariant, mutant, file, outcome, detail }) => ({ invariant, mutant, file, outcome, detail })),
    null,
    2,
  ) + '\n',
);

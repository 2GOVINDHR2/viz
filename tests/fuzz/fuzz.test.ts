/**
 * Invariant E: for every experiment, FUZZ_RUNS (default 200) seeded random sequences of UI actions, with
 * A–D checked after every action. A failure is written to .tmp/fuzz-failures.json, to be triaged and
 * kept in tests/fuzz/regressions.json (replayed by tests/unit/fuzz-regressions.test.ts).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { EXPERIMENTS } from '../../src/experiments/registry';
import { afterAll, describe, expect, it } from 'vitest';
import { fuzzOnce, stats, type Failure } from '../support/fuzz';
import { freshSource, open, traceHash } from '../support/lab';

const RUNS = Number(process.env.FUZZ_RUNS ?? 200);
const LENGTH = Number(process.env.FUZZ_LENGTH ?? 6);
const failures: Failure[] = [];

// Runs are capped at 3 epochs so 200 sequences fit in CI time; the full-length runs are covered by A–D.
for (const e of EXPERIMENTS) e.config = { ...e.config, epochs: Math.min(e.config.epochs, 3) };

const seedOf = (id: string, run: number): number =>
  [...id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261) ^ run;

afterAll(() => {
  mkdirSync('.tmp', { recursive: true });
  writeFileSync(
    '.tmp/fuzz-stats.json',
    JSON.stringify({ runs: RUNS, length: LENGTH, ...stats, failures: failures.length }, null, 2),
  );
});

describe('E. seeded fuzz of UI actions, A–D after every action', () => {
  for (const e of EXPERIMENTS)
    it(`${e.number} ${e.title}: ${RUNS} sequences of ${LENGTH}`, async () => {
      await open(e.id, 'expert');
      const initial = traceHash(freshSource(e.id, e.config));
      const found: Failure[] = [];
      for (let r = 0; r < RUNS; r++) {
        const f = await fuzzOnce(e.id, seedOf(e.id, r), LENGTH, initial);
        if (f) found.push(f);
      }
      failures.push(...found);
      if (failures.length) {
        mkdirSync('.tmp', { recursive: true });
        writeFileSync('.tmp/fuzz-failures.json', JSON.stringify(failures, null, 2));
      }
      expect(found.map((f) => `seed ${f.seed} @${f.at}: ${f.violations.join('; ')}`)).toEqual([]);
    }, 1_800_000);
});

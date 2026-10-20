/**
 * Replays every failing fuzz sequence kept from invariant E (tests/fuzz/regressions.json), with the same
 * epoch cap as the fuzzer. Each must now pass A–D after every action.
 */
import { describe, expect, it } from 'vitest';
import { EXPERIMENTS, experimentById } from '../../src/experiments/registry';
import { runSequence, type Sequence } from '../support/fuzz';
import { freshSource, open, traceHash } from '../support/lab';
import regressions from '../fuzz/regressions.json';

for (const e of EXPERIMENTS) e.config = { ...e.config, epochs: Math.min(e.config.epochs, 3) };
const cases = regressions as unknown as (Sequence & { found?: string })[];

describe('E. kept fuzz regressions', () => {
  it('the regression file parses', () => expect(Array.isArray(cases)).toBe(true));
  for (const seq of cases)
    it(`${seq.experiment} seed ${seq.seed}${seq.found ? ` (${seq.found})` : ''}`, async () => {
      await open(seq.experiment, seq.mode);
      const initial = traceHash(freshSource(seq.experiment, experimentById(seq.experiment).config));
      const f = await runSequence(seq, initial);
      expect(f?.violations ?? []).toEqual([]);
    }, 240_000);
});

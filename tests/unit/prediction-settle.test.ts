/** Fix Round 6, A3 and A4 (ADR-080, ADR-081): what settles a prediction, as pure functions. */
import { describe, expect, it } from 'vitest';
import { sigmoidScalar } from '../../src/core/tensor/ops';
import { settles, type RunSummary } from '../../src/ui/novice/Guided';
import { biasOutcome } from '../../src/ui/novice/SingleNeuron';

const rows = (zs: number[]) => zs.map((z) => ({ z, a: sigmoidScalar(z) }));

describe('A3. the bias prediction', () => {
  it('a raise settles it "all go up", whatever the sums (the sigmoid only rises)', () => {
    // Outputs at bias 2.5, answered at bias 0: each sum is 2.5 larger than it was.
    expect(biasOutcome(rows([-3.5, 0.5, -4, 2.5]), 0, 2.5)).toBe(0);
    // After training left the sums large and negative, a raise still settles it.
    expect(biasOutcome(rows([-12, -7.4, -6.9, -1.1]), -6.9, -3)).toBe(0);
  });
  it('anything but a raise leaves it unsettled: the same bias, or lower', () => {
    expect(biasOutcome(rows([0, 1, 2, 3]), 0, 0)).toBeNull();
    expect(biasOutcome(rows([0, 1, 2, 3]), 1, 0.5)).toBeNull();
  });
  it('unsettled while an output is not yet known', () => {
    expect(biasOutcome([{ z: null, a: null }], 0, 1)).toBeNull();
    expect(biasOutcome([], 0, 1)).toBeNull();
  });
});

describe('A4. a guided prediction settles at the end of the new run, not when it is generated', () => {
  const current = {
    value: 'tanh',
    firstLoss: 1,
    finalLoss: 0.5,
    finalAccuracy: 1,
    gradRatio: null,
  } as RunSummary;
  const base = { trial: { to: 'tanh' }, staged: null, current, now: 'tanh' as string | number };
  it('generated but not watched: not settled; watched to the end: settled', () => {
    expect(settles({ ...base, reachedEnd: false })).toBe(false);
    expect(settles({ ...base, reachedEnd: true })).toBe(true);
  });
  it('not while the run is generating, another value is staged, or the screen shows another run', () => {
    expect(settles({ ...base, current: null, reachedEnd: true })).toBe(false);
    expect(settles({ ...base, staged: 'relu', reachedEnd: true })).toBe(false);
    expect(settles({ ...base, now: 'sigmoid', reachedEnd: true })).toBe(false);
    expect(settles({ ...base, trial: null, reachedEnd: true })).toBe(false);
  });
});

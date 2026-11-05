/**
 * Fix Round 5, 5.3: experiments 1 to 5 each have a question answerable only after running (afterRun), and its
 * correct option is true of the run the learner is told to watch. Checked against the run itself, so a change of
 * configuration that makes an answer false fails here.
 */
import { describe, expect, it } from 'vitest';
import { epochSummaries, reconstructState } from '../../src/core/npm';
import { EXPERIMENTS, experimentById } from '../../src/experiments/registry';
import { freshSource } from '../support/lab';

const run = (id: string) => {
  const e = experimentById(id);
  const src = freshSource(id, e.config);
  const P = src.header.model.params.length;
  const start = reconstructState(src, P - 1).params;
  const end = reconstructState(src, src.length - 1).params;
  return { e, s: epochSummaries(src), start, end };
};
const first = (p: Record<string, { value: { data: Float64Array } }>, n: string): number => p[n].value.data[0];

describe('5.3 one question per experiment needs the run', () => {
  it('experiments 1 to 5 each have an afterRun question, and it is part of the self-check that unlocks the next', () => {
    for (const e of EXPERIMENTS.slice(0, 5))
      expect(
        e.selfCheck.some((q) => q.afterRun),
        e.id,
      ).toBe(true);
  });

  it('2: the weight ends almost where it started (the sigmoid is saturated)', () => {
    const { start, end, e } = run('activations');
    expect((e.config.model.layers[0] as { activation?: string }).activation).toBe('sigmoid');
    expect(first(start, 'L1.W')).toBe(4);
    expect(Math.abs(first(end, 'L1.W') - 4)).toBeLessThan(0.05);
  });

  it('3: after the last pass the network is less than a tenth as far off as after the first', () => {
    const { s } = run('forward-propagation');
    expect(s.at(-1)!.evalLoss / s[0].evalLoss).toBeLessThan(0.1);
    expect(s[0].evalLoss).toBeCloseTo(0.16, 2);
  });

  it('4: about 97 in every 100 right at the end, up from 90', () => {
    const { s } = run('loss');
    expect(s.at(-1)!.evalAccuracy).toBe(0.975);
    expect(s[0].evalAccuracy).toBe(0.9);
  });

  it('5: with η = 0.3 the line ends near w = 2.0, b = −1.0, from w = −1.5, b = 1.5', () => {
    const { start, end, e } = run('gradient-descent');
    expect(e.config.optimizer.lr).toBe(0.3);
    expect([first(start, 'L1.W'), first(start, 'L1.b')]).toEqual([-1.5, 1.5]);
    expect(Math.abs(first(end, 'L1.W') - 2)).toBeLessThan(0.1);
    expect(Math.abs(first(end, 'L1.b') + 1)).toBeLessThan(0.1);
  });
});

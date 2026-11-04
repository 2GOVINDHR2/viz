/**
 * Fix Round 4, B1: the training-outcome prediction of experiment 1 is not resolved before the run completes.
 * `finalCorrectAt` is what the screen resolves the prediction from (and what it shows the "after" score from);
 * at every cursor of the run it must be null, except at the run's last instructions, after the final evaluation.
 */
import { describe, expect, it } from 'vitest';
import { resolveDataset } from '../../src/core/engine/host';
import { TraceStore, reconstructState, storeSource } from '../../src/core/npm';
import { experimentById } from '../../src/experiments/registry';
import { finalCorrectAt, trainOutcome, TRAIN } from '../../src/ui/novice/SingleNeuron';

describe('B1. the prediction about learning waits for the end of the run', () => {
  const e = experimentById('single-neuron');
  const src = storeSource(TraceStore.generate(e.config, resolveDataset(e.dataset)).store);
  const lastEvalEnd = (() => {
    for (let id = src.length - 1; id >= 0; id--) if (src.get(id).kind === 'EPOCH_END') return id;
    return -1;
  })();

  it('is unresolved at every cursor before the final pass is complete', () => {
    const early: number[] = [];
    for (let c = -1; c < lastEvalEnd; c++) {
      const exec = c < 0 ? null : reconstructState(src, c);
      if (finalCorrectAt(exec, e.config.epochs, 4) !== null) early.push(c);
    }
    expect(early).toEqual([]);
  });

  it('resolves at the end, to the run’s own outcome', () => {
    const end = reconstructState(src, src.length - 1);
    const k = finalCorrectAt(end, e.config.epochs, 4);
    // The default settings learn AND: all four right (claims as in the reveal text).
    expect(k).toBe(4);
    expect(TRAIN.options[trainOutcome(k!)]).toMatch(/all four/);
  });
});

describe('B2. the run-dependent self-check question is true of the run', () => {
  it('sn3: from the starting settings, learning makes w₂ positive, close to w₁, with b near −3.7', () => {
    const e = experimentById('single-neuron');
    const q = e.selfCheck.find((x) => x.id === 'sn3')!;
    expect(q.afterRun).toBe(true);
    expect(q.options.find((o) => o.correct)!.text).toMatch(/positive, close to w₁/);
    const src = storeSource(TraceStore.generate(e.config, resolveDataset(e.dataset)).store);
    const end = reconstructState(src, src.length - 1);
    const [w1, w2] = Array.from(end.params['L1.W'].value.data);
    const b = end.params['L1.b'].value.data[0];
    expect(w2).toBeGreaterThan(0);
    expect(Math.abs(w1 - w2)).toBeLessThan(0.2 * Math.abs(w1));
    // The feedback quotes "about 2.3" and "about −3.7".
    expect(Math.abs(w2 - 2.3)).toBeLessThan(0.1);
    expect(Math.abs(b + 3.7)).toBeLessThan(0.1);
  });
});

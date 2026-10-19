/**
 * The novice screens' observations are read from the trace, not computed:
 * the chain-rule panel's product equals the engine's gradient, and the
 * learning-rate reveal classifies the four rates as the experiment shows them.
 */
import { describe, expect, it } from 'vitest';
import { resolveDataset } from '../../src/core/engine/host';
import { TraceStore, epochSummaries, reconstructState, storeSource } from '../../src/core/npm';
import { applyEdit } from '../../src/experiments/edits';
import { experimentById } from '../../src/experiments/registry';
import { chainOf } from '../../src/ui/novice/Backprop';
import { compareLoss, narrateGradientDescent } from '../../src/ui/novice/GradientDescent';
import { num } from '../../src/explain/format';
import { forwardPasses } from '../../src/ui/novice/trace';

describe('back-propagation: one path through the chain rule', () => {
  const e = experimentById('backpropagation');
  const { store } = TraceStore.generate({ ...e.config, epochs: 1 }, resolveDataset(e.dataset));
  const src = storeSource(store);
  it('factors appear as the backward pass computes them, and their product is the engine’s gradient', () => {
    let checked = 0;
    let sawPending = false;
    for (let c = 0; c < src.length; c++) {
      const exec = reconstructState(src, c);
      for (const w of [
        { layer: 'L1', i: 0, j: 0 },
        { layer: 'L1', i: 1, j: 2 },
        { layer: 'L2', i: 1, j: 0 },
      ]) {
        const { factors, engine } = chainOf(src.header, exec, w);
        if (factors.some((f) => f.value === null)) {
          sawPending = true;
          continue;
        }
        expect(exec.current!.path.sample).not.toBeNull();
        expect(engine).not.toBeNull();
        const product = factors.reduce((p, f) => p * (f.value as number), 1);
        expect(Math.abs(product - (engine as number))).toBeLessThanOrEqual(
          1e-12 * Math.max(1, Math.abs(engine as number)),
        );
        checked++;
      }
    }
    expect(sawPending).toBe(true);
    expect(checked).toBeGreaterThan(100);
  });
});

describe('gradient descent: the learning-rate reveal', () => {
  const e = experimentById('gradient-descent');
  const final = (lr: number) => {
    const { store } = TraceStore.generate(applyEdit(e.config, e.editable[0], lr), resolveDataset(e.dataset));
    const s = epochSummaries(storeSource(store));
    return { first: s[0].evalLoss, last: s.at(-1)!.evalLoss };
  };
  const base = final(0.3);
  it('0.02 ends higher, 0.9 about the same, 1.1 blows up, compared with 0.3', () => {
    expect(compareLoss(base.first, base.last, final(0.02).last)).toBe(2);
    expect(compareLoss(base.first, base.last, final(0.9).last)).toBe(1);
    expect(compareLoss(base.first, base.last, final(1.1).last)).toBe(3);
    const small = final(0.02);
    expect(compareLoss(small.first, small.last, base.last)).toBe(0);
  });
});

describe('gradient descent: a step is narrated with its own numbers (CI11)', () => {
  it('the end of the first batch states the gradient, the change and the new w, as the trace records them', () => {
    const e = experimentById('gradient-descent');
    const { store } = TraceStore.generate({ ...e.config, epochs: 1 }, resolveDataset(e.dataset));
    const src = storeSource(store);
    let end = 0;
    while (src.get(end).kind !== 'BATCH_END') end++;
    const exec = reconstructState(src, end);
    const u = exec.updates['L1.W'];
    const text = narrateGradientDescent(exec, 50);
    expect(u.before!.data[0]).toBe(-1.5);
    expect(text).toContain(`from ${num(-1.5)} to ${num(u.after!.data[0])}`);
    expect(text).toContain(`gradient ${num(u.grad!.data[0])}`);
    expect(u.after!.data[0] - u.before!.data[0]).toBeCloseTo(-0.3 * u.grad!.data[0], 12);
  });
});

describe('single neuron: the outputs table comes from the trace', () => {
  it('reads all four examples of the first batch, in dataset order', () => {
    const e = experimentById('single-neuron');
    const { store } = TraceStore.generate({ ...e.config, epochs: 1 }, resolveDataset(e.dataset));
    const src = storeSource(store);
    const rows = forwardPasses(store.range(0, src.length), 'L1');
    expect(rows.map((r) => r.index)).toEqual([0, 1, 2, 3]);
    // w = (0.5, −0.5), b = 0: z = 0.5·x₁ − 0.5·x₂, output σ(z).
    expect(rows.map((r) => r.z)).toEqual([0, -0.5, 0.5, 0]);
    expect(rows[0].a).toBe(0.5);
  });
});

/**
 * Fix Round 5, 3.2 (ADR-074): each diagnostic question's answer, on real traces, checked against an independent
 * brute-force computation (reconstructed states and epoch summaries, not the query's own code path).
 */
import { describe, expect, it } from 'vitest';
import { epochSummaries, reconstructState } from '../../src/core/npm';
import type { Instruction } from '../../src/core/npm/ir';
import { experimentById } from '../../src/experiments/registry';
import {
  deadRelus,
  firstVanishing,
  largestLossExample,
  lossStoppedDecreasing,
  readersOfMostChanged,
} from '../../src/views/trace/diagnose';
import { setStartingValue } from '../../src/experiments/architecture';
import { freshSource } from '../support/lab';

const all = (id: string, patch: (c: ReturnType<typeof experimentById>['config']) => object = (c) => c) => {
  const e = experimentById(id);
  const src = freshSource(id, patch(e.config) as typeof e.config);
  return { src, ins: src.range(0, src.length) as Instruction[] };
};
const maxAbs = (d: ArrayLike<number>): number => Math.max(...Array.from(d, (v) => Math.abs(v)));

describe('3.2 diagnostic questions', () => {
  it('1. the first weight gradient below a threshold: below it, and none earlier', () => {
    // Deep sigmoid: below 10⁻⁴ from the first batch. XOR, with a threshold half-way through its range of
    // gradient sizes: earlier gradients exist above it, so "none earlier" is a real check.
    const deep = all('vanishing-gradients').ins;
    const xor = all('xor-mlp').ins;
    const sizes = xor
      .filter((i) => i.kind === 'GRAD_ACCUMULATE' && String(i.meta.param).endsWith('.W'))
      .map((i) => maxAbs(i.results.grad.data))
      .sort((p, q) => p - q);
    for (const [ins, t] of [
      [deep, 1e-4],
      [xor, sizes[Math.floor(sizes.length / 2)]],
    ] as const) {
      const hit = firstVanishing(ins, t);
      expect(hit).not.toBeNull();
      expect(maxAbs(hit!.ins.results.grad.data)).toBeLessThan(t);
      for (const i of ins.filter(
        (x) => x.id < hit!.ins.id && x.kind === 'GRAD_ACCUMULATE' && String(x.meta.param).endsWith('.W'),
      ))
        expect(maxAbs(i.results.grad.data)).toBeGreaterThanOrEqual(t);
    }
    expect(firstVanishing(xor, sizes[Math.floor(sizes.length / 2)])!.ins.id).toBeGreaterThan(
      xor.find((i) => i.kind === 'GRAD_ACCUMULATE')!.id,
    );
  });

  it('2. the weight that changed most in an epoch, and every instruction that read it', () => {
    const { src, ins } = all('xor-mlp');
    const epoch = 3;
    const r = readersOfMostChanged(ins, epoch)!;
    expect(r).not.toBeNull();
    // Independently: parameters just before the epoch's first instruction and at its last.
    const a = reconstructState(src, src.header.epochStarts[epoch] - 1).params;
    const b = reconstructState(src, src.header.epochStarts[epoch + 1] - 1).params;
    let best = { d: -1, p: '', k: -1 };
    for (const p of Object.keys(b).filter((n) => n.endsWith('.W')))
      b[p].value.data.forEach((v, k) => {
        const d = Math.abs(v - a[p].value.data[k]);
        if (d > best.d) best = { d, p, k };
      });
    expect([r.param, r.element]).toEqual([best.p, best.k]);
    expect(Math.abs(r.after - r.before)).toBe(best.d);
    // Every reader is in the epoch and reads a version of that parameter; and none is missed.
    const isVersion = (ref: number): boolean => {
      const p = src.get(ref);
      return (p.kind === 'APPLY_UPDATE' || p.kind === 'INIT_PARAM') && p.meta.param === r.param;
    };
    const expected = ins
      .filter((i) => i.path.epoch === epoch && i.operands.some((o) => isVersion(o.ref)))
      .map((i) => i.id);
    expect(r.readers).toEqual(expected);
    expect(r.readers.length).toBeGreaterThan(0);
  });

  it('3. the largest-loss example of an epoch, and its forward pass', () => {
    const { src, ins } = all('forward-propagation');
    const r = largestLossExample(ins, 2)!;
    const losses = ins
      .filter((i) => i.kind === 'COMPUTE_LOSS' && i.path.epoch === 2)
      .map((i) => i.results.loss.data[0]);
    expect(r.loss).toBe(Math.max(...losses));
    expect(reconstructState(src, r.lossAt).sample!.datasetIndex).toBe(r.datasetIndex);
    const kinds = r.forward.map((id) => src.get(id).kind);
    expect(kinds[0]).toBe('LOAD_INPUT');
    expect(kinds.at(-1)).toBe('COMPUTE_LOSS');
    expect(kinds).toContain('MATMUL');
  });

  it('4. ReLU neurons that went inactive and never recovered: no later positive response', () => {
    // None of 36 ReLU configurations searched (three experiments, four learning rates, three seeds) kills a unit
    // on its own, so one is made dead: hidden neuron 1 starts with a bias of −50 (Fix Round 5 finding).
    const e = experimentById('xor-mlp');
    const relu = {
      ...e.config,
      model: {
        ...e.config.model,
        layers: e.config.model.layers.map((l, k, a) =>
          k < a.length - 1 ? { ...l, activation: 'relu' as const } : l,
        ),
      },
    };
    const first = freshSource('xor-mlp', relu);
    const b0 = Array.from(
      reconstructState(first, first.header.model.params.length - 1).params['L1.b'].value.data,
    );
    const src = freshSource('xor-mlp', setStartingValue(relu, 'L1.b', b0, 0, -50));
    const ins = src.range(0, src.length) as Instruction[];
    const dead = deadRelus(ins);
    expect(dead.length).toBeGreaterThan(0);
    expect(dead.some((d) => d.layer === 'L1' && d.unit === 0)).toBe(true);
    for (const d of dead) {
      const later = ins.filter(
        (i) =>
          i.id >= d.inactiveFrom &&
          i.kind === 'ACTIVATE' &&
          i.path.layer === d.layer &&
          i.path.phase === 'forward',
      );
      expect(later.length).toBeGreaterThan(0);
      for (const i of later) expect(i.results.out.data[d.unit]).toBeLessThanOrEqual(0);
      if (d.lastActive !== null) {
        const last = ins[d.lastActive];
        expect(last.results.out.data[d.unit]).toBeGreaterThan(0);
      }
    }
  });

  it('5. where the loss stopped decreasing: no later epoch goes lower; null when it never stopped', () => {
    const lr = all('lr-pathology', (c) => ({ ...c, optimizer: { ...c.optimizer, lr: 1.1 } }));
    const sums = epochSummaries(lr.src).map((e) => e.evalLoss);
    const r = lossStoppedDecreasing(lr.ins);
    const k = sums.indexOf(Math.min(...sums));
    if (k === sums.length - 1) expect(r).toBeNull();
    else {
      expect(r!.epoch).toBe(k);
      expect(r!.loss).toBe(sums[k]);
      for (const v of sums.slice(k + 1)) expect(v).toBeGreaterThanOrEqual(r!.loss);
    }
    // A run that keeps improving to its last pass: null.
    const good = all('single-neuron');
    const s2 = epochSummaries(good.src).map((e) => e.evalLoss);
    expect(lossStoppedDecreasing(good.ins) === null).toBe(s2.indexOf(Math.min(...s2)) === s2.length - 1);
  });
});

import { describe, expect, it } from 'vitest';
import * as D from '../../src/core/engine/datasets';
import type { TrainConfig } from '../../src/core/engine/session';
import {
  BEFORE_START,
  GRANULARITIES,
  TraceStore,
  firstBreak,
  memorySource,
  reconstructState,
  runToBreakpoint,
  stepBackward,
  stepForward,
  storeSource,
  traceStatistics,
  unitKey,
  type ExecState,
  type TraceSource,
} from '../../src/core/npm';
import { architectureTraces } from '../support/traces';

const traces = architectureTraces(2);

/** Canonical JSON of a state, with tensors as plain arrays, for exact comparison. */
function canon(s: ExecState): string {
  return JSON.stringify(s, (_k, v) =>
    v && typeof v === 'object' && 'data' in v && 'shape' in v
      ? { shape: v.shape, data: Array.from(v.data as Float64Array) }
      : v,
  );
}

function walkAll(src: TraceSource, g: (typeof GRANULARITIES)[number]): number[] {
  const out: number[] = [];
  let c = BEFORE_START;
  for (;;) {
    const n = stepForward(src, c, g);
    if (n === c) break;
    out.push(n);
    c = n;
  }
  return out;
}

describe('execution engine: granularity navigation', () => {
  for (const t of traces.slice(0, 7)) {
    describe(t.id, () => {
      const store = storeSource(t.store);
      const mem = memorySource(t.store.toTrace());
      const stats = traceStatistics(t.store.toTrace().instructions);

      for (const g of GRANULARITIES) {
        it(`${g}: one forward step per unit, landing on unit ends; backward steps retrace exactly`, () => {
          const fwd = walkAll(store, g);
          expect(fwd.length).toBe(stats.unitsPerGranularity[g]);
          expect(fwd.at(-1)).toBe(store.length - 1);
          for (const c of fwd)
            if (c + 1 < store.length) expect(unitKey(store.get(c + 1), g)).not.toBe(unitKey(store.get(c), g));
          expect(walkAll(mem, g)).toEqual(fwd);
          const back: number[] = [];
          let c = fwd.at(-1)!;
          while (c !== BEFORE_START) back.push((c = stepBackward(store, c, g)));
          expect(back).toEqual([...fwd.slice(0, -1)].reverse().concat(BEFORE_START));
        });
      }

      it('a step from mid-unit completes the current unit first', () => {
        const layerEnds = walkAll(store, 'layer');
        const target = layerEnds.find((c, k) => k > 3 && c - layerEnds[k - 1] > 2)!;
        const mid = target - 1;
        expect(stepForward(store, mid, 'layer')).toBe(target);
      });
    });
  }
});

describe('execution engine: time travel by checkpoint + recomputation', () => {
  it('state reconstructed after stepping back through evicted segments is identical to the full-trace state', () => {
    const t = traces.find((x) => x.id === 'cnn')!;
    const { store } = TraceStore.generate(t.config, t.data, { budgetBytes: 30_000 });
    const tight = storeSource(store);
    const full = memorySource(t.store.toTrace());
    // Run to the end, then walk back sample by sample and compare every state.
    let c = tight.length - 1;
    let compared = 0;
    while (c !== BEFORE_START) {
      expect(canon(reconstructState(tight, c))).toBe(canon(reconstructState(full, c)));
      compared++;
      c = stepBackward(tight, c, 'sample');
    }
    expect(compared).toBeGreaterThan(20);
    expect(store.stats().regenerations).toBeGreaterThan(0);
  });

  it('state is a deterministic function of the cursor (forward then back reproduces it)', () => {
    const src = storeSource(traces[2].store);
    const forwardStates = new Map<number, string>();
    let c = BEFORE_START;
    for (let k = 0; k < 40; k++) {
      c = stepForward(src, c, 'operation');
      forwardStates.set(c, canon(reconstructState(src, c)));
    }
    for (let k = 0; k < 39; k++) {
      c = stepBackward(src, c, 'operation');
      expect(canon(reconstructState(src, c))).toBe(forwardStates.get(c));
    }
  });

  it('reconstructs the textbook quantities: a = f(z), z = u + b, and parameters change exactly at APPLY_UPDATE', () => {
    const src = storeSource(traces[2].store);
    const firstUpdate = src.range(0, src.length).find((i) => i.kind === 'APPLY_UPDATE')!;
    const before = reconstructState(src, firstUpdate.id - 1);
    const after = reconstructState(src, firstUpdate.id);
    const p = String(firstUpdate.meta.param);
    expect(after.params[p].producedBy).toBe(firstUpdate.id);
    expect(before.params[p].producedBy).not.toBe(firstUpdate.id);
    const fwdEnd = src.range(0, src.length).find((i) => i.kind === 'COMPUTE_LOSS')!.id;
    const s = reconstructState(src, fwdEnd).sample!;
    const L1 = s.layers.L1;
    L1.a!.data.forEach((v, i) => expect(v).toBeCloseTo(Math.tanh(L1.z!.data[i]), 14));
  });
});

describe('execution engine: breakpoints', () => {
  const xor = traces.find((t) => t.id === 'mlp-xor')!;
  const src = storeSource(xor.store);

  it('stops at an instruction kind and at a layer', () => {
    const r = runToBreakpoint(src, BEFORE_START, [{ type: 'kind', kinds: ['GRAD_INIT'] }]);
    expect(src.get(r.cursor).kind).toBe('GRAD_INIT');
    const l = runToBreakpoint(src, r.cursor, [{ type: 'layer', layer: 'L1' }]);
    expect(src.get(l.cursor).path.layer).toBe('L1');
  });

  it('stops at the start of a given epoch', () => {
    const r = runToBreakpoint(src, BEFORE_START, [{ type: 'epoch', epoch: 1 }]);
    expect(src.get(r.cursor).kind).toBe('EPOCH_BEGIN');
    expect(src.get(r.cursor).path.epoch).toBe(1);
  });

  it('catches NaN/∞ as a teachable event when the learning rate is absurd', () => {
    const cfg: TrainConfig = { ...xor.config, optimizer: { type: 'sgd', lr: 1e200 }, epochs: 6 };
    const s = storeSource(TraceStore.generate(cfg, D.xor()).store);
    const r = runToBreakpoint(s, BEFORE_START, [{ type: 'nonFinite' }]);
    expect(r.hit).not.toBeNull();
    expect(r.hit!.reason).toMatch(/non-finite/);
  });

  it('flags vanishing gradients in a deep sigmoid stack and not in a shallow tanh net', () => {
    const deep = traces.find((t) => t.id === 'deep-sigmoid')!;
    const ds = storeSource(deep.store);
    const hit = firstBreak(ds, BEFORE_START, ds.length - 1, [
      { type: 'gradBelow', threshold: 1e-3, param: 'L1.W' },
    ]);
    expect(hit).not.toBeNull();
    expect(
      firstBreak(src, BEFORE_START, src.length - 1, [{ type: 'gradBelow', threshold: 1e-6, param: 'L1.W' }]),
    ).toBeNull();
  });

  it('flags large gradients, weight sign changes and loss plateaus', () => {
    expect(
      firstBreak(src, BEFORE_START, src.length - 1, [{ type: 'gradAbove', threshold: 1e-3 }]),
    ).not.toBeNull();
    expect(firstBreak(src, BEFORE_START, src.length - 1, [{ type: 'gradAbove', threshold: 1e6 }])).toBeNull();
    const sign = firstBreak(src, BEFORE_START, src.length - 1, [{ type: 'weightSignChange' }]);
    if (sign) expect(src.get(sign.id).kind).toBe('APPLY_UPDATE');
    const cfg: TrainConfig = { ...xor.config, optimizer: { type: 'sgd', lr: 1e-9 }, epochs: 3 };
    const flat = storeSource(TraceStore.generate(cfg, D.xor()).store);
    const plateau = firstBreak(flat, BEFORE_START, flat.length - 1, [
      { type: 'lossPlateau', minImprovement: 1e-6 },
    ]);
    expect(plateau && flat.get(plateau.id).kind).toBe('EPOCH_END');
  });
});

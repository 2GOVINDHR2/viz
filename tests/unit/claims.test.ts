/**
 * Every narration string that asserts what a run does is checked against the run (Fix Round 2c, item 1).
 * The audit and its count are in docs/NARRATION-AUDIT.md. A string that states a definition, gives an
 * instruction or describes the interface makes no claim about a run and is not tested here; the
 * interface claims are covered by the e2e control audit.
 */
import { describe, expect, it } from 'vitest';
import { registerAsset, resolveDataset } from '../../src/core/engine/host';
import { lrVerdict, type ComparedRun } from '../../src/core/engine/protocol';
import { TrainingSession, type EpochRecord, type TrainConfig } from '../../src/core/engine/session';
import { runToBreakpoint, stepForward, storeSource, TraceStore, type TraceSource } from '../../src/core/npm';
import { activeBreakpoints, type BreakpointToggles } from '../../src/ui/store';
import { reconstructState } from '../../src/core/npm/state';
import { loadMnist } from '../../src/experiments/data/mnist';
import { applyEdit } from '../../src/experiments/edits';
import { EXPERIMENTS, experimentById } from '../../src/experiments/registry';

registerAsset('mnist-012', loadMnist);

const trace = (id: string, config?: TrainConfig): TraceSource =>
  storeSource(
    TraceStore.generate(config ?? experimentById(id).config, resolveDataset(experimentById(id).dataset))
      .store,
  );
const firstOf = (src: TraceSource, kind: string, from = 0): number => {
  for (let c = from; c < src.length; c++) if (src.get(c).kind === kind) return c;
  return -1;
};
function train(
  id: string,
  config?: TrainConfig,
): { s: TrainingSession; r: EpochRecord[]; params: number[][] } {
  const s = new TrainingSession(
    config ?? experimentById(id).config,
    resolveDataset(experimentById(id).dataset),
  );
  const r: EpochRecord[] = [];
  const params: number[][] = [];
  while (!s.done) {
    r.push(s.runEpoch());
    params.push([...s.parameters().values()].flatMap((t) => Array.from(t.data)));
    if (!Number.isFinite(r.at(-1)!.eval.loss)) break;
  }
  return { s, r, params };
}
const sigmoid = (z: number): number => 1 / (1 + Math.exp(-z));
const withLr = (id: string, lr: number): TrainConfig => {
  const e = experimentById(id);
  return { ...e.config, optimizer: { ...e.config.optimizer, lr } };
};
/** Fraction of consecutive changes of a sequence that reverse direction. */
const reversals = (xs: number[]): number => {
  const d = xs.slice(1).map((x, k) => x - xs[k]);
  return d.slice(1).filter((x, k) => Math.sign(x) !== Math.sign(d[k])).length / (d.length - 1);
};
const monotoneDown = (xs: number[]): boolean => xs.every((x, k) => k === 0 || x < xs[k - 1]);

describe('1 single neuron', () => {
  it('W2–W3: from the first example, one step is MATMUL, then ADD_BIAS and ACTIVATE; the output is in (0, 1)', () => {
    const src = trace('single-neuron');
    const c = firstOf(src, 'LOAD_INPUT');
    expect([1, 2, 3].map((k) => src.get(c + k).kind)).toEqual(['MATMUL', 'ADD_BIAS', 'ACTIVATE']);
    const a = reconstructState(src, c + 3).sample!.layers.L1.a!.data[0];
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(1);
  });
  it('W5: training ends with an output above 0.5 only for (1, 1) — the AND function', () => {
    const { s } = train('single-neuron');
    const [w1, w2] = Array.from(s.parameters().get('L1.W')!.data);
    const b = s.parameters().get('L1.b')!.data[0];
    const out = [
      [0, 0],
      [0, 1],
      [1, 0],
      [1, 1],
    ].map(([x1, x2]) => sigmoid(w1 * x1 + w2 * x2 + b));
    expect(out.map((o) => o > 0.5)).toEqual([false, false, false, true]);
  });
  it('novice "let it learn": the neuron goes over the four examples 60 times', () =>
    expect(experimentById('single-neuron').config.epochs).toBe(60));
});

describe('2 activation functions', () => {
  it('W2/intro: with w = 4 the first example has x = −4, z = −16, and the sigmoid slope is almost 0', () => {
    const src = trace('activations');
    const c = firstOf(src, 'ACTIVATE');
    const s = reconstructState(src, c).sample!;
    expect(s.x.data[0]).toBe(-4);
    expect(s.layers.L1.z!.data[0]).toBe(-16);
    const a = sigmoid(-16);
    expect(a * (1 - a)).toBeLessThan(1e-6);
  });
  it('W3: with ReLU the slope at z < 0 is exactly 0', () => {
    const e = experimentById('activations');
    const src = trace(e.id, applyEdit(e.config, e.editable[0], 'relu'));
    const c = firstOf(src, 'GRAD_ACTIVATE');
    const s = reconstructState(src, c).sample!;
    expect(s.layers.L1.z!.data[0]).toBeLessThan(0);
    expect(s.layers.L1.gradZ!.data[0]).toBe(0);
  });
  it('W4: with w = 0.5, z stays near 0 and the gradient reaching the weight is larger', () => {
    const e = experimentById('activations');
    const grad = (cfg: TrainConfig): { z: number; g: number } => {
      const src = trace(e.id, cfg);
      const s = reconstructState(src, firstOf(src, 'GRAD_MATMUL_W')).sample!;
      return { z: s.layers.L1.z!.data[0], g: Math.abs(s.layers.L1.gradW!.data[0]) };
    };
    const big = grad(e.config);
    const small = grad(applyEdit(e.config, e.editable[1], 0.5));
    expect(Math.abs(small.z)).toBeLessThanOrEqual(2);
    expect(small.g).toBeGreaterThan(big.g * 100);
  });
});

describe('3 forward propagation', () => {
  it('W1: the step size starts at "layer"', () =>
    expect(experimentById('forward-propagation').defaultGranularity).toBe('layer'));
  it('W2/W4: from the loaded example, one layer step computes all of layer 1, the next all of layer 2', () => {
    const src = trace('forward-propagation');
    const c = firstOf(src, 'LOAD_INPUT');
    const c1 = stepForward(src, c, 'layer');
    const s1 = reconstructState(src, c1).sample!;
    expect(s1.layers.L1.a!.size).toBe(3);
    expect(s1.layers.L2?.a).toBeUndefined();
    const s2 = reconstructState(src, stepForward(src, c1, 'layer')).sample!;
    expect(s2.layers.L2.a!.size).toBe(1);
  });
});

describe('4 loss functions', () => {
  it('W2: squared error of a prediction in [0, 1] against a 0/1 target is at most 1; cross-entropy is unbounded', () => {
    for (const p of [0, 0.001, 0.5, 0.999, 1])
      for (const y of [0, 1]) expect((p - y) ** 2).toBeLessThanOrEqual(1);
    expect(-Math.log(1e-12)).toBeGreaterThan(20);
  });
  it('W3: cross-entropy’s slope is steeper for a confident mistake than for a mild one', () => {
    const slope = (p: number, y: number): number => Math.abs(-(y / p) + (1 - y) / (1 - p));
    expect(slope(0.99, 0)).toBeGreaterThan(slope(0.6, 0) * 10);
  });
});

describe('5 gradient descent', () => {
  it('W1: a batch is all 50 points, and the parameters change once per batch', () => {
    const e = experimentById('gradient-descent');
    expect(e.config.batchSize).toBe(50);
    expect(e.dataset).toMatchObject({ n: 50 });
  });
  it('W2: at η = 0.3 every step goes downhill (the loss falls every epoch)', () =>
    expect(monotoneDown(train('gradient-descent').r.map((x) => x.eval.loss))).toBe(true));
  it('W4 and the novice reveal: at η = 0.9 the path zig-zags across the valley (b reverses on most steps) but converges', () => {
    const { r, params } = train('gradient-descent', withLr('gradient-descent', 0.9));
    expect(reversals(params.map((p) => p[1]).slice(0, 15))).toBeGreaterThan(0.6);
    expect(r.at(-1)!.eval.loss).toBeLessThan(0.05);
  });
});

describe('6 back-propagation', () => {
  it('W1–W4: GRAD_INIT, then GRAD_ACTIVATE, the two layer-2 gradients, then GRAD_MATMUL_X', () => {
    const src = trace('backpropagation');
    const c = firstOf(src, 'GRAD_INIT');
    expect(src.get(c + 1).kind).toBe('GRAD_ACTIVATE');
    expect([src.get(c + 2).kind, src.get(c + 3).kind].sort()).toEqual(['GRAD_BIAS', 'GRAD_MATMUL_W']);
    expect(src.get(c + 4).kind).toBe('GRAD_MATMUL_X');
    expect(src.get(c + 1).path.layer).toBe('L2');
  });
});

describe('7 XOR', () => {
  it('W1: no single neuron learns XOR', () => {
    const e = experimentById('xor-mlp');
    const cfg: TrainConfig = {
      ...e.config,
      model: { ...e.config.model, layers: [e.config.model.layers[1]] },
    };
    expect(train(e.id, cfg).r.at(-1)!.eval.accuracy).toBeLessThan(1);
  });
  it('W2: after a slow start (75 % for the first epochs), by epoch 40 the boundary separates XOR', () => {
    const { r } = train('xor-mlp');
    expect(r.slice(0, 10).every((x) => (x.eval.accuracy ?? 0) < 1)).toBe(true);
    expect(r[39].eval.accuracy).toBe(1);
  });
  it('intro: the recorded sweep — with 4 hidden units 20 of 20 starts solve XOR within 100 epochs; with 2, 9 of 20 within 400', () => {
    const e = experimentById('xor-mlp');
    const solved = (hidden: number, epochs: number): number => {
      let n = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const cfg: TrainConfig = {
          ...e.config,
          seed,
          epochs,
          model: {
            ...e.config.model,
            layers: [{ type: 'dense', units: hidden, activation: 'tanh' }, e.config.model.layers[1]],
          },
        };
        if (train(e.id, cfg).r.some((x) => x.eval.accuracy === 1 && x.eval.loss < 0.1)) n++;
      }
      return n;
    };
    expect(solved(4, 100)).toBe(20);
    expect(solved(2, 400)).toBe(9);
  });
});

describe('8 CNN', () => {
  it('intro/W4/W5: 3×3 kernels on 28×28 give 26×26 = 676 positions; pooling halves each side; 300 test digits', () => {
    const src = trace('cnn-mnist', { ...experimentById('cnn-mnist').config, epochs: 1 });
    const [conv, pool] = src.header.model.layers;
    expect(conv.outShape.slice(1)).toEqual([26, 26]);
    expect(pool.outShape.slice(1)).toEqual([13, 13]);
    expect(resolveDataset(experimentById('cnn-mnist').dataset).test!.xs.shape[0]).toBe(300);
  });
});

describe('D1 vanishing gradients', () => {
  const e = experimentById('vanishing-gradients');
  const ratios = (cfg: TrainConfig): number[] =>
    train(e.id, cfg).r.map((x) => x.gradNorms[0] / x.gradNorms[x.gradNorms.length - 2]);
  it('intro/W2: with sigmoid, layer 1’s gradient is tens of thousands of times smaller than the output layer’s', () =>
    expect(Math.max(...ratios(e.config))).toBeLessThan(1e-4));
  it('W3: with ReLU the rows are of similar shade (within a factor of 10 at every epoch)', () => {
    for (const r of ratios(applyEdit(e.config, e.editable[0], 'relu'))) {
      expect(r).toBeGreaterThan(0.1);
      expect(r).toBeLessThan(10);
    }
  });
  it('W1: the vanishing breakpoint is on, and running to it stops at a vanishing layer', () => {
    expect(e.suggestedBreakpoints).toContain('vanishing');
    const toggles = Object.fromEntries(
      ['nonFinite', 'vanishing', 'exploding', 'deadRelu', 'lossIncrease', 'lossPlateau', 'gradInit'].map(
        (k) => [k, e.suggestedBreakpoints.includes(k as never)],
      ),
    ) as unknown as BreakpointToggles;
    const hit = runToBreakpoint(trace(e.id, { ...e.config, epochs: 1 }), -1, activeBreakpoints(toggles));
    expect(hit.hit?.reason ?? JSON.stringify(hit.hit)).toMatch(/below|vanish/);
  });
});

describe('D2 learning-rate pathology', () => {
  const e = experimentById('lr-pathology');
  const runs = Object.fromEntries([0.02, 0.3, 0.95, 1.1].map((lr) => [lr, train(e.id, withLr(e.id, lr))]));
  const losses = (lr: number): number[] => runs[lr].r.map((x) => x.eval.loss);
  it('intro: the same problem and starting point as experiment 5', () => {
    const g = experimentById('gradient-descent');
    expect(e.dataset).toEqual(g.dataset);
    expect(e.config.initialParams).toEqual(g.config.initialParams);
  });
  it('W1: at 0.02 the loss falls slowly and is far from done; at 0.3 it falls fast and smoothly', () => {
    expect(monotoneDown(losses(0.02))).toBe(true);
    expect(losses(0.02).at(-1)!).toBeGreaterThan(100 * losses(0.3).at(-1)!);
    expect(monotoneDown(losses(0.3))).toBe(true);
  });
  it('W2: at 0.95 the bias swings across the valley, yet the loss falls every epoch, more slowly than at 0.3', () => {
    expect(reversals(runs[0.95].params.map((p) => p[1]).slice(0, 15))).toBeGreaterThan(0.8);
    expect(monotoneDown(losses(0.95))).toBe(true);
    losses(0.95).forEach((l, k) => expect(l).toBeGreaterThan(losses(0.3)[k]));
  });
  it('W2: at 1.1 every epoch’s loss is larger than the last (it explodes)', () => {
    expect(losses(1.1).every((l, k) => k === 0 || l > losses(1.1)[k - 1])).toBe(true);
    expect(losses(1.1).at(-1)!).toBeGreaterThan(1e3);
  });
  it('W3: at 1.1 the exploding-gradient breakpoint fires', () => {
    const toggles = Object.fromEntries(
      ['nonFinite', 'vanishing', 'exploding', 'deadRelu', 'lossIncrease', 'lossPlateau', 'gradInit'].map(
        (k) => [k, k === 'exploding'],
      ),
    ) as unknown as BreakpointToggles;
    const hit = runToBreakpoint(trace(e.id, withLr(e.id, 1.1)), -1, activeBreakpoints(toggles));
    expect(hit.hit).not.toBeNull();
  });
  it('panel labels: each run’s verdict describes its own loss curve', () => {
    const compared: ComparedRun[] = [0.02, 0.3, 0.95, 1.1].map((lr) => ({
      lr,
      losses: losses(lr),
      weights: runs[lr].params.map((p) => p[0]),
      diverged: !Number.isFinite(losses(lr).at(-1)!) || losses(lr).at(-1)! > 1e6,
    }));
    const v = compared.map((r) => lrVerdict(r, compared));
    expect(v).toEqual(['too small', 'good', 'too large', 'divergent']);
    // "too large: steps overshoot, so the loss falls more slowly" — slower than the good run, and falling.
    expect(monotoneDown(losses(0.95))).toBe(true);
    expect(losses(0.95).at(-1)!).toBeGreaterThan(losses(0.3).at(-1)!);
  });
});

describe('explainers', () => {
  it('the loss explainer no longer promises that the update lowers the batch loss: at η = 1.1 it rises', () => {
    const l = losses11();
    expect(l[1]).toBeGreaterThan(l[0]);
  });
  it('EVAL: the model is evaluated on the whole training set (every experiment except the CNN)', () => {
    for (const e of EXPERIMENTS.filter((x) => x.id !== 'cnn-mnist')) {
      const src = trace(e.id, { ...e.config, epochs: 1 });
      const ev = firstOf(src, 'EVAL_END');
      expect(ev, e.id).toBeGreaterThan(0);
      expect(Number(src.get(ev).meta.n), e.id).toBe(resolveDataset(e.dataset).xs.shape[0]);
    }
  });
});

function losses11(): number[] {
  return train('lr-pathology', withLr('lr-pathology', 1.1)).r.map((x) => x.eval.loss);
}

/**
 * Every curriculum experiment is trained with its own configuration and must
 * show what its objective claims; the curriculum structure is validated too.
 */
import { describe, expect, it } from 'vitest';
import { registerAsset, resolveDataset } from '../../src/core/engine/host';
import { loadMnist } from '../../src/experiments/data/mnist';

registerAsset('mnist-012', loadMnist);
import { TrainingSession, type EpochRecord, type TrainConfig } from '../../src/core/engine/session';
import { EXPERIMENTS, experimentById } from '../../src/experiments/registry';
import { applyEdit } from '../../src/experiments/edits';

function train(config: TrainConfig, id: string): EpochRecord[] {
  const s = new TrainingSession(config, resolveDataset(experimentById(id).dataset));
  const out: EpochRecord[] = [];
  while (!s.done) {
    out.push(s.runEpoch());
    if (!Number.isFinite(out.at(-1)!.eval.loss)) break;
  }
  return out;
}
const final = (r: EpochRecord[]) => r.at(-1)!.eval;

describe('curriculum structure', () => {
  it('has seven core experiments, the CNN, and two diagnostics, with valid acyclic prerequisites', () => {
    expect(EXPERIMENTS.filter((e) => e.track === 'core')).toHaveLength(8);
    expect(EXPERIMENTS.every((e) => e.status === 'available')).toBe(true);
    expect(EXPERIMENTS.filter((e) => e.track === 'diagnostic')).toHaveLength(2);
    const ids = new Set(EXPERIMENTS.map((e) => e.id));
    for (const e of EXPERIMENTS) {
      if (e.prerequisite) expect(ids.has(e.prerequisite), e.id).toBe(true);
      const seen = new Set<string>();
      let cur: string | null = e.id;
      while (cur) {
        expect(seen.has(cur)).toBe(false);
        seen.add(cur);
        cur = experimentById(cur).prerequisite;
      }
    }
    const core = EXPERIMENTS.filter((e) => e.track === 'core');
    core.slice(1).forEach((e, k) => expect(e.prerequisite).toBe(core[k].id));
  });

  for (const e of EXPERIMENTS.filter((x) => x.status === 'available')) {
    it(`${e.number} ${e.title}: complete teaching material`, () => {
      expect(e.objective.length).toBeGreaterThan(30);
      expect(e.walkthrough.length).toBeGreaterThanOrEqual(3);
      expect(e.selfCheck.length).toBeGreaterThanOrEqual(2);
      expect(e.selfCheck.length).toBeLessThanOrEqual(3);
      for (const q of e.selfCheck) {
        expect(q.options.filter((o) => o.correct)).toHaveLength(1);
        for (const o of q.options) expect(o.feedback.length).toBeGreaterThan(10);
      }
    });
  }
});

describe('each experiment shows what it claims', () => {
  it('1 single neuron learns AND', () =>
    expect(final(train(experimentById('single-neuron').config, 'single-neuron')).accuracy).toBe(1));

  it('1 the chosen starting weight is used verbatim', () => {
    const e = experimentById('single-neuron');
    const c = applyEdit(e.config, e.editable[0], 2.5);
    const s = new TrainingSession(c, resolveDataset(e.dataset));
    expect(s.parameters().get('L1.W')!.data[0]).toBe(2.5);
  });

  it('2 activations: a large starting weight saturates sigmoid; every activation option trains', () => {
    const e = experimentById('activations');
    for (const act of ['sigmoid', 'tanh', 'relu', 'linear']) {
      const r = train(applyEdit(e.config, e.editable[0], act), e.id);
      expect(final(r).loss).toBeLessThan(r[0].eval.loss);
    }
    const s = new TrainingSession(e.config, resolveDataset(e.dataset));
    const rec = s.runSample(0); // x = −4, w = 4 ⇒ z = −16
    const z = rec.tape.entries.find((x) => x.op === 'addBias')!.output.value.item();
    expect(Math.abs(z)).toBeGreaterThan(10);
  });

  it('3 forward propagation network separates the clusters', () =>
    expect(
      final(train(experimentById('forward-propagation').config, 'forward-propagation')).accuracy,
    ).toBeGreaterThanOrEqual(0.9));

  it('4 both losses train the classifier', () => {
    const e = experimentById('loss');
    for (const l of ['bce', 'mse'])
      expect(final(train(applyEdit(e.config, e.editable[0], l), e.id)).accuracy).toBeGreaterThanOrEqual(0.8);
  });

  it('5 gradient descent: 0.3 converges, 0.02 is still far, 0.9 converges, 1.1 diverges', () => {
    const e = experimentById('gradient-descent');
    const at = (lr: number) => final(train(applyEdit(e.config, e.editable[0], lr), e.id)).loss;
    expect(at(0.3)).toBeLessThan(0.05);
    expect(at(0.02)).toBeGreaterThan(0.1);
    expect(at(0.9)).toBeLessThan(0.05);
    expect(at(1.1)).toBeGreaterThan(1e3);
  });

  it('5 gradient descent: B = 5 makes 10 updates per epoch on a rougher path than B = 50 (TR04)', () => {
    const e = experimentById('gradient-descent');
    const path = (b: number) => {
      const s = new TrainingSession(applyEdit(e.config, e.editable[1], b), resolveDataset(e.dataset));
      const pts: number[][] = [];
      const snap = () => pts.push([...s.parameters().values()].flatMap((t) => [...t.data]));
      snap();
      for (let ep = 0; ep < 3; ep++) {
        s.beginEpoch();
        for (let k = 0; k < s.batchesPerEpoch; k++) {
          s.runBatch();
          snap();
        }
        s.endEpoch();
      }
      const steps = pts.slice(1).map((q, i) => q.map((v, j) => v - pts[i][j]));
      const len = steps.reduce((t, d) => t + Math.hypot(...d), 0);
      const disp = Math.hypot(...pts.at(-1)!.map((v, j) => v - pts[0][j]));
      const cos = steps
        .slice(1)
        .map(
          (d, i) =>
            d.reduce((t, v, j) => t + v * steps[i][j], 0) / Math.hypot(...d) / Math.hypot(...steps[i]),
        );
      return {
        perEpoch: s.batchesPerEpoch,
        tortuosity: len / disp,
        meanCos: cos.reduce((t, c) => t + c, 0) / cos.length,
      };
    };
    const full = path(50);
    const mini = path(5);
    expect(full.perEpoch).toBe(1);
    expect(mini.perEpoch).toBe(10);
    // Measured: tortuosity 1.03 vs 1.39, mean cosine of consecutive steps 0.95 vs −0.17.
    expect(mini.tortuosity).toBeGreaterThan(full.tortuosity + 0.2);
    expect(mini.meanCos).toBeLessThan(full.meanCos - 0.5);
  });

  it('6 back-propagation network learns', () =>
    expect(
      final(train(experimentById('backpropagation').config, 'backpropagation')).accuracy,
    ).toBeGreaterThanOrEqual(0.9));

  it('7 XOR: 4 hidden units solve it, 1 hidden unit cannot', () => {
    const e = experimentById('xor-mlp');
    expect(final(train(e.config, e.id)).accuracy).toBe(1);
    expect(final(train(applyEdit(e.config, e.editable[0], 1), e.id)).accuracy).toBeLessThan(1);
  });

  it('8 CNN reaches ≥ 90 % accuracy on held-out digits', () => {
    const r = train(experimentById('cnn-mnist').config, 'cnn-mnist');
    expect(final(r).test?.accuracy).toBeGreaterThanOrEqual(0.9);
  });

  it('D1 sigmoid stack: layer-1 gradient ≥ 100× smaller than the output layer’s; ReLU closes most of the gap', () => {
    const e = experimentById('vanishing-gradients');
    const ratio = (c: TrainConfig) => {
      const r = train({ ...c, epochs: 1 }, e.id)[0];
      return r.gradNorms[0] / r.gradNorms[r.gradNorms.length - 2];
    };
    const sig = ratio(e.config);
    const relu = ratio(applyEdit(e.config, e.editable[0], 'relu'));
    expect(sig).toBeLessThan(1e-2);
    expect(relu).toBeGreaterThan(sig * 100);
  });

  it('D2 four learning rates: too small, good, oscillating, divergent', () => {
    const e = experimentById('lr-pathology');
    const runs = [0.02, 0.3, 0.95, 1.1].map((lr) =>
      train(applyEdit(e.config, e.editable[0], lr), e.id).map((x) => x.eval.loss),
    );
    expect(runs[0].at(-1)!).toBeGreaterThan(0.1);
    expect(runs[1].at(-1)!).toBeLessThan(0.05);
    // 0.95 is close to the stability limit 2/λ_max ≈ 1: it still converges, but the parameters
    // overshoot the minimum on alternate steps, so the slope estimate w alternates around its final value.
    expect(runs[2].at(-1)!).toBeLessThan(0.05);
    expect(runs[3].at(-1)!).toBeGreaterThan(1e3);
  });
});

describe('learning-rate verdicts (D2 panel)', () => {
  it('classifies the four D2 rates as too small, good, too large and divergent', async () => {
    const { EngineHost } = await import('../../src/core/engine/host');
    const { lrVerdict } = await import('../../src/core/engine/protocol');
    const e = experimentById('lr-pathology');
    const r = new EngineHost().handle({
      op: 'compareRuns',
      configs: [0.02, 0.3, 0.95, 1.1].map((lr) => applyEdit(e.config, e.editable[0], lr)),
      dataset: e.dataset,
    });
    if (r.op !== 'compareRuns') throw new Error('unexpected reply');
    expect(r.runs.map((x) => lrVerdict(x, r.runs))).toEqual(['too small', 'good', 'too large', 'divergent']);
  });
});

import { describe, expect, it } from 'vitest';
import { Tape, backward } from '../../src/core/autodiff';
import { gatherRows } from '../../src/core/engine/data';
import * as D from '../../src/core/engine/datasets';
import { TrainingSession } from '../../src/core/engine/session';
import { forward } from '../../src/core/layers/model';
import { applyLoss } from '../../src/core/losses/losses';

const config = {
  seed: 3,
  epochs: 1,
  batchSize: 6,
  shuffle: false,
  loss: 'cce' as const,
  optimizer: { type: 'sgd' as const, lr: 0.1 },
  model: {
    inputShape: [2],
    layers: [
      { type: 'dense' as const, units: 5, activation: 'tanh' as const },
      { type: 'dense' as const, units: 3, activation: 'softmax' as const },
    ],
  },
};

describe('training session', () => {
  it('mean of per-sample gradients equals the gradient of the batched mean loss (independent of TF.js)', () => {
    const data = D.spiral(6, 3, 1);
    const s = new TrainingSession(config, data);
    const before = new Map(s.parameters());
    let batchGrads = new Map<string, Float64Array>();
    s.runEpoch({ onBatchEnd: (b) => (batchGrads = new Map(b.updates.map((u) => [u.name, u.grad.data]))) });

    const tape = new Tape();
    const pv = new Map([...before].map(([k, v]) => [k, tape.leaf(v, true)]));
    const xs = gatherRows(data.xs, [0, 1, 2, 3, 4, 5]);
    const { output, logits } = forward(s.model, tape, tape.leaf(xs, false), pv, true);
    const loss = applyLoss(tape, 'cce', output, logits, tape.leaf(data.ys, false));
    const g = backward(tape, loss);
    for (const [name, v] of pv) {
      const ref = g.get(v.id)!.data;
      batchGrads.get(name)!.forEach((x, i) => expect(x).toBeCloseTo(ref[i], 12));
    }
  });

  it('updates every parameter, biases included (legacy "missing bias update" class)', () => {
    const s = new TrainingSession(config, D.spiral(6, 3, 1));
    const before = new Map(s.parameters());
    s.runEpoch();
    for (const [name, t] of s.parameters()) {
      const changed = t.data.some((v, i) => v !== before.get(name)!.data[i]);
      expect(changed, `${name} did not change`).toBe(true);
    }
  });

  it('applies W ← W − η·ḡ exactly for SGD', () => {
    const s = new TrainingSession(config, D.spiral(6, 3, 1));
    s.runEpoch({
      onBatchEnd: (b) => {
        for (const u of b.updates)
          u.after.data.forEach((v, i) => expect(v).toBe(u.before.data[i] - 0.1 * u.grad.data[i]));
      },
    });
  });

  it('rejects mispaired output activation and loss', () => {
    expect(() => new TrainingSession({ ...config, loss: 'bce' }, D.spiral(6, 3, 1))).toThrow(/sigmoid/);
    const sig = {
      ...config,
      model: {
        inputShape: [2],
        layers: [{ type: 'dense' as const, units: 3, activation: 'sigmoid' as const }],
      },
    };
    expect(() => new TrainingSession(sig, D.spiral(6, 3, 1))).toThrow(/softmax/);
  });

  it('surfaces NaN as a value rather than throwing (it becomes a teachable event downstream)', () => {
    const s = new TrainingSession(
      { ...config, optimizer: { type: 'sgd', lr: 1e308 }, epochs: 3 },
      D.spiral(6, 3, 1),
    );
    let last = 0;
    expect(() => {
      while (!s.done) last = s.runEpoch().meanLoss;
    }).not.toThrow();
    expect(Number.isFinite(last)).toBe(false);
  });
});

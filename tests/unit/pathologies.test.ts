/**
 * The pathology catalogue (docs/PATHOLOGIES.md): every failure the system
 * detects is produced in a real training run and must stop it, with a
 * learner-facing reason; a healthy run of the same model must not trigger it.
 */
import { describe, expect, it } from 'vitest';
import { resolveDataset } from '../../src/core/engine/host';
import type { TrainConfig } from '../../src/core/engine/session';
import { firstBreak, storeSource, TraceStore, type TraceSource } from '../../src/core/npm';
import { PATHOLOGIES, type Pathology } from '../../src/core/npm/pathologies';
import type { DatasetSpec } from '../../src/core/engine/protocol';
import { applyEdit } from '../../src/experiments/edits';
import { experimentById } from '../../src/experiments/registry';

const run = (config: TrainConfig, dataset: DatasetSpec): TraceSource =>
  storeSource(TraceStore.generate(config, resolveDataset(dataset)).store);
const bp = (id: Pathology['id']) => PATHOLOGIES.find((p) => p.id === id)!.breakpoint;
const hit = (src: TraceSource, id: Pathology['id']) => firstBreak(src, -1, src.length - 1, [bp(id)]);

const d2 = experimentById('lr-pathology');
const atRate = (lr: number) => run(applyEdit(d2.config, d2.editable[0], lr), d2.dataset);

const reluNet = (bias1: number): TrainConfig => ({
  seed: 4,
  epochs: 3,
  batchSize: 8,
  shuffle: true,
  loss: 'bce',
  optimizer: { type: 'sgd', lr: 0.1 },
  model: {
    inputShape: [2],
    layers: [
      { type: 'dense', units: 3, activation: 'relu' },
      { type: 'dense', units: 1, activation: 'sigmoid' },
    ],
  },
  // Unit 1's bias is so negative that z = w·x + b < 0 for every input in [-1, 1]²: it starts dead.
  initialParams: { 'L1.b': [bias1, 0.1, 0.1] },
});
const blobs: DatasetSpec = { kind: 'gaussians', n: 32, seed: 1 };

describe('pathology catalogue', () => {
  it('lists exactly the five pathologies of the brief', () => {
    expect(PATHOLOGIES.map((p) => p.id)).toEqual([
      'nonFinite',
      'exploding',
      'vanishing',
      'deadRelu',
      'lossIncrease',
    ]);
  });

  it('NaN/∞: a far too large learning rate overflows to non-finite values, and the run stops there', () => {
    const src = run({ ...applyEdit(d2.config, d2.editable[0], 8), epochs: 150 }, d2.dataset);
    const h = hit(src, 'nonFinite')!;
    expect(h).not.toBeNull();
    expect(h.reason).toMatch(/non-finite value \(NaN or ±∞\)/);
    expect(hit(atRate(0.3), 'nonFinite')).toBeNull();
  });

  it('exploding gradients: η = 1.1 on D2 trips the |g| > 10 threshold; η = 0.3 does not', () => {
    expect(hit(atRate(1.1), 'exploding')!.reason).toMatch(/may be exploding/);
    expect(hit(atRate(0.3), 'exploding')).toBeNull();
  });

  it('vanishing gradients: D1’s 8-layer sigmoid stack trips the all-|g| < 10⁻⁴ threshold in an early layer; ReLU does not', () => {
    const d1 = experimentById('vanishing-gradients');
    const sig = hit(run({ ...d1.config, epochs: 2 }, d1.dataset), 'vanishing')!;
    expect(sig.reason).toMatch(/L[1-4]\.(W|b)/);
    expect(
      hit(run({ ...applyEdit(d1.config, d1.editable[0], 'relu'), epochs: 2 }, d1.dataset), 'vanishing'),
    ).toBeNull();
  });

  it('dead ReLU: a unit inactive for every example of an epoch is reported at EPOCH_END; healthy units are not', () => {
    const src = run(reluNet(-50), blobs);
    const h = hit(src, 'deadRelu')!;
    expect(src.get(h.id).kind).toBe('EPOCH_END');
    expect(h.reason).toMatch(/^unit 1 of layer 1 received no gradient during the whole epoch/);
    expect(hit(run(reluNet(0.1), blobs), 'deadRelu')).toBeNull();
  });

  it('dead ReLU needs a whole epoch: a search that starts mid-epoch does not report it for that epoch', () => {
    const src = run(reluNet(-50), blobs);
    const second = src.header.epochStarts[1];
    expect(firstBreak(src, second + 5, src.header.epochStarts[2] - 1, [bp('deadRelu')])).toBeNull();
  });

  it('learning-rate divergence: the epoch loss rising by more than 10 % flags η = 1.1 but not η = 0.3 or 0.95', () => {
    expect(hit(atRate(1.1), 'lossIncrease')!.reason).toMatch(/learning rate is probably too large/);
    expect(hit(atRate(0.3), 'lossIncrease')).toBeNull();
    expect(hit(atRate(0.95), 'lossIncrease')).toBeNull();
  });
});

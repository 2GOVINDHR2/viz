import { afterAll, describe, expect, it } from 'vitest';
import { Tape, backward, registerOp, type Var } from '../../src/core/autodiff';
import { buildModel, forward, type ModelConfig } from '../../src/core/layers/model';
import { applyLoss, fusesSoftmax, type LossName } from '../../src/core/losses/losses';
import { initialize } from '../../src/core/rng/init';
import { Rng } from '../../src/core/rng/rng';
import { Tensor } from '../../src/core/tensor/tensor';
import * as T from '../../src/core/tensor/ops';
import { recordResults } from '../support/report';
import { GRADCHECK_REL_TOL, gradcheck, oneHotRows, randomTensor, type CheckResult } from './harness';

const results: CheckResult[] = [];

/** Gradcheck the scalar loss of a whole model with respect to every parameter at once. */
function checkModel(
  id: string,
  config: ModelConfig,
  loss: LossName,
  batch: number,
  seed: number,
): CheckResult {
  const rng = new Rng(seed);
  const model = buildModel(config);
  const params = model.params.map((p) =>
    p.init === 'zeros' ? randomTensor(rng, p.shape, -0.3, 0.3) : initialize(p.init, p.shape, rng),
  );
  const x = randomTensor(rng, [batch, ...config.inputShape]);
  const k = model.outputShape[0];
  const y =
    loss === 'cce'
      ? oneHotRows(rng, batch, k)
      : loss === 'bce'
        ? Tensor.from(
            [batch, k],
            Array.from({ length: batch * k }, () => (rng.next() < 0.5 ? 0 : 1)),
          )
        : randomTensor(rng, [batch, k]);
  const build = (tape: Tape, vars: Var[]): Var => {
    const pm = new Map(model.params.map((p, i) => [p.name, vars[i]]));
    const xv = tape.leaf(x, false);
    const out = forward(model, tape, xv, pm, fusesSoftmax(loss));
    return applyLoss(tape, loss, out.output, out.logits, tape.leaf(y, false));
  };
  return gradcheck(id, params, build);
}

const dense = (units: number, activation: 'linear' | 'sigmoid' | 'tanh' | 'relu' | 'softmax') =>
  ({ type: 'dense', units, activation }) as const;

describe('gradcheck: composite layers and whole models', () => {
  const models: { id: string; config: ModelConfig; loss: LossName; batch: number }[] = [
    {
      id: 'single neuron (sigmoid, BCE)',
      config: { inputShape: [2], layers: [dense(1, 'sigmoid')] },
      loss: 'bce',
      batch: 4,
    },
    {
      id: 'dense layer, linear + MSE',
      config: { inputShape: [3], layers: [dense(2, 'linear')] },
      loss: 'mse',
      batch: 3,
    },
    {
      id: 'dense layer, tanh + MSE',
      config: { inputShape: [3], layers: [dense(4, 'tanh')] },
      loss: 'mse',
      batch: 3,
    },
    {
      id: 'dense layer, relu + MSE',
      config: { inputShape: [3], layers: [dense(4, 'relu')] },
      loss: 'mse',
      batch: 3,
    },
    {
      id: 'MLP 2-4-1 XOR shape (sigmoid, BCE)',
      config: { inputShape: [2], layers: [dense(4, 'tanh'), dense(1, 'sigmoid')] },
      loss: 'bce',
      batch: 4,
    },
    {
      id: 'MLP 2-8-3 softmax + CCE (fused)',
      config: { inputShape: [2], layers: [dense(8, 'relu'), dense(3, 'softmax')] },
      loss: 'cce',
      batch: 5,
    },
    {
      id: 'deep sigmoid stack 2-4-4-4-1',
      config: {
        inputShape: [2],
        layers: [dense(4, 'sigmoid'), dense(4, 'sigmoid'), dense(4, 'sigmoid'), dense(1, 'sigmoid')],
      },
      loss: 'bce',
      batch: 3,
    },
    {
      id: 'CNN conv(p1)-maxpool-flatten-dense softmax',
      config: {
        inputShape: [1, 8, 8],
        layers: [
          { type: 'conv2d', filters: 2, kernel: 3, padding: 1, activation: 'tanh' },
          { type: 'pool', mode: 'max', size: 2 },
          { type: 'flatten' },
          dense(3, 'softmax'),
        ],
      },
      loss: 'cce',
      batch: 2,
    },
    {
      id: 'CNN conv(s2)-avgpool-flatten-dense sigmoid',
      config: {
        inputShape: [2, 9, 9],
        layers: [
          { type: 'conv2d', filters: 3, kernel: 3, stride: 2, activation: 'sigmoid' },
          { type: 'pool', mode: 'avg', size: 2 },
          { type: 'flatten' },
          dense(1, 'sigmoid'),
        ],
      },
      loss: 'bce',
      batch: 2,
    },
  ];
  models.forEach(({ id, config, loss, batch }, i) => {
    it(id, () => {
      const r = checkModel(`model:${id}`, config, loss, batch, 100 + i);
      results.push(r);
      expect(r.maxRel).toBeLessThan(GRADCHECK_REL_TOL);
    });
  });

  it('fused softmax–cross-entropy equals the composed −Σ y·log(softmax(z))/N, value and gradient', () => {
    const rng = new Rng(5);
    const z = randomTensor(rng, [4, 3], -2, 2);
    const y = oneHotRows(rng, 4, 3);
    const fusedTape = new Tape();
    const zf = fusedTape.leaf(z, true);
    const lf = fusedTape.apply('softmaxCrossEntropy', [zf, fusedTape.leaf(y, false)]);
    const gf = backward(fusedTape, lf).get(zf.id)!;

    const t = new Tape();
    const zc = t.leaf(z, true);
    const prod = t.apply('mul', [t.apply('log', [t.apply('softmax', [zc])]), t.leaf(y, false)]);
    const lc = t.apply('neg', [t.apply('div', [t.apply('sum', [prod]), t.leaf(Tensor.scalar(4), false)])]);
    const gc = backward(t, lc).get(zc.id)!;

    expect(lf.value.item()).toBeCloseTo(lc.value.item(), 12);
    gf.data.forEach((v, i) => expect(v).toBeCloseTo(gc.data[i], 12));
    // Gradient of the fused rule is exactly (p − y)/N for one-hot targets: not double-applied.
    const p = T.softmax(z);
    gf.data.forEach((v, i) => expect(v).toBeCloseTo((p.data[i] - y.data[i]) / 4, 14));
  });

  it('the harness detects a deliberately wrong gradient rule (guards against vacuous passes)', () => {
    registerOp({
      name: 'test_wrongSquare',
      arity: 1,
      forward: ([a]) => ({ value: T.square(a) }),
      backward: ({ grad, inputs: [a] }) => [T.mul(grad, a)], // missing factor 2
    });
    const r = gradcheck('wrong', [randomTensor(new Rng(1), [3])], (t, [a]) =>
      t.apply('test_wrongSquare', [a]),
    );
    expect(r.maxRel).toBeGreaterThan(0.3);
  });

  it('backward does not mutate any forward tensor (legacy defect D4)', () => {
    const rng = new Rng(9);
    const model = buildModel({
      inputShape: [1, 6, 6],
      layers: [
        { type: 'conv2d', filters: 2, kernel: 3, activation: 'relu' },
        { type: 'pool', mode: 'max', size: 2 },
        { type: 'flatten' },
        dense(2, 'softmax'),
      ],
    });
    const tape = new Tape();
    const pm = new Map(
      model.params.map((p) => [
        p.name,
        tape.leaf(initialize(p.init === 'zeros' ? 'glorotUniform' : p.init, p.shape, rng), true),
      ]),
    );
    const out = forward(model, tape, tape.leaf(randomTensor(rng, [1, 1, 6, 6]), false), pm, true);
    const loss = applyLoss(tape, 'cce', out.output, out.logits, tape.leaf(oneHotRows(rng, 1, 2), false));
    const before = tape.entries.map((e) => [
      ...e.inputs.map((v) => Array.from(v.value.data)),
      Array.from(e.output.value.data),
    ]);
    backward(tape, loss);
    const after = tape.entries.map((e) => [
      ...e.inputs.map((v) => Array.from(v.value.data)),
      Array.from(e.output.value.data),
    ]);
    expect(after).toEqual(before);
  });

  afterAll(() => recordResults('gradcheck', results));
});

/**
 * Experiments are declarative: a configuration, a dataset specification and
 * the teaching material around them. No experiment has bespoke code. P6
 * extends this registry to the full curriculum.
 */
import type { DatasetSpec } from '../core/engine/protocol';
import type { TrainConfig } from '../core/engine/session';

export interface Experiment {
  id: string;
  title: string;
  /** One sentence: what the learner should understand afterwards. */
  objective: string;
  config: TrainConfig;
  dataset: DatasetSpec;
  /** Short orientation shown above the controls. */
  intro: string;
}

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'single-neuron',
    title: 'A single neuron learns AND',
    objective:
      'See how one neuron combines weighted inputs and a bias, measures its error, and nudges each weight to reduce it.',
    intro:
      'Two inputs, one sigmoid neuron, the four rows of the AND truth table. Step through one example at operation granularity first, then run whole epochs and watch the weights settle.',
    config: {
      seed: 7,
      epochs: 60,
      batchSize: 4,
      shuffle: true,
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 1 },
      boundaryGrid: 24,
      model: { inputShape: [2], layers: [{ type: 'dense', units: 1, activation: 'sigmoid' }] },
    },
    dataset: {
      kind: 'points',
      name: 'and',
      xs: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      ys: [[0], [0], [0], [1]],
    },
  },
  {
    id: 'xor-mlp',
    title: 'XOR needs a hidden layer',
    objective:
      'Follow a 2-layer network through forward pass, loss, back-propagation and update, and see why a hidden layer makes XOR learnable.',
    intro:
      'Four XOR examples, four tanh hidden units, one sigmoid output, full-batch gradient descent. Defaults chosen by a recorded sweep: 20 of 20 seeds solve XOR within 100 epochs.',
    config: {
      seed: 3,
      epochs: 150,
      batchSize: 4,
      shuffle: true,
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 1 },
      boundaryGrid: 24,
      model: {
        inputShape: [2],
        layers: [
          { type: 'dense', units: 4, activation: 'tanh' },
          { type: 'dense', units: 1, activation: 'sigmoid' },
        ],
      },
    },
    dataset: { kind: 'xor' },
  },
];

export const experimentById = (id: string): Experiment => {
  const e = EXPERIMENTS.find((x) => x.id === id);
  if (!e) throw new Error(`unknown experiment ${id}`);
  return e;
};

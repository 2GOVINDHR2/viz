/**
 * Every architecture the curriculum plans to run (B2/P6/P7), with a dataset of
 * matching shape. Parity and determinism suites iterate over this list, so
 * adding an experiment architecture here is what extends their coverage.
 */
import type { Dataset } from '../../src/core/engine/data';
import * as D from '../../src/core/engine/datasets';
import type { TrainConfig } from '../../src/core/engine/session';

export interface ArchitectureCase {
  id: string;
  experiment: string;
  config: TrainConfig;
  data: () => Dataset;
}

const base = { shuffle: true, epochs: 1 } as const;

export const ARCHITECTURES: ArchitectureCase[] = [
  {
    id: 'single-neuron',
    experiment: 'Single neuron / logistic unit',
    config: {
      ...base,
      seed: 11,
      batchSize: 4,
      model: { inputShape: [2], layers: [{ type: 'dense', units: 1, activation: 'sigmoid' }] },
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 0.5 },
    },
    data: () => D.gaussians(40, 1),
  },
  {
    id: 'linear-regression',
    experiment: 'Gradient descent (linear neuron, MSE)',
    config: {
      ...base,
      seed: 12,
      batchSize: 5,
      model: { inputShape: [1], layers: [{ type: 'dense', units: 1, activation: 'linear' }] },
      loss: 'mse',
      optimizer: { type: 'sgd', lr: 0.1 },
    },
    data: () => D.line(50, 2),
  },
  {
    id: 'mlp-xor',
    experiment: 'XOR with an MLP (2-4-1, tanh/sigmoid, BCE)',
    config: {
      ...base,
      seed: 13,
      batchSize: 4,
      model: {
        inputShape: [2],
        layers: [
          { type: 'dense', units: 4, activation: 'tanh' },
          { type: 'dense', units: 1, activation: 'sigmoid' },
        ],
      },
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 0.5 },
    },
    data: () => D.xor(),
  },
  {
    id: 'mlp-softmax-momentum',
    experiment: 'Forward/backprop MLP (2-8-3, ReLU, softmax + CCE, momentum)',
    config: {
      ...base,
      seed: 14,
      batchSize: 8,
      model: {
        inputShape: [2],
        layers: [
          { type: 'dense', units: 8, activation: 'relu' },
          { type: 'dense', units: 3, activation: 'softmax' },
        ],
      },
      loss: 'cce',
      optimizer: { type: 'momentum', lr: 0.1, momentum: 0.9 },
    },
    data: () => D.spiral(48, 3, 3),
  },
  {
    id: 'deep-sigmoid',
    experiment: 'Vanishing gradients (2-4-4-4-4-1 sigmoid stack)',
    config: {
      ...base,
      seed: 15,
      batchSize: 8,
      model: {
        inputShape: [2],
        layers: [
          { type: 'dense', units: 4, activation: 'sigmoid' },
          { type: 'dense', units: 4, activation: 'sigmoid' },
          { type: 'dense', units: 4, activation: 'sigmoid' },
          { type: 'dense', units: 4, activation: 'sigmoid' },
          { type: 'dense', units: 1, activation: 'sigmoid' },
        ],
      },
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 1 },
    },
    data: () => D.circles(32, 4),
  },
  {
    id: 'cnn',
    experiment: 'CNN (conv3x3 p1 ReLU, maxpool2, conv3x3 s1, avgpool2, flatten, dense softmax)',
    config: {
      ...base,
      seed: 16,
      batchSize: 4,
      model: {
        inputShape: [1, 8, 8],
        layers: [
          { type: 'conv2d', filters: 3, kernel: 3, padding: 1, activation: 'relu' },
          { type: 'pool', mode: 'max', size: 2 },
          { type: 'conv2d', filters: 4, kernel: 3, stride: 1, activation: 'tanh' },
          { type: 'pool', mode: 'avg', size: 2 },
          { type: 'flatten' },
          { type: 'dense', units: 3, activation: 'softmax' },
        ],
      },
      loss: 'cce',
      optimizer: { type: 'momentum', lr: 0.05, momentum: 0.5 },
    },
    data: () => D.bars(24, 8, 5),
  },
  {
    id: 'cnn-strided',
    experiment:
      'CNN with strided, padded convolution (conv3x3 s2 p1 sigmoid, maxpool2, flatten, dense sigmoid)',
    config: {
      ...base,
      seed: 17,
      batchSize: 3,
      model: {
        inputShape: [1, 9, 9],
        layers: [
          { type: 'conv2d', filters: 2, kernel: 3, stride: 2, padding: 1, activation: 'sigmoid' },
          { type: 'pool', mode: 'max', size: 2 },
          { type: 'flatten' },
          { type: 'dense', units: 3, activation: 'softmax' },
        ],
      },
      loss: 'cce',
      optimizer: { type: 'sgd', lr: 0.3 },
    },
    data: () => D.bars(18, 9, 6),
  },
];

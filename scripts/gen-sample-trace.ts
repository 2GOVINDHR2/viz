/** Writes the committed sample traces under samples/. */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as D from '../src/core/engine/datasets';
import { TraceStore, serializeTrace } from '../src/core/npm';

const out = (name: string): string => resolve(import.meta.dirname, '../samples', name);

const xor = TraceStore.generate(
  {
    seed: 42,
    epochs: 2,
    batchSize: 2,
    shuffle: true,
    loss: 'bce',
    optimizer: { type: 'sgd', lr: 0.5 },
    boundaryGrid: 8,
    model: {
      inputShape: [2],
      layers: [
        { type: 'dense', units: 2, activation: 'tanh' },
        { type: 'dense', units: 1, activation: 'sigmoid' },
      ],
    },
  },
  D.xor(),
  { generator: 'dl-vizlab sample (scripts/gen-sample-trace.ts)' },
).store;
writeFileSync(out('xor-mlp.trace.json'), serializeTrace(xor.toTrace()) + '\n');

const cnn = TraceStore.generate(
  {
    seed: 7,
    epochs: 1,
    batchSize: 2,
    shuffle: true,
    loss: 'cce',
    optimizer: { type: 'momentum', lr: 0.1, momentum: 0.9 },
    model: {
      inputShape: [1, 6, 6],
      layers: [
        { type: 'conv2d', filters: 2, kernel: 3, padding: 1, activation: 'relu' },
        { type: 'pool', mode: 'max', size: 2 },
        { type: 'flatten' },
        { type: 'dense', units: 3, activation: 'softmax' },
      ],
    },
  },
  D.bars(4, 6, 3),
  { generator: 'dl-vizlab sample (scripts/gen-sample-trace.ts)' },
).store;
writeFileSync(out('cnn-bars.trace.json'), serializeTrace(cnn.toTrace()) + '\n');
console.log(`xor: ${xor.length} instructions; cnn: ${cnn.length} instructions`);

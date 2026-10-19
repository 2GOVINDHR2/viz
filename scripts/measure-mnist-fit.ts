/**
 * Explains the near-zero final loss of the reduced-MNIST parity case
 * (Fix Round 1, B1): trains the parity configuration exactly as the parity
 * suite does (60 images, ≥ 100 steps) and records how well it fits its own
 * training images. Writes reports/mnist-fit.json for the validation report.
 *
 * Usage: npx tsx scripts/measure-mnist-fit.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TrainingSession } from '../src/core/engine/session';
import { ARCHITECTURES } from '../tests/parity/architectures';

const a = ARCHITECTURES.find((x) => x.id === 'cnn-mnist')!;
const data = a.data();
const n = data.xs.shape[0];
const classes = data.ys.shape[1];
// Same epoch count as tests/parity/tfjs.test.ts: enough epochs for at least 100 optimiser steps.
const epochs = Math.ceil(100 / Math.ceil(n / a.config.batchSize));
const s = new TrainingSession({ ...a.config, epochs }, data);
const batchLosses: number[] = [];
while (!s.done) batchLosses.push(...s.runEpoch().batchLosses);

const p = s.predict(data.xs);
const margins: number[] = [];
const losses: number[] = [];
let correct = 0;
for (let i = 0; i < n; i++) {
  const pr = Array.from(p.data.slice(i * classes, (i + 1) * classes));
  const y = Array.from(data.ys.data.slice(i * classes, (i + 1) * classes)).indexOf(1);
  const lp = pr.map(Math.log);
  losses.push(-lp[y]);
  margins.push(lp[y] - Math.max(...lp.filter((_, k) => k !== y)));
  if (pr.indexOf(Math.max(...pr)) === y) correct++;
}
margins.sort((x, y) => x - y);
const F32_HALF_ULP_AT_1 = 2 ** -24; // 1 − p below this rounds p to exactly 1.0 in float32, so −log p = 0
const out = {
  trainingImages: n,
  epochs,
  steps: batchLosses.length,
  finalBatchLoss: batchLosses.at(-1),
  finalBatchSize: n % a.config.batchSize || a.config.batchSize,
  trainingAccuracy: correct / n,
  minLogitMargin: margins[0],
  medianLogitMargin: margins[Math.floor(n / 2)],
  meanExampleLoss: losses.reduce((x, y) => x + y) / n,
  maxExampleLoss: Math.max(...losses),
  examplesBelowFloat32Resolution: losses.filter((l) => l < F32_HALF_ULP_AT_1).length,
};
writeFileSync(resolve(import.meta.dirname, '../reports/mnist-fit.json'), JSON.stringify(out, null, 2) + '\n');
console.log(out);

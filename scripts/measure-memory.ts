/**
 * Measures the checkpoint + recomputation trade-off of TraceStore: memory held
 * versus time to access random instructions, across cache budgets.
 * Output: reports/memory.json (consumed by docs generation).
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import * as D from '../src/core/engine/datasets';
import type { TrainConfig } from '../src/core/engine/session';
import { TraceStore } from '../src/core/npm';
import { Rng } from '../src/core/rng/rng';

const runs: { id: string; config: TrainConfig; data: ReturnType<typeof D.xor> }[] = [
  {
    id: 'MLP 2-8-1 on circles (200 samples, 20 epochs, B=10)',
    config: {
      seed: 1,
      epochs: 20,
      batchSize: 10,
      shuffle: true,
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 0.5 },
      model: {
        inputShape: [2],
        layers: [
          { type: 'dense', units: 8, activation: 'tanh' },
          { type: 'dense', units: 1, activation: 'sigmoid' },
        ],
      },
    },
    data: D.circles(200, 1),
  },
  {
    id: 'CNN conv(4@3x3)-pool-dense on 12x12 bars (150 samples, 4 epochs, B=10)',
    config: {
      seed: 1,
      epochs: 4,
      batchSize: 10,
      shuffle: true,
      loss: 'cce',
      optimizer: { type: 'momentum', lr: 0.05, momentum: 0.9 },
      model: {
        inputShape: [1, 12, 12],
        layers: [
          { type: 'conv2d', filters: 4, kernel: 3, activation: 'relu' },
          { type: 'pool', mode: 'max', size: 2 },
          { type: 'flatten' },
          { type: 'dense', units: 3, activation: 'softmax' },
        ],
      },
    },
    data: D.bars(150, 12, 2),
  },
];

/**
 * One (run, budget) row, measured in this process. The parent below runs every row in a fresh child process with
 * nothing else running (VERIFICATION-METHOD, measurement protocol): measured in one long-lived process, earlier
 * rows' garbage inflated later rows (the Fix Round 3 cache-curve finding).
 */
function measureOne(run: (typeof runs)[number], fraction: number): Record<string, unknown> {
  const fullBytes = TraceStore.generate(run.config, run.data, { budgetBytes: Infinity }).store.stats()
    .fullBytes;
  const budget = Math.max(1, Math.floor(fullBytes * fraction));
  const { store, generationMs } = TraceStore.generate(run.config, run.data, { budgetBytes: budget });
  const rng = new Rng(7);
  const N = 1000;
  const t0 = performance.now();
  for (let k = 0; k < N; k++) store.get(rng.int(store.length));
  const randomMs = (performance.now() - t0) / N;
  const t1 = performance.now();
  for (let id = store.length - 1; id >= Math.max(0, store.length - 2000); id--) store.get(id);
  const backStepMs = (performance.now() - t1) / Math.min(2000, store.length);
  const s = store.stats();
  return {
    run: run.id,
    instructions: store.length,
    budgetFraction: fraction,
    budgetBytes: budget,
    fullBytes,
    cachedBytes: s.cachedBytes,
    checkpointBytes: s.checkpointBytes,
    residentBytes: s.cachedBytes + s.checkpointBytes,
    generationMs: Math.round(generationMs),
    randomAccessMs: Number(randomMs.toFixed(3)),
    sequentialBackStepMs: Number(backStepMs.toFixed(4)),
    regenerations: s.regenerations,
  };
}

const one = process.argv.indexOf('--one');
if (one >= 0) {
  console.log(JSON.stringify(measureOne(runs[Number(process.argv[one + 1])], Number(process.argv[one + 2]))));
  process.exit(0);
}

const rows: unknown[] = [];
for (const [k] of runs.entries()) {
  for (const fraction of [1, 0.25, 0.05, 0.01]) {
    const r = spawnSync(
      process.execPath,
      ['--import', 'tsx', fileURLToPath(import.meta.url), '--one', String(k), String(fraction)],
      {
        encoding: 'utf8',
      },
    );
    if (r.status !== 0) throw new Error(`row ${k} ${fraction} failed: ${r.stderr}`);
    rows.push(JSON.parse(r.stdout.trim().split('\n').at(-1)!));
    console.log(JSON.stringify(rows.at(-1)));
  }
}
writeFileSync(resolve(import.meta.dirname, '../reports/memory.json'), JSON.stringify(rows, null, 2) + '\n');

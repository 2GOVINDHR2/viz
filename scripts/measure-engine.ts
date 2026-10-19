/**
 * Engine performance in Node (one core): time per epoch, trace generation
 * throughput and peak memory for the runnable experiments and every planned
 * architecture. Output: reports/perf-engine.json.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerAsset, resolveDataset } from '../src/core/engine/host';
import { loadMnist } from '../src/experiments/data/mnist';
import { TrainingSession } from '../src/core/engine/session';
import { TraceStore } from '../src/core/npm';
import { EXPERIMENTS } from '../src/experiments/registry';
import { ARCHITECTURES } from '../tests/parity/architectures';

// Experiment 8 uses the bundled reduced MNIST, which the app loads on demand; register it here too.
registerAsset('mnist-012', loadMnist);

const runs = [
  ...EXPERIMENTS.map((e) => ({
    id: `experiment:${e.id}`,
    config: e.config,
    data: resolveDataset(e.dataset),
  })),
  ...ARCHITECTURES.map((a) => ({
    id: `architecture:${a.id}`,
    config: { ...a.config, epochs: 5 },
    data: a.data(),
  })),
];
const rows = runs.map((r) => {
  const s = new TrainingSession(r.config, r.data);
  const t0 = performance.now();
  while (!s.done) s.runEpoch();
  const trainMs = performance.now() - t0;
  const before = process.memoryUsage().heapUsed;
  const { store, generationMs } = TraceStore.generate(r.config, r.data);
  const st = store.stats();
  return {
    id: r.id,
    epochs: r.config.epochs,
    samples: r.data.xs.shape[0],
    msPerEpochTraining: Number((trainMs / r.config.epochs).toFixed(3)),
    msPerEpochWithTrace: Number((generationMs / r.config.epochs).toFixed(3)),
    instructions: store.length,
    instructionsPerSecond: Math.round(store.length / (generationMs / 1000)),
    fullTraceBytes: st.fullBytes,
    residentBytes: st.cachedBytes + st.checkpointBytes,
    heapDeltaMB: Number(((process.memoryUsage().heapUsed - before) / 1048576).toFixed(1)),
  };
});
const out = {
  node: process.version,
  cpu: 'single thread',
  rows,
  peakRssMB: Math.round(process.memoryUsage().rss / 1048576),
};
writeFileSync(
  resolve(import.meta.dirname, '../reports/perf-engine.json'),
  JSON.stringify(out, null, 2) + '\n',
);
console.table(
  rows.map((r) => ({
    id: r.id,
    ms_epoch: r.msPerEpochWithTrace,
    instr: r.instructions,
    MB: (r.fullTraceBytes / 1048576).toFixed(2),
  })),
);

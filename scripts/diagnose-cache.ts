/**
 * Why random-access time is not monotonic in the cache budget (Fix Round 3, B3.1 follow-up).
 *
 * For each budget, over the same scale run as scripts/measure-scale.ts, random access is measured R times with N
 * uniformly random reads each. Every read's time is split into:
 *  - regeneration time (the store's own counter: re-running one batch from its checkpoint);
 *  - garbage-collection time (Node's `gc` performance entries, by kind);
 *  - the remainder (lookup, LRU bookkeeping, eviction).
 * The hit rate and live heap after the reads are recorded too.
 *
 * Output: reports/cache-diagnosis.json.
 * Usage: node --max-old-space-size=12000 --expose-gc --import tsx scripts/diagnose-cache.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PerformanceObserver, constants } from 'node:perf_hooks';
import * as D from '../src/core/engine/datasets';
import type { TrainConfig } from '../src/core/engine/session';
import { TraceStore } from '../src/core/npm';
import { Rng } from '../src/core/rng/rng';

const EPOCHS = Number(process.env.SCALE_EPOCHS ?? 200);
const N = Number(process.env.READS ?? 1000);
const R = Number(process.env.REPEATS ?? 3);
const config: TrainConfig = {
  seed: 1,
  epochs: EPOCHS,
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
};
const data = D.circles(200, 1);
const gcGlobal = (globalThis as { gc?: () => void }).gc;
if (!gcGlobal) throw new Error('run with --expose-gc');

// GC pauses, by kind, collected while the observer is on.
let gcLog: { kind: number; ms: number }[] = [];
const obs = new PerformanceObserver((list) => {
  for (const e of list.getEntries())
    gcLog.push({ kind: (e as unknown as { detail: { kind: number } }).detail.kind, ms: e.duration });
});
const KIND: Record<number, string> = {
  [constants.NODE_PERFORMANCE_GC_MAJOR]: 'major',
  [constants.NODE_PERFORMANCE_GC_MINOR]: 'minor',
  [constants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'incremental',
  [constants.NODE_PERFORMANCE_GC_WEAKCB]: 'weakcb',
};

const full = TraceStore.generate(config, data, { budgetBytes: Infinity });
const fullBytes = full.store.stats().fullBytes;
const segBytes = full.store.segments.map((s) => s.bytes).sort((a, b) => a - b);
const rows: unknown[] = [];
for (const fraction of [1, 0.5, 0.25, 0.1, 0.05, 0.01]) {
  const budget = Math.max(1, Math.floor(fullBytes * fraction));
  const { store } = TraceStore.generate(config, data, { budgetBytes: budget });
  for (let rep = 0; rep < R; rep++) {
    gcGlobal();
    const before = store.stats();
    const rng = new Rng(7 + rep);
    gcLog = [];
    obs.observe({ entryTypes: ['gc'] });
    const t0 = performance.now();
    for (let k = 0; k < N; k++) store.get(rng.int(store.length));
    const totalMs = performance.now() - t0;
    obs.disconnect();
    const after = store.stats();
    const misses = after.misses - before.misses;
    const regenMs = after.regenerationMs - before.regenerationMs;
    const gcByKind: Record<string, number> = {};
    for (const g of gcLog)
      gcByKind[KIND[g.kind] ?? String(g.kind)] = (gcByKind[KIND[g.kind] ?? String(g.kind)] ?? 0) + g.ms;
    const gcMs = gcLog.reduce((a, g) => a + g.ms, 0);
    const row = {
      budgetFraction: fraction,
      repeat: rep,
      reads: N,
      hitRate: Number((1 - misses / N).toFixed(3)),
      cachedSegments: after.cachedSegments,
      perReadMs: Number((totalMs / N).toFixed(3)),
      perMissRegenerationMs: misses ? Number((regenMs / misses).toFixed(3)) : null,
      regenerationShare: Number((regenMs / totalMs).toFixed(3)),
      gcShare: Number((gcMs / totalMs).toFixed(3)),
      gcMsByKind: Object.fromEntries(Object.entries(gcByKind).map(([k, v]) => [k, Math.round(v)])),
      gcEvents: gcLog.length,
      heapUsedMB: Math.round(process.memoryUsage().heapUsed / 2 ** 20),
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
writeFileSync(
  resolve(import.meta.dirname, '../reports/cache-diagnosis.json'),
  JSON.stringify(
    {
      run: `MLP 2-8-1 on circles (200 samples, ${EPOCHS} epochs, B=10)`,
      instructions: full.store.length,
      segments: full.store.segments.length,
      segmentBytes: { min: segBytes[0], median: segBytes[segBytes.length >> 1], max: segBytes.at(-1) },
      node: process.version,
      rows,
    },
    null,
    2,
  ) + '\n',
);

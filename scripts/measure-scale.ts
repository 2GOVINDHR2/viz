/**
 * Scale evidence (Fix Round 3, B3.1): the NPM properties at about ten times the largest run measured so far
 * (86,084 instructions). Each property is checked as it is elsewhere in the repository, and the outcome is
 * recorded as measured, including any failure:
 *  1. schema validity (ajv against src/core/npm/schema.json);
 *  2. agreement of the independent verifier (tools/npm-verify.mjs, a separate process);
 *  3. lossless round trip (serialise → parse → serialise gives identical bytes);
 *  4. byte-identical regeneration of every segment from its checkpoint, under a 1 % cache budget;
 *  5. the cache-budget trade-off curve (as scripts/measure-memory.ts).
 *
 * Output: reports/scale.json. Usage: node --max-old-space-size=12000 --import tsx scripts/measure-scale.ts
 */
import Ajv2020 from 'ajv/dist/2020';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as D from '../src/core/engine/datasets';
import type { TrainConfig } from '../src/core/engine/session';
import { deserializeTrace, serializeTrace, TraceStore, type Instruction } from '../src/core/npm';
import { encodeTensor } from '../src/core/npm/serialize';
import { Rng } from '../src/core/rng/rng';

const ROOT = resolve(import.meta.dirname, '..');
const EPOCHS = Number(process.env.SCALE_EPOCHS ?? 200);
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
const run = `MLP 2-8-1 on circles (200 samples, ${EPOCHS} epochs, B=10)`;
const out: Record<string, unknown> = { run, node: process.version };
const save = (): void =>
  writeFileSync(resolve(ROOT, 'reports/scale.json'), JSON.stringify(out, null, 2) + '\n');
const ms = (t: number): number => Math.round(performance.now() - t);
const segHash = (ins: Instruction[]): string => {
  const h = createHash('sha256');
  for (const i of ins) {
    h.update(JSON.stringify([i.id, i.kind, i.path, i.meta, i.operands, i.symbolic]));
    for (const [k, t] of Object.entries(i.results)) h.update(k + JSON.stringify(encodeTensor(t)));
  }
  return h.digest('hex');
};

let t = performance.now();
const full = TraceStore.generate(config, data, { budgetBytes: Infinity });
const fullStats = full.store.stats();
out.instructions = full.store.length;
out.segments = fullStats.segments;
out.fullBytes = fullStats.fullBytes;
out.generationMs = ms(t);
out.ratioToLargestBefore = Number((full.store.length / 86_084).toFixed(2));
console.log(`generated ${full.store.length} instructions in ${out.generationMs} ms`);
save();

// 1–3: serialise the whole trace, validate, round-trip, verify independently.
const file = resolve(ROOT, '.tmp/scale.trace.json');
mkdirSync(resolve(ROOT, '.tmp'), { recursive: true });
try {
  t = performance.now();
  const trace = { header: full.store.header, instructions: full.store.range(0, full.store.length) };
  const json = serializeTrace(trace);
  out.serialisedBytes = Buffer.byteLength(json);
  out.serialiseMs = ms(t);
  writeFileSync(file, json);
  console.log(`serialised: ${out.serialisedBytes} bytes`);

  t = performance.now();
  const ajv = new Ajv2020({ allErrors: false, strict: false });
  const validate = ajv.compile(JSON.parse(readFileSync(resolve(ROOT, 'src/core/npm/schema.json'), 'utf8')));
  const ok = validate(JSON.parse(json));
  out.schema = { valid: ok, errors: ok ? 0 : (validate.errors ?? []).slice(0, 3), ms: ms(t) };
  console.log(`schema: ${ok}`);

  t = performance.now();
  const again = serializeTrace(deserializeTrace(json));
  out.roundTrip = {
    identical: again === json,
    sha256: createHash('sha256').update(json).digest('hex'),
    ms: ms(t),
  };
  console.log(`round trip identical: ${again === json}`);
  save();
} catch (e) {
  out.serialisationError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  console.log(`serialisation failed: ${out.serialisationError}`);
  save();
}

if (out.serialisedBytes) {
  t = performance.now();
  const r = spawnSync(process.execPath, ['--max-old-space-size=12000', 'tools/npm-verify.mjs', file], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 1 << 26,
  });
  out.verifier = {
    exitCode: r.status,
    summary: (r.stdout + r.stderr).trim().split('\n').slice(-3).join(' | ').slice(0, 400),
    ms: ms(t),
    fileBytes: statSync(file).size,
  };
  console.log(`verifier exit ${r.status}`);
  save();
}
rmSync(file, { force: true });

// 4: every segment regenerated under a 1 % budget is byte-identical to the fully materialised one.
t = performance.now();
const small = TraceStore.generate(config, data, { budgetBytes: Math.floor(fullStats.fullBytes * 0.01) });
let mismatched = 0;
for (const seg of small.store.segments) {
  const a = segHash(small.store.range(seg.start, seg.end));
  const b = segHash(full.store.range(seg.start, seg.end));
  if (a !== b) mismatched++;
}
out.segmentRegeneration = {
  segments: small.store.segments.length,
  mismatched,
  regenerations: small.store.stats().regenerations,
  ms: ms(t),
};
console.log(`segments regenerated: ${small.store.segments.length}, mismatched ${mismatched}`);
save();

// 5: the cache-budget curve.
const curve: unknown[] = [];
for (const fraction of [1, 0.25, 0.05, 0.01]) {
  const budget = Math.max(1, Math.floor(fullStats.fullBytes * fraction));
  const { store, generationMs } = TraceStore.generate(config, data, { budgetBytes: budget });
  const rng = new Rng(7);
  const t0 = performance.now();
  const N = 300;
  for (let k = 0; k < N; k++) store.get(rng.int(store.length));
  const randomMs = (performance.now() - t0) / N;
  const t1 = performance.now();
  for (let id = store.length - 1; id >= Math.max(0, store.length - 2000); id--) store.get(id);
  const backStepMs = (performance.now() - t1) / Math.min(2000, store.length);
  const s = store.stats();
  curve.push({
    budgetFraction: fraction,
    residentBytes: s.cachedBytes + s.checkpointBytes,
    checkpointBytes: s.checkpointBytes,
    generationMs: Math.round(generationMs),
    randomAccessMs: Number(randomMs.toFixed(3)),
    sequentialBackStepMs: Number(backStepMs.toFixed(4)),
  });
  console.log(JSON.stringify(curve.at(-1)));
}
out.curve = curve;
save();

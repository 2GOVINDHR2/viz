/**
 * Memory-bounded access to a training trace by checkpointing and recomputation.
 *
 * The trace is split into segments: the prologue (INIT_PARAM) and one segment
 * per mini-batch (the first batch of an epoch also holds EPOCH_BEGIN; the last
 * also holds EVAL_* and EPOCH_END). For every segment the store keeps only a
 * checkpoint — references to the immutable parameter/optimiser tensors, the
 * RNG state, the epoch's sample order and the emitter's reference table —
 * which is enough to regenerate that segment's instructions exactly by
 * re-running one batch. Materialised segments live in an LRU cache bounded by
 * a byte budget. Regeneration is verified byte-identical in tests/determinism.
 */
import type { Dataset } from '../engine/data';
import { type Checkpoint, type TrainConfig, TrainingSession } from '../engine/session';
import { layerActivation } from '../layers/model';
import type { Tensor } from '../tensor/tensor';
import { type EmitterState, NpmEmitter } from './emitter';
import { type Instruction, NPM_VERSION, type Trace, type TraceHeader } from './ir';

export interface Segment {
  index: number;
  start: number;
  end: number;
  epoch: number | null;
  batch: number | null;
  checkpoint: Checkpoint | null;
  emitterState: EmitterState;
  bytes: number;
}

export interface StoreOptions {
  /** Upper bound on bytes of materialised instruction values kept in memory. */
  budgetBytes?: number;
  generator?: string;
  /** Datasets with more values than this are referenced, not embedded, in the header. */
  embedDatasetLimit?: number;
}

export interface StoreStats {
  segments: number;
  cachedSegments: number;
  cachedBytes: number;
  regenerations: number;
  regenerationMs: number;
  hits: number;
  misses: number;
  /** Bytes the full trace would occupy if every value were retained. */
  fullBytes: number;
  /** Bytes held by checkpoints that are not shared with live parameters. */
  checkpointBytes: number;
}

const DEFAULT_BUDGET = 64 * 1024 * 1024;

export function instructionBytes(i: Instruction): number {
  let n = 96 + i.operands.length * 24 + i.symbolic.length * 2;
  for (const t of Object.values(i.results)) n += t.size * 8 + 32;
  return n;
}

function cloneState(s: EmitterState): EmitterState {
  return { nextId: s.nextId, paramRefs: new Map(s.paramRefs), optRefs: new Map(s.optRefs) };
}

export class TraceStore {
  private _header: TraceHeader | null = null;
  readonly segments: Segment[] = [];
  private readonly config: TrainConfig;
  private readonly data: Dataset;
  private readonly cache = new Map<number, Instruction[]>();
  private cachedBytes = 0;
  private readonly budget: number;
  private counters = { regenerations: 0, regenerationMs: 0, hits: 0, misses: 0 };

  private constructor(config: TrainConfig, data: Dataset, budget: number) {
    this.config = config;
    this.data = data;
    this.budget = budget;
  }

  get header(): TraceHeader {
    if (!this._header) throw new Error('trace still generating');
    return this._header;
  }

  /** Runs the whole training once, recording segment checkpoints and caching as much as the budget allows. */
  static generate(
    config: TrainConfig,
    data: Dataset,
    opts: StoreOptions = {},
  ): { store: TraceStore; generationMs: number } {
    const t0 = performance.now();
    const budget = opts.budgetBytes ?? DEFAULT_BUDGET;
    const session = new TrainingSession(config, data);
    const store = new TraceStore(config, data, budget);
    let buffer: Instruction[] = [];
    const emitter = new NpmEmitter(session, (i) => buffer.push(i));
    const epochStarts: number[] = [];

    // Segments are admitted to the LRU cache as they close, so generation itself stays within budget.
    const close = (s: Omit<Segment, 'end' | 'bytes' | 'index'>): void => {
      const bytes = buffer.reduce((a, i) => a + instructionBytes(i), 0);
      const index = store.segments.length;
      store.segments.push({ ...s, index, end: emitter.nextId, bytes });
      store.admit(index, buffer);
      buffer = [];
    };

    const prologueState = emitter.snapshot();
    emitter.emitPrologue();
    close({ start: 0, epoch: null, batch: null, checkpoint: null, emitterState: prologueState });
    while (!session.done) {
      const B = session.batchesPerEpoch;
      for (let b = 0; b < B; b++) {
        const start = emitter.nextId;
        const checkpoint = session.checkpoint();
        const emitterState = emitter.snapshot();
        if (b === 0) {
          epochStarts.push(start);
          session.beginEpoch(emitter);
        }
        session.runBatch(emitter);
        if (b === B - 1) session.endEpoch(emitter);
        close({
          start,
          epoch: session.inEpoch ? session.epoch : session.epoch - 1,
          batch: b,
          checkpoint,
          emitterState,
        });
      }
    }
    epochStarts.push(emitter.nextId);
    store._header = buildHeader(config, data, session, emitter.nextId, epochStarts, opts);
    return { store, generationMs: performance.now() - t0 };
  }

  get length(): number {
    return this.header.length;
  }

  segmentOf(id: number): Segment {
    if (id < 0 || id >= this.length)
      throw new RangeError(`instruction ${id} outside trace of length ${this.length}`);
    let lo = 0;
    let hi = this.segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.segments[mid].start <= id) lo = mid;
      else hi = mid - 1;
    }
    return this.segments[lo];
  }

  get(id: number): Instruction {
    const seg = this.segmentOf(id);
    return this.materialize(seg.index)[id - seg.start];
  }

  /** Instructions [from, to). */
  range(from: number, to: number): Instruction[] {
    const out: Instruction[] = [];
    let id = Math.max(0, from);
    const end = Math.min(this.length, to);
    while (id < end) {
      const seg = this.segmentOf(id);
      const ins = this.materialize(seg.index);
      const stop = Math.min(end, seg.end);
      for (; id < stop; id++) out.push(ins[id - seg.start]);
    }
    return out;
  }

  /** Re-runs one segment from its checkpoint. Public so tests can compare against the cached copy. */
  regenerate(index: number): Instruction[] {
    const seg = this.segments[index];
    const t0 = performance.now();
    const out: Instruction[] = [];
    if (seg.checkpoint === null) {
      const session = new TrainingSession(this.config, this.data);
      new NpmEmitter(session, (i) => out.push(i), cloneState(seg.emitterState)).emitPrologue();
    } else {
      const session = new TrainingSession(this.config, this.data, seg.checkpoint);
      const emitter = new NpmEmitter(session, (i) => out.push(i), cloneState(seg.emitterState));
      if (seg.batch === 0) session.beginEpoch(emitter);
      session.runBatch(emitter);
      if (seg.batch === session.batchesPerEpoch - 1) session.endEpoch(emitter);
    }
    this.counters.regenerations++;
    this.counters.regenerationMs += performance.now() - t0;
    if (out.length !== seg.end - seg.start || out[0]?.id !== seg.start) {
      throw new Error(`segment ${index} regenerated inconsistently`);
    }
    return out;
  }

  private materialize(index: number): Instruction[] {
    const hit = this.cache.get(index);
    if (hit) {
      this.counters.hits++;
      this.cache.delete(index);
      this.cache.set(index, hit);
      return hit;
    }
    this.counters.misses++;
    const ins = this.regenerate(index);
    this.admit(index, ins);
    return ins;
  }

  /** Inserts as most-recently-used and evicts least-recently-used segments beyond the budget (never `index` itself). */
  private admit(index: number, ins: Instruction[]): void {
    this.cache.set(index, ins);
    this.cachedBytes += this.segments[index].bytes;
    for (const [k] of this.cache) {
      if (this.cachedBytes <= this.budget || k === index) break;
      this.cache.delete(k);
      this.cachedBytes -= this.segments[k].bytes;
    }
  }

  stats(): StoreStats {
    const live = new Set<Tensor>();
    let checkpointBytes = 0;
    for (const s of this.segments) {
      if (!s.checkpoint) continue;
      for (const t of [...s.checkpoint.params.values(), ...s.checkpoint.optState.values()]) {
        if (t && !live.has(t)) {
          live.add(t);
          checkpointBytes += t.size * 8;
        }
      }
    }
    return {
      segments: this.segments.length,
      cachedSegments: this.cache.size,
      cachedBytes: this.cachedBytes,
      fullBytes: this.segments.reduce((a, s) => a + s.bytes, 0),
      checkpointBytes,
      ...this.counters,
    };
  }

  /** The complete trace with every instruction materialised. Only sensible for small runs. */
  toTrace(): Trace {
    return { header: this.header, instructions: this.range(0, this.length) };
  }
}

function buildHeader(
  config: TrainConfig,
  data: Dataset,
  session: TrainingSession,
  length: number,
  epochStarts: number[],
  opts: StoreOptions,
): TraceHeader {
  const model = session.model;
  const embed = data.xs.size + data.ys.size <= (opts.embedDatasetLimit ?? 20000);
  return {
    format: 'npm-trace',
    version: NPM_VERSION,
    generator: opts.generator ?? 'dl-vizlab',
    seed: config.seed,
    config: JSON.parse(JSON.stringify(config)),
    model: {
      inputShape: [...model.config.inputShape],
      outputShape: [...model.outputShape],
      layers: model.layers.map((l) => ({
        name: l.name,
        type: l.config.type,
        inShape: [...l.inShape],
        outShape: [...l.outShape],
        activation: layerActivation(l),
        params: l.params.map((p) => p.name),
      })),
      params: model.params.map((p) => ({ name: p.name, layer: p.layer, role: p.role, shape: [...p.shape] })),
    },
    dataset: {
      name: data.name,
      n: data.xs.shape[0],
      inputShape: data.xs.shape.slice(1),
      classes: data.classes ?? null,
      xs: embed ? data.xs : null,
      ys: embed ? data.ys : null,
    },
    length,
    epochStarts,
  };
}

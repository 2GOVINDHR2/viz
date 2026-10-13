/**
 * The message protocol between the UI thread and the engine worker.
 *
 * All training, trace generation, recomputation and navigation run in the
 * worker (EngineHost); the UI only sends requests and renders replies, so the
 * main thread never blocks on computation. Tensors cross the boundary as
 * { __tensor, shape, data: Float64Array } and are rebuilt on arrival.
 */
import { Tensor } from '../tensor/tensor';
import type { Breakpoint, BreakHit } from '../npm/breakpoints';
import type { Granularity, TraceStatistics } from '../npm/stats';
import type { EpochSummary, ExecState } from '../npm/state';
import type { Instruction, TraceHeader } from '../npm/ir';
import type { TrainConfig } from './session';

export type DatasetSpec =
  | { kind: 'xor' }
  | { kind: 'xorClusters'; n: number; seed: number; noise?: number }
  | { kind: 'gaussians'; n: number; seed: number; separation?: number }
  | { kind: 'circles'; n: number; seed: number }
  | { kind: 'spiral'; n: number; classes: number; seed: number }
  | { kind: 'line'; n: number; seed: number }
  | { kind: 'bars'; n: number; size: number; seed: number }
  | { kind: 'points'; xs: number[][]; ys: number[][]; name: string }
  /** A dataset the host was given in advance (large bundled assets, loaded lazily by the worker). */
  | { kind: 'asset'; name: string; trainPerClass?: number; testPerClass?: number };

export type Request =
  | { op: 'generate'; config: TrainConfig; dataset: DatasetSpec; budgetBytes?: number }
  | { op: 'range'; from: number; to: number }
  | { op: 'advance'; cursor: number; granularity: Granularity; direction: 1 | -1; breakpoints: Breakpoint[] }
  | { op: 'jump'; cursor: number }
  | { op: 'runToBreakpoint'; cursor: number; breakpoints: Breakpoint[] }
  | { op: 'epochSummaries' }
  /** Values of the given parameters after every update up to the cursor (for trajectories of small models). */
  | { op: 'paramHistory'; params: string[]; cursor: number }
  /** Trains each configuration on the dataset (no trace) and reports per-epoch evaluation loss. */
  | { op: 'compareRuns'; configs: TrainConfig[]; dataset: DatasetSpec }
  | { op: 'statistics' }
  /** The standard figure set at the cursor (built by the app's worker from src/export, outside the core). */
  | {
      op: 'figures';
      cursor: number;
      mode: 'colour' | 'greyscale' | 'highContrast';
      captions?: Record<string, string>;
    };

export type { EpochSummary } from '../npm/state';

export type Reply =
  | { op: 'generate'; header: TraceHeader; length: number; generationMs: number }
  | { op: 'range'; instructions: Instruction[] }
  | {
      op: 'move';
      cursor: number;
      state: ExecState;
      hit: BreakHit | null;
      /** Values referenced by the current instruction, keyed "ref.slot", so explanations need no further round trip. */
      operands: Record<string, Tensor>;
    }
  | { op: 'epochSummaries'; summaries: EpochSummary[] }
  | { op: 'paramHistory'; points: { id: number; values: number[] }[] }
  | { op: 'compareRuns'; runs: ComparedRun[] }
  | { op: 'statistics'; statistics: TraceStatistics; generationMs: number }
  | { op: 'figures'; figures: { id: string; title: string; caption: string; svg: string; csv: string }[] };

export interface ComparedRun {
  lr: number;
  /** Evaluation loss after each epoch. */
  losses: number[];
  /** First element of the first parameter after each epoch (shows overshooting). */
  weights: number[];
  diverged: boolean;
}

/**
 * Classifies a learning rate from its run, relative to the best run in the
 * comparison: divergent (loss grew or became non-finite), too large (the
 * weight overshoots back and forth), too small (final loss ≥ 10× the best
 * run's), or good.
 */
export function lrVerdict(
  run: ComparedRun,
  all: ComparedRun[],
): 'divergent' | 'too large' | 'too small' | 'good' {
  const l = run.losses;
  if (run.diverged || !Number.isFinite(l.at(-1)!) || l.at(-1)! > l[0]) return 'divergent';
  const d = run.weights.slice(1).map((w, k) => w - run.weights[k]);
  const flips = d.slice(1).filter((x, k) => Math.sign(x) !== Math.sign(d[k]) && x !== 0).length;
  if (d.length > 2 && flips / (d.length - 1) > 0.3) return 'too large';
  const best = Math.min(
    ...all.filter((r) => !r.diverged && Number.isFinite(r.losses.at(-1)!)).map((r) => r.losses.at(-1)!),
  );
  if (l.at(-1)! >= 10 * best) return 'too small';
  return 'good';
}

export interface Envelope<T> {
  id: number;
  body: T;
}
export interface ErrorReply {
  id: number;
  error: string;
}

/** Replaces every Tensor in a value with a cloneable record (structured clone drops class prototypes). */
export function toWire(v: unknown): unknown {
  if (v instanceof Tensor) return { __tensor: true, shape: [...v.shape], data: v.data };
  if (Array.isArray(v)) return v.map(toWire);
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v)) out[k] = toWire(x);
    return out;
  }
  return v;
}

export function fromWire<T>(v: unknown): T {
  const walk = (x: unknown): unknown => {
    if (Array.isArray(x)) return x.map(walk);
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      if (o.__tensor) return Tensor.from(o.shape as number[], o.data as Float64Array);
      const out: Record<string, unknown> = {};
      for (const [k, y] of Object.entries(o)) out[k] = walk(y);
      return out;
    }
    return x;
  };
  return walk(v) as T;
}

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
import type { ExecState } from '../npm/state';
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
  | { kind: 'points'; xs: number[][]; ys: number[][]; name: string };

export type Request =
  | { op: 'generate'; config: TrainConfig; dataset: DatasetSpec; budgetBytes?: number }
  | { op: 'range'; from: number; to: number }
  | { op: 'advance'; cursor: number; granularity: Granularity; direction: 1 | -1; breakpoints: Breakpoint[] }
  | { op: 'jump'; cursor: number }
  | { op: 'runToBreakpoint'; cursor: number; breakpoints: Breakpoint[] }
  | { op: 'epochSummaries' }
  | { op: 'statistics' };

export interface EpochSummary {
  epoch: number;
  meanLoss: number;
  batchLosses: number[];
  gradNorms: number[];
  paramNorms: number[];
  params: string[];
  evalLoss: number;
  evalAccuracy: number | null;
}

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
  | { op: 'statistics'; statistics: TraceStatistics; generationMs: number };

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

/**
 * Read access to a trace, independent of where it lives: in memory (a loaded
 * trace file) or behind a checkpointing TraceStore. Navigation, breakpoints
 * and state reconstruction are written against this interface only.
 */
import type { Instruction, Trace, TraceHeader } from './ir';
import type { TraceStore } from './store';

export interface TraceSource {
  readonly header: TraceHeader;
  readonly length: number;
  get(id: number): Instruction;
  range(from: number, to: number): Instruction[];
  /**
   * [start, end) of the segment containing `id`. Segments are the prologue and
   * one per mini-batch (NPM-SPEC §9); no granularity unit except an epoch
   * crosses a segment boundary.
   */
  segmentBounds(id: number): [number, number];
}

export function storeSource(store: TraceStore): TraceSource {
  return {
    header: store.header,
    get length() {
      return store.length;
    },
    get: (id) => store.get(id),
    range: (a, b) => store.range(a, b),
    segmentBounds: (id) => {
      const s = store.segmentOf(id);
      return [s.start, s.end];
    },
  };
}

/** Segments of an in-memory trace, recovered from its structure: prologue, then one per BATCH_BEGIN … BATCH_END (with epoch head/tail attached). */
export function memorySource(trace: Trace): TraceSource {
  const ins = trace.instructions;
  const starts: number[] = [0];
  for (let i = 0; i < ins.length; i++) {
    const k = ins[i].kind;
    // A new segment starts at EPOCH_BEGIN, or at BATCH_BEGIN unless it directly follows EPOCH_BEGIN.
    if (k === 'EPOCH_BEGIN' || (k === 'BATCH_BEGIN' && ins[i - 1]?.kind !== 'EPOCH_BEGIN'))
      if (i > 0) starts.push(i);
  }
  starts.push(ins.length);
  const bounds = (id: number): [number, number] => {
    let lo = 0;
    let hi = starts.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= id) lo = mid;
      else hi = mid - 1;
    }
    return [starts[lo], starts[lo + 1]];
  };
  return {
    header: trace.header,
    length: ins.length,
    get: (id) => {
      if (id < 0 || id >= ins.length)
        throw new RangeError(`instruction ${id} outside trace of length ${ins.length}`);
      return ins[id];
    },
    range: (a, b) => ins.slice(Math.max(0, a), Math.min(ins.length, b)),
    segmentBounds: bounds,
  };
}

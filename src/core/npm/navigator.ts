/**
 * Granularity-aware navigation over a trace (NPM-SPEC §5.3).
 *
 * The cursor is the id of the last executed instruction; −1 means nothing has
 * executed yet. Stepping forward at granularity g completes the unit the
 * cursor is in, or — if that unit is already complete — executes the whole
 * next unit. Stepping backward returns to the state just before the cursor's
 * unit began. Units are found by scanning within one segment, because no unit
 * other than an epoch crosses a segment boundary; epochs use the header's
 * epoch index. So a step never materialises more than two segments.
 */
import type { Instruction } from './ir';
import type { TraceSource } from './source';
import { type Granularity, unitKey } from './stats';

export const BEFORE_START = -1;

/** [first, last] ids (inclusive) of the unit at granularity g containing `id`. */
export function unitBounds(src: TraceSource, id: number, g: Granularity): [number, number] {
  if (g === 'operation') return [id, id];
  if (g === 'epoch') {
    const starts = src.header.epochStarts;
    if (id < starts[0]) return [0, starts[0] - 1];
    let e = 0;
    while (e + 1 < starts.length && starts[e + 1] <= id) e++;
    return [starts[e], starts[e + 1] - 1];
  }
  const [s, end] = src.segmentBounds(id);
  const ins = src.range(s, end);
  const key = unitKey(ins[id - s], g);
  let a = id;
  while (a > s && unitKey(ins[a - 1 - s], g) === key) a--;
  let b = id;
  while (b + 1 < end && unitKey(ins[b + 1 - s], g) === key) b++;
  return [a, b];
}

export function stepForward(src: TraceSource, cursor: number, g: Granularity): number {
  if (src.length === 0) return BEFORE_START;
  if (cursor < 0) return unitBounds(src, 0, g)[1];
  const [, end] = unitBounds(src, cursor, g);
  if (end > cursor) return end;
  return end + 1 < src.length ? unitBounds(src, end + 1, g)[1] : cursor;
}

export function stepBackward(src: TraceSource, cursor: number, g: Granularity): number {
  if (cursor < 0) return BEFORE_START;
  const [start] = unitBounds(src, cursor, g);
  return start === 0 ? BEFORE_START : unitBounds(src, start - 1, g)[1];
}

export function clampCursor(src: TraceSource, id: number): number {
  return Math.max(BEFORE_START, Math.min(src.length - 1, Math.floor(id)));
}

/** Iterates instructions (from, to], segment by segment so a long range is never held in memory at once. */
export function* walk(src: TraceSource, from: number, to: number): Generator<Instruction> {
  let id = from + 1;
  while (id <= to) {
    const [, end] = src.segmentBounds(id);
    const stop = Math.min(end, to + 1);
    for (const ins of src.range(id, stop)) yield ins;
    id = stop;
  }
}

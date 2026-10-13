import type { Instruction, TraceHeader } from '../core/npm/ir';

/** What the learner selected in a view: a neuron (unit of a layer) or a weight (edge i → j into a layer). */
export type Focus =
  { kind: 'unit'; layer: string; index: number } | { kind: 'edge'; layer: string; i: number; j: number };

export const sameFocus = (a: Focus | null, b: Focus | null): boolean =>
  !!a &&
  !!b &&
  a.kind === b.kind &&
  a.layer === b.layer &&
  (a.kind === 'unit'
    ? a.index === (b as typeof a).index
    : a.i === (b as typeof a).i && a.j === (b as typeof a).j);

const WEIGHT_SHAPED = new Set([
  'GRAD_MATMUL_W',
  'INIT_PARAM',
  'GRAD_ACCUMULATE',
  'OPTIMIZER_STATE',
  'COMPUTE_UPDATE',
  'APPLY_UPDATE',
]);

/**
 * Index into the current instruction's main result that the explanation
 * should focus on, given what the learner selected. A selected weight W[i,j]
 * maps to element i·n + j of weight-shaped results and to unit j of per-unit
 * results; a selected neuron maps to its unit index.
 */
export function focusIndexFor(focus: Focus | null, ins: Instruction | null, header: TraceHeader): number {
  if (!focus || !ins || ins.path.layer !== focus.layer) return 0;
  const units = header.model.layers.find((l) => l.name === focus.layer)?.outShape[0] ?? 1;
  const weightResult =
    WEIGHT_SHAPED.has(ins.kind) && (ins.kind === 'GRAD_MATMUL_W' || String(ins.meta.param).endsWith('.W'));
  if (focus.kind === 'edge') return weightResult ? focus.i * units + focus.j : focus.j;
  return weightResult ? 0 : focus.index;
}

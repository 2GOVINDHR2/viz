/**
 * Querying a trace (Fix Round 4, D2; NPM-SPEC §10). Pure functions over instructions, used by the expert trace view:
 *  - a structural filter: instruction kind, layer, phase, epoch, any combination;
 *  - a numeric search: the first instruction, from a position onwards, that holds a gradient whose largest
 *    magnitude is below (or above) a threshold.
 *
 * Every query reads the trace only, never the engine, so it can run over a trace file just as well as over the live
 * run. This is the NPM's counterpart to querying a provenance store (RELATED-REPRESENTATIONS §2).
 */
import type { Instruction, Phase } from '../../core/npm/ir';

export interface TraceFilter {
  kind?: string;
  layer?: string;
  phase?: Phase;
  epoch?: number;
}

export const matches = (ins: Instruction, f: TraceFilter): boolean =>
  (f.kind === undefined || ins.kind === f.kind) &&
  (f.layer === undefined || ins.path.layer === f.layer) &&
  (f.phase === undefined || ins.path.phase === f.phase) &&
  (f.epoch === undefined || ins.path.epoch === f.epoch);

/** Ids of the instructions that match a filter, in trace order. */
export function filterTrace(instructions: Instruction[], f: TraceFilter): number[] {
  return instructions.filter((i) => matches(i, f)).map((i) => i.id);
}

/** True when an instruction produces a gradient: its kind is a backward or accumulation step. */
export const isGradient = (ins: Instruction): boolean =>
  ins.path.phase === 'backward' || ins.kind === 'GRAD_ACCUMULATE';

/** The largest absolute value among an instruction's results (NaN-aware: NaN counts as infinitely large). */
export function largestMagnitude(ins: Instruction): number {
  let m = 0;
  for (const t of Object.values(ins.results))
    for (let k = 0; k < t.data.length; k++) {
      const v = Math.abs(t.data[k]);
      if (Number.isNaN(v)) return Infinity;
      if (v > m) m = v;
    }
  return m;
}

export interface GradientSearch {
  /** "below": every element of the gradient is smaller in magnitude than the threshold; "above": some element is larger. */
  when: 'below' | 'above';
  threshold: number;
  /** Search from this instruction id onwards (inclusive). */
  from?: number;
  /** Optionally restrict to a filter (a layer, say). */
  filter?: TraceFilter;
}

/** The first gradient instruction at or after `from` meeting the condition, or null. */
export function firstGradient(instructions: Instruction[], q: GradientSearch): Instruction | null {
  for (const ins of instructions) {
    if (ins.id < (q.from ?? 0) || !isGradient(ins)) continue;
    if (q.filter && !matches(ins, q.filter)) continue;
    const m = largestMagnitude(ins);
    if (q.when === 'below' ? m < q.threshold : m > q.threshold) return ins;
  }
  return null;
}

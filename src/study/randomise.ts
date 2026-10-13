/**
 * Stratified permuted-block randomisation (docs/STUDY-PROTOCOL.md §3): each
 * stratum draws from its own shuffled block containing every condition once,
 * refilled when exhausted, so arms stay balanced within each stratum after
 * every complete block.
 */
import { Rng } from '../core/rng/rng';
import type { Condition, Design, Stratum } from './types';
import { conditionsFor } from './types';

export type Allocation = Record<Stratum, Condition[]>;
export const emptyAllocation = (): Allocation => ({ low: [], high: [] });

export const stratumOf = (familiarity: number): Stratum => (familiarity <= 2 ? 'low' : 'high');

export function shuffle<T>(xs: readonly T[], rng: Rng): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draws the next condition for `stratum`; returns it with the updated allocation state. */
export function allocate(
  state: Allocation,
  stratum: Stratum,
  design: Design,
  rng: Rng,
): { condition: Condition; state: Allocation } {
  const allowed = conditionsFor(design);
  // A block left over from a different design is discarded rather than mixed in.
  let block = state[stratum].filter((c) => allowed.includes(c));
  if (block.length === 0 || block.length !== state[stratum].length) block = shuffle(allowed, rng);
  const [condition, ...rest] = block;
  return { condition, state: { ...state, [stratum]: rest } };
}

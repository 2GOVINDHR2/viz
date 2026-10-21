/**
 * Semantic stepping on the novice path (Fix Round 2c, ADR-053). A presentation-layer filter over the units
 * of NPM-SPEC §5.2. The engine, IR and trace are unchanged, and expert mode keeps §5.3 stepping exactly.
 *
 * At each step size, a *stop* is a unit that is what the step's label names:
 *
 * | step size | stops at the end of the next unit with… |
 * |---|---|
 * | one calculation (operation) | phase forward or backward, except LOAD_INPUT and the *_LAYER_END markers |
 * | one layer | a layer (path.layer ≠ null), in the forward or backward phase |
 * | forward / backward / update (phase) | phase forward, backward or update |
 * | one example (sample) | path.sample ≠ null |
 * | one batch | path.batch ≠ null |
 * | one full pass (epoch) | path.epoch ≠ null |
 *
 * Every other unit on the way is *interstitial*: set-up, control, loading an example, measuring the error,
 * evaluation, and (below the phase step size) the update. It is passed without stopping, and the step reports
 * the exact range it passed, so the screen can narrate each passed unit in one short phrase. Nothing is
 * silently skipped.
 */
import type { Instruction } from '../core/npm/ir';
import { firstBreak, type Breakpoint } from '../core/npm/breakpoints';
import { stepBackward, stepForward } from '../core/npm/navigator';
import type { TraceSource } from '../core/npm/source';
import { unitKey, type Granularity } from '../core/npm/stats';

const LEARNING = new Set(['forward', 'backward']);

/** True when the unit containing `ins` (at step size g) is a stop on the novice path. */
export function isStop(ins: Instruction, g: Granularity): boolean {
  const p = ins.path;
  switch (g) {
    case 'operation':
      return LEARNING.has(p.phase) && ins.kind !== 'LOAD_INPUT' && !ins.kind.endsWith('_LAYER_END');
    case 'layer':
      return p.layer !== null && LEARNING.has(p.phase);
    case 'phase':
      return LEARNING.has(p.phase) || p.phase === 'update';
    case 'sample':
      return p.sample !== null;
    case 'batch':
      return p.batch !== null;
    case 'epoch':
      return p.epoch !== null;
  }
}

export interface SemanticMove {
  cursor: number;
  /** Inclusive id range of the interstitial instructions passed on the way, or null. */
  passed: [number, number] | null;
}

/**
 * One novice step over a trace. Forward: to the end of the next stop unit. Backward: to the end of the
 * previous stop unit, or before the start. Used directly by tests and figure scripts. The app's store runs
 * the same loop through the engine's `advance` request, and a unit test checks that the two agree.
 */
export function semanticStep(
  src: TraceSource,
  cursor: number,
  g: Granularity,
  direction: 1 | -1,
  /** Active breakpoints: as in the engine's `advance`, a forward step stops where one fires. */
  breakpoints: Breakpoint[] = [],
): SemanticMove {
  let c = cursor;
  let first: number | null = null;
  let last: number | null = null;
  for (;;) {
    let n = direction > 0 ? stepForward(src, c, g) : stepBackward(src, c, g);
    const hit = direction > 0 && breakpoints.length ? firstBreak(src, c, n, breakpoints) : null;
    if (hit) n = hit.id;
    if (hit || n === c || n < 0)
      return { cursor: n < 0 ? -1 : n, passed: passedRange(direction, first, last, n) };
    if (isStop(src.get(n), g)) return { cursor: n, passed: passedRange(direction, first, last, n) };
    first ??= direction > 0 ? c + 1 : n;
    last = n;
    c = n;
  }
}

/**
 * The passed range, given the first and last interstitial cursors of a step. Forward: from the old cursor + 1
 * to the last interstitial unit's end. Backward: from the final cursor + 1 to the first interstitial unit's end.
 */
export function passedRange(
  direction: 1 | -1,
  first: number | null,
  last: number | null,
  final: number,
): [number, number] | null {
  if (first === null || last === null) return null;
  return direction > 0 ? [first, last] : [Math.max(0, final + 1), first];
}

/** The passed instructions grouped into their units at step size g, in order. */
export function passedUnits(passed: readonly Instruction[], g: Granularity): Instruction[][] {
  const out: Instruction[][] = [];
  for (const ins of passed) {
    const prev = out.at(-1);
    if (prev && unitKey(prev[0], g) === unitKey(ins, g)) prev.push(ins);
    else out.push([ins]);
  }
  return out;
}

const value = (ins: Instruction): number | null => {
  const t = Object.values(ins.results)[0];
  return t && t.size === 1 ? t.data[0] : null;
};
const fmt = (x: number | null): string => (x === null ? '' : ` (${Number(x.toPrecision(4))})`);
const which = (ins: Instruction): string => (String(ins.meta.param).endsWith('.b') ? 'biases' : 'weights');

/**
 * One short phrase for a passed unit, in the novice vocabulary of experiment 1. It avoids layer, loss,
 * batch, gradient and backward, so the phrase is allowed on every screen.
 */
export function unitPhrase(unit: readonly Instruction[]): string {
  const ins = unit[0];
  switch (ins.path.phase) {
    case 'init':
      return 'the weights and biases got their starting values';
    case 'update':
      return 'the weights and biases took one step to reduce the error';
    case 'eval':
      return unit.some((x) => x.kind === 'EVAL_END')
        ? `the network was checked on all the examples${fmt(value(unit.find((x) => x.kind === 'EVAL_END')!))}`
        : 'the network was checked on all the examples';
  }
  return detailPhrase(ins);
}

/** One phrase per passed instruction, for the expanded view. */
export function detailPhrase(ins: Instruction): string {
  switch (ins.kind) {
    case 'INIT_PARAM':
      return `the ${which(ins)} got their starting values`;
    case 'EPOCH_BEGIN':
      return `pass ${(ins.path.epoch ?? 0) + 1} over the examples began`;
    case 'EPOCH_END':
      return `pass ${(ins.path.epoch ?? 0) + 1} over the examples ended`;
    case 'BATCH_BEGIN':
      return `a group of ${String(ins.meta.size)} examples began`;
    case 'BATCH_END':
      return 'that group of examples is done';
    case 'LOAD_INPUT':
      return `example #${Number(ins.meta.datasetIndex) + 1} was read in`;
    case 'COMPUTE_LOSS':
      return `the error for this example was measured${fmt(value(ins))}`;
    case 'LOSS_REDUCE':
      return `the errors of the group were averaged${fmt(value(ins))}`;
    case 'GRAD_INIT':
      return 'the correction started from the error';
    case 'GRAD_ACCUMULATE':
      return `the corrections for the ${which(ins)} were averaged over the group`;
    case 'OPTIMIZER_STATE':
      return `the running memory of corrections for the ${which(ins)} was updated`;
    case 'COMPUTE_UPDATE':
      return `the size of the step for the ${which(ins)} was worked out`;
    case 'APPLY_UPDATE':
      return `the ${which(ins)} moved`;
    case 'EVAL_BEGIN':
      return 'a check on all the examples began';
    case 'EVAL_END':
      return `the network was checked on all the examples${fmt(value(ins))}`;
    case 'FORWARD_LAYER_END':
      return 'that part of the calculation is finished';
    case 'BACKWARD_LAYER_END':
      return 'that part of the correction is finished';
    default:
      return 'one more calculation';
  }
}

/** The inline sentence for a step's passed units: at most three phrases, then "and N more" (all are in the expanded list). */
export function passedSentence(units: readonly (readonly Instruction[])[]): string {
  const phrases: string[] = [];
  for (const u of units) {
    const p = unitPhrase(u);
    if (phrases.at(-1) !== p) phrases.push(p);
  }
  const shown = phrases.slice(0, 3);
  const more = phrases.length - shown.length;
  return shown.join('; ') + (more > 0 ? `; and ${more} more` : '') + '.';
}

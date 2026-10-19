/**
 * Granularity unlocked by the curriculum (Fix Round 2, §2.3). The six step
 * sizes stay — they are the project's technical contribution — but each is
 * offered only from the experiment that teaches what it means, under a
 * learner-facing name. Expert mode always offers all six.
 */
import { GRANULARITIES, type Granularity } from '../core/npm/stats';
import { EXPERIMENTS } from './registry';
import type { Experiment } from './types';

export type Mode = 'novice' | 'expert';

/** Learner-facing names of the step sizes. */
export const LEVEL_LABEL: Record<Granularity, string> = {
  operation: 'one calculation',
  layer: 'one layer',
  phase: 'forward / backward / update',
  sample: 'one example',
  batch: 'one batch',
  epoch: 'one full pass',
};

/** Technical names, used in expert mode with the learner-facing name as secondary text. */
export const LEVEL_TECHNICAL: Record<Granularity, string> = {
  operation: 'Operation',
  layer: 'Layer',
  phase: 'Phase',
  sample: 'Example',
  batch: 'Batch',
  epoch: 'Epoch',
};

/** The experiment that first offers each step size. */
export const UNLOCKED_BY: Record<Granularity, string> = {
  operation: 'single-neuron',
  layer: 'forward-propagation',
  sample: 'gradient-descent',
  batch: 'gradient-descent',
  phase: 'backpropagation',
  epoch: 'xor-mlp',
};

const position = (id: string): number => EXPERIMENTS.findIndex((e) => e.id === id);

/** True if the step size has been taught by the time the learner reaches this experiment. */
export function isUnlocked(g: Granularity, exp: Experiment): boolean {
  return position(UNLOCKED_BY[g]) <= position(exp.id);
}

/** Step sizes on screen: the experiment's declared set on the novice path, all six in expert mode. */
export function offeredGranularities(exp: Experiment, mode: Mode): Granularity[] {
  if (mode === 'expert') return [...GRANULARITIES];
  return GRANULARITIES.filter((g) => exp.surface.granularities.includes(g));
}

/** The step size a run starts with: the experiment's default if it is offered, else the coarsest offered. */
export function startingGranularity(exp: Experiment, mode: Mode): Granularity {
  if (mode === 'novice' && exp.surface.start) return exp.surface.start;
  const offered = offeredGranularities(exp, mode);
  return offered.includes(exp.defaultGranularity) ? exp.defaultGranularity : offered[offered.length - 1];
}

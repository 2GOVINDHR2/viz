/**
 * The training failures DL-VizLab detects and turns into teachable stops.
 * One definition per pathology — its breakpoint and threshold — shared by the
 * UI toggles, the tests and docs/PATHOLOGIES.md, so the three cannot drift.
 */
import type { Breakpoint } from './breakpoints';

export interface Pathology {
  id: 'nonFinite' | 'exploding' | 'vanishing' | 'deadRelu' | 'lossIncrease';
  name: string;
  /** Checkbox label in the controls ("Stop when …"). */
  label: string;
  breakpoint: Breakpoint;
}

export const EXPLODING_THRESHOLD = 10;
export const VANISHING_THRESHOLD = 1e-4;
export const LOSS_INCREASE_FACTOR = 1.1;

export const PATHOLOGIES: readonly Pathology[] = [
  {
    id: 'nonFinite',
    name: 'NaN or infinite values',
    label: 'NaN or infinity appears',
    breakpoint: { type: 'nonFinite' },
  },
  {
    id: 'exploding',
    name: 'Exploding gradients',
    label: 'a gradient explodes (any |g| > 10)',
    breakpoint: { type: 'gradAbove', threshold: EXPLODING_THRESHOLD },
  },
  {
    id: 'vanishing',
    name: 'Vanishing gradients',
    label: 'a layer’s gradient vanishes (all |g| < 10⁻⁴)',
    breakpoint: { type: 'gradBelow', threshold: VANISHING_THRESHOLD },
  },
  {
    id: 'deadRelu',
    name: 'Dead ReLUs',
    label: 'a ReLU unit is inactive for a whole epoch',
    breakpoint: { type: 'deadRelu' },
  },
  {
    id: 'lossIncrease',
    name: 'Learning-rate divergence',
    label: 'the epoch loss rises by more than 10 %',
    breakpoint: { type: 'lossIncrease', factor: LOSS_INCREASE_FACTOR },
  },
];

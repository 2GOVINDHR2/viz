/**
 * The study instruments: the concept inventory (from its JSON file), the
 * standard System Usability Scale, raw NASA-TLX, and the feedback prompts.
 */
import inventory from './config/concept-inventory.json';
import { Rng } from '../core/rng/rng';
import { shuffle } from './randomise';
import type { FeedbackPrompt, TestForm, TlxScale } from './types';

export interface InventoryItem {
  id: string;
  concept: string;
  bloom: 'recall' | 'understand' | 'apply';
  stem: string;
  options: { text: string; misconception?: string }[];
  answer: number;
  transfer?: boolean;
  /** Reporting unit for gains (fundamentals, optimisation, backpropagation, convolutional). */
  cluster: string;
  /** Retired items stay in the file with a reason but are neither administered nor scored. */
  retired?: boolean;
}

const EVERY_ITEM: InventoryItem[] = [
  ...(inventory.items as InventoryItem[]),
  ...(inventory.transfer_items as InventoryItem[]).map((i) => ({ ...i, transfer: true })),
];
/** Administered items: retired ones are excluded from both tests. */
export const CORE_ITEMS = EVERY_ITEM.filter((i) => !i.transfer && !i.retired);
export const TRANSFER_ITEMS = EVERY_ITEM.filter((i) => i.transfer && !i.retired);
export const ALL_ITEMS: InventoryItem[] = [...CORE_ITEMS, ...TRANSFER_ITEMS];
/** Any item, retired ones included, so older exports remain readable. */
export const itemById = (id: string): InventoryItem => {
  const it = EVERY_ITEM.find((x) => x.id === id);
  if (!it) throw new Error(`unknown item ${id}`);
  return it;
};

/** The canonical option index behind the option shown at position `displayed` (0-based) for item `id`. */
export const displayToCanonical = (form: TestForm, id: string, displayed: number): number =>
  form.options[id][displayed];

/** A presentation form: shuffled item order and, per item, shuffled option order. The post-test adds the transfer items. */
export function makeForm(phase: 'pre' | 'post', rng: Rng): TestForm {
  const items = shuffle(phase === 'pre' ? CORE_ITEMS : ALL_ITEMS, rng).map((i) => i.id);
  const options: Record<string, number[]> = {};
  for (const id of items) options[id] = shuffle([0, 1, 2, 3], rng);
  return { items, options };
}

/** Standard SUS wording (Brooke, 1996), with "system" as in the original. Odd items positive, even items negative. */
export const SUS_ITEMS = [
  'I think that I would like to use this system frequently.',
  'I found the system unnecessarily complex.',
  'I thought the system was easy to use.',
  'I think that I would need the support of a technical person to be able to use this system.',
  'I found the various functions in this system were well integrated.',
  'I thought there was too much inconsistency in this system.',
  'I would imagine that most people would learn to use this system very quickly.',
  'I found the system very cumbersome to use.',
  'I felt very confident using the system.',
  'I needed to learn a lot of things before I could get going with this system.',
];

/** SUS score: Σ(odd − 1) + Σ(5 − even), × 2.5. Responses are 1–5, item 1 first. */
export function susScore(r: readonly number[]): number {
  if (r.length !== 10 || r.some((x) => !Number.isInteger(x) || x < 1 || x > 5))
    throw new Error('SUS needs ten responses in 1–5');
  let s = 0;
  r.forEach((x, k) => (s += k % 2 === 0 ? x - 1 : 5 - x));
  return s * 2.5;
}

/** NASA-TLX subscales (Hart & Staveland, 1988), raw (unweighted). */
export const TLX_ITEMS: { scale: TlxScale; title: string; question: string; low: string; high: string }[] = [
  {
    scale: 'mental',
    title: 'Mental demand',
    question: 'How mentally demanding was the task?',
    low: 'Very low',
    high: 'Very high',
  },
  {
    scale: 'physical',
    title: 'Physical demand',
    question: 'How physically demanding was the task?',
    low: 'Very low',
    high: 'Very high',
  },
  {
    scale: 'temporal',
    title: 'Temporal demand',
    question: 'How hurried or rushed was the pace of the task?',
    low: 'Very low',
    high: 'Very high',
  },
  {
    scale: 'performance',
    title: 'Performance',
    question: 'How successful were you in accomplishing what you were asked to do?',
    low: 'Perfect',
    high: 'Failure',
  },
  {
    scale: 'effort',
    title: 'Effort',
    question: 'How hard did you have to work to accomplish your level of performance?',
    low: 'Very low',
    high: 'Very high',
  },
  {
    scale: 'frustration',
    title: 'Frustration',
    question: 'How insecure, discouraged, irritated, stressed and annoyed were you?',
    low: 'Very low',
    high: 'Very high',
  },
];

export const tlxRaw = (t: Record<TlxScale, number>): number =>
  (t.mental + t.physical + t.temporal + t.performance + t.effort + t.frustration) / 6;

export const FEEDBACK_ITEMS: { prompt: FeedbackPrompt; text: string }[] = [
  { prompt: 'helped', text: 'What helped you understand the material?' },
  { prompt: 'confusing', text: 'What was confusing or difficult?' },
  { prompt: 'suggestions', text: 'What would you change or add?' },
];

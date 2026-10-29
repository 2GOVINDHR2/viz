/**
 * Learner-facing parameters (Fix Round 3, Part A; ADR-055). For every parameter an experiment declares, this
 * module gives:
 *  - its current value;
 *  - what a typed entry means (`validateParam`): the exact value, or a message naming the valid range;
 *  - how a valid value is applied (`applyParam`), to the training configuration, the dataset, or a panel probe.
 *
 * Rules (brief A3):
 *  - A typed value is used exactly as typed and is never clamped.
 *  - A value training can run is accepted even if it makes training diverge (a teachable event, NFR8).
 *  - Only values the engine cannot run are rejected, and the message says what is valid.
 *  - Presentation layer only: the engine, IR and trace format are unchanged.
 */
import type { DatasetSpec } from '../core/engine/protocol';
import * as D from '../core/engine/datasets';
import type { TrainConfig } from '../core/engine/session';
import { buildModel, type LayerConfig } from '../core/layers/model';
import { initialize } from '../core/rng/init';
import { Rng } from '../core/rng/rng';
import { MAX_WIDTH, reconcileInitialParams } from './architecture';
import { applyEdit } from './edits';
import type { EditableParam } from './types';

/** Everything a parameter can change. Probes are read by panels only. */
export interface Setting {
  config: TrainConfig;
  dataset: DatasetSpec;
  probes: Record<string, number>;
}

export type Validation = { ok: true; value: number | string } | { ok: false; message: string };

/**
 * The longest run accepted from a typed epoch count: a million instructions, about ten times the largest
 * shipped run. Longer runs take too long to generate in a browser session (ADR-055); the message says so.
 */
export const MAX_INSTRUCTIONS = 1_000_000;
export const MAX_DEPTH = 12;
export const MAX_FILTERS = 16;

const SEED_MAX = 2 ** 32 - 1;

/** A dataset spec as explicit points, so one example's features or target can be changed. */
export function asPoints(spec: DatasetSpec): Extract<DatasetSpec, { kind: 'points' }> {
  if (spec.kind === 'points') return spec;
  const d =
    spec.kind === 'xor'
      ? D.xor()
      : spec.kind === 'xorClusters'
        ? D.xorClusters(spec.n, spec.seed, spec.noise)
        : spec.kind === 'gaussians'
          ? D.gaussians(spec.n, spec.seed, spec.separation)
          : spec.kind === 'circles'
            ? D.circles(spec.n, spec.seed)
            : spec.kind === 'line'
              ? D.line(spec.n, spec.seed)
              : null;
  if (!d) throw new Error(`examples of a ${spec.kind} dataset cannot be edited`);
  const rows = (t: { shape: readonly number[]; data: ArrayLike<number> }): number[][] =>
    Array.from({ length: t.shape[0] }, (_, i) =>
      Array.from(t.data).slice(i * t.shape[1], (i + 1) * t.shape[1]),
    );
  return { kind: 'points', name: d.name, xs: rows(d.xs), ys: rows(d.ys) };
}

const probeKey = (p: Extract<EditableParam, { kind: 'probe' }>): string => p.id;

/** The seeded starting values the initialiser draws for this configuration (as the session does). */
export function seededStart(config: TrainConfig): Record<string, number[]> {
  const rng = new Rng(config.seed);
  const out: Record<string, number[]> = {};
  for (const p of buildModel(config.model).params)
    out[p.name] = Array.from(initialize(p.init, p.shape, rng).data);
  return out;
}

/** The current initialisation scale: the ratio of the given starting values to the seeded ones (1 if none). */
function currentScale(config: TrainConfig): number {
  const given = config.initialParams;
  if (!given) return 1;
  const seeded = seededStart({ ...config, initialParams: undefined });
  for (const [name, v] of Object.entries(given)) {
    const s = seeded[name];
    if (!s) continue;
    for (let k = 0; k < v.length; k++) if (s[k] !== 0 && Number.isFinite(v[k] / s[k])) return v[k] / s[k];
  }
  return 1;
}

function scaled(config: TrainConfig, factor: number): TrainConfig {
  if (factor === 1) return { ...config, initialParams: undefined };
  const seeded = seededStart({ ...config, initialParams: undefined });
  return {
    ...config,
    initialParams: Object.fromEntries(Object.entries(seeded).map(([n, v]) => [n, v.map((x) => x * factor)])),
  };
}

const hiddenLayers = (config: TrainConfig): LayerConfig[] => config.model.layers.slice(0, -1);

export function paramValue(s: Setting, p: EditableParam): number | string {
  switch (p.kind) {
    case 'epochs':
      return s.config.epochs;
    case 'seed':
      return s.config.seed;
    case 'depth':
      return hiddenLayers(s.config).length;
    case 'initScale':
      return currentScale(s.config);
    case 'conv': {
      const l = s.config.model.layers[p.layer];
      if (l.type !== 'conv2d') return '';
      return p.field === 'filters'
        ? l.filters
        : p.field === 'kernel'
          ? l.kernel
          : (l[p.field] ?? (p.field === 'stride' ? 1 : 0));
    }
    case 'input':
      return asPoints(s.dataset).xs[p.example][p.feature];
    case 'target':
      return asPoints(s.dataset).ys[p.example][0];
    case 'probe':
      return s.probes[probeKey(p)] ?? p.initial;
    case 'learningRate':
      return s.config.optimizer.lr;
    case 'loss':
      return s.config.loss;
    case 'activation': {
      const l = s.config.model.layers[p.layer === -1 ? 0 : p.layer];
      return l.type === 'dense' || l.type === 'conv2d' ? l.activation : '';
    }
    case 'hiddenUnits': {
      const l = s.config.model.layers[p.layer];
      return l.type === 'dense' ? l.units : 0;
    }
    case 'batchSize':
      return s.config.batchSize;
    case 'initialValue':
      return s.config.initialParams?.[p.param]?.[p.index] ?? 0;
  }
}

const integerKinds = new Set(['epochs', 'seed', 'depth', 'conv', 'hiddenUnits', 'batchSize']);

/** Training examples in each bundled dataset asset (src/experiments/data). */
const ASSET_SIZES: Record<string, number> = { 'mnist-012': 1500 };

/** Number of training examples of a dataset spec (for the batch-size range). */
function datasetSize(spec: DatasetSpec): number | null {
  if (spec.kind === 'points') return spec.xs.length;
  if (spec.kind === 'xor') return 4;
  if ('n' in spec && typeof spec.n === 'number') return spec.n;
  return spec.kind === 'asset' ? (ASSET_SIZES[spec.name] ?? null) : null;
}

/**
 * The valid range of a numeric parameter, as shown to the learner, and whether a value is in it. `perEpoch` is
 * the current run's instructions per epoch, for the epoch limit.
 */
export function paramRange(
  s: Setting,
  p: EditableParam,
  perEpoch = 0,
): { text: string; accepts(v: number): boolean } | null {
  const int = (lo: number, hi: number, why = ''): { text: string; accepts(v: number): boolean } => ({
    text: `a whole number from ${lo} to ${hi}${why}`,
    accepts: (v) => Number.isInteger(v) && v >= lo && v <= hi,
  });
  switch (p.kind) {
    case 'epochs': {
      const max = perEpoch > 0 ? Math.max(1, Math.floor(MAX_INSTRUCTIONS / perEpoch)) : 1000;
      return int(1, max, ' (longer runs would not fit in a browser session)');
    }
    case 'seed':
      return int(0, SEED_MAX);
    case 'depth':
      return int(1, MAX_DEPTH);
    case 'hiddenUnits':
      return int(1, MAX_WIDTH);
    case 'batchSize': {
      const n = datasetSize(s.dataset);
      return int(1, n ?? 10_000, n ? ` (the number of training examples)` : '');
    }
    case 'conv':
      return p.field === 'filters'
        ? int(1, MAX_FILTERS)
        : p.field === 'padding'
          ? int(0, 8)
          : int(1, p.field === 'kernel' ? 9 : 4);
    case 'probe':
      if (p.min !== undefined && p.max !== undefined)
        return { text: `a number from ${p.min} to ${p.max}`, accepts: (v) => v >= p.min! && v <= p.max! };
      return null;
    default:
      return null;
  }
}

/** Parses a typed entry. Accepts the minus sign "−" and surrounding spaces; rejects anything else non-numeric. */
export function parseNumber(raw: string): number | null {
  const t = raw.trim().replace(/−/g, '-');
  if (t === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

/**
 * What a typed or chosen entry means for this parameter: the exact value, or a message naming what is valid.
 * Divergent values (a huge learning rate, a huge starting weight) are valid: training runs them.
 */
export function validateParam(s: Setting, p: EditableParam, raw: string, perEpoch = 0): Validation {
  if (p.kind === 'activation' || p.kind === 'loss') {
    const opts = p.options as string[];
    return opts.includes(raw)
      ? { ok: true, value: raw }
      : { ok: false, message: `Choose one of: ${opts.join(', ')}.` };
  }
  const v = parseNumber(raw);
  const range = paramRange(s, p, perEpoch);
  if (v === null)
    return {
      ok: false,
      message: range
        ? `Enter ${range.text}.`
        : 'Enter a number, such as 0.3, −2 or 1e-3 (any size is allowed, even one that makes training diverge).',
    };
  if (range && !range.accepts(v))
    return { ok: false, message: `Enter ${range.text}; ${raw.trim()} is outside it.` };
  if (!range && integerKinds.has(p.kind) && !Number.isInteger(v))
    return { ok: false, message: 'Enter a whole number.' };
  // Cross-entropy needs a target probability: a target outside 0–1 makes the loss meaningless (log of a negative).
  if (p.kind === 'target' && s.config.loss === 'bce' && (v < 0 || v > 1))
    return {
      ok: false,
      message: `Enter a target from 0 to 1 (cross-entropy compares probabilities); ${raw.trim()} is outside it.`,
    };
  // A convolution change must still give every later layer a positive size.
  if (p.kind === 'conv' || p.kind === 'depth') {
    try {
      buildModel(applyParam(s, p, v).config.model);
    } catch (e) {
      return {
        ok: false,
        message: `That gives a layer of size 0 or less (${e instanceof Error ? e.message : String(e)}); try a smaller kernel or stride, or more padding.`,
      };
    }
  }
  return { ok: true, value: v };
}

/** Applies a valid value. Panel probes change only `probes`; everything else regenerates the run. */
export function applyParam(s: Setting, p: EditableParam, value: number | string): Setting {
  const v = Number(value);
  switch (p.kind) {
    case 'epochs':
      return { ...s, config: { ...s.config, epochs: v } };
    case 'seed': {
      // A new seed draws new starting values, except those the learner set explicitly (initialValue).
      return { ...s, config: { ...s.config, seed: v } };
    }
    case 'depth': {
      const layers = s.config.model.layers;
      const hidden = layers.slice(0, -1);
      const out = layers[layers.length - 1];
      const next = Array.from({ length: v }, (_, k) => ({
        ...(hidden[Math.min(k, hidden.length - 1)] ?? hidden[0]),
      }));
      const scale = currentScale(s.config);
      const config: TrainConfig = {
        ...s.config,
        initialParams: undefined,
        model: { ...s.config.model, layers: [...next, out] },
      };
      // The initialisation scale carries over to the new architecture.
      return { ...s, config: scale === 1 ? config : scaled(config, scale) };
    }
    case 'initScale':
      return { ...s, config: scaled(s.config, v) };
    case 'conv': {
      const layers = s.config.model.layers.map((l) => ({ ...l })) as LayerConfig[];
      const l = layers[p.layer];
      if (l.type === 'conv2d') layers[p.layer] = { ...l, [p.field]: v };
      const after: TrainConfig = { ...s.config, model: { ...s.config.model, layers } };
      return { ...s, config: reconcileInitialParams(s.config, after) };
    }
    case 'input': {
      const pts = asPoints(s.dataset);
      const xs = pts.xs.map((r) => [...r]);
      xs[p.example][p.feature] = v;
      return { ...s, dataset: { ...pts, xs } };
    }
    case 'target': {
      const pts = asPoints(s.dataset);
      const ys = pts.ys.map((r) => [...r]);
      ys[p.example][0] = v;
      return { ...s, dataset: { ...pts, ys } };
    }
    case 'probe':
      return { ...s, probes: { ...s.probes, [probeKey(p)]: v } };
    case 'learningRate':
    case 'loss':
    case 'activation':
    case 'hiddenUnits':
    case 'batchSize':
    case 'initialValue':
      return { ...s, config: applyEdit(s.config, p, value) };
  }
}

/** True when applying this parameter regenerates the run (everything except a panel probe). */
export const regenerates = (p: EditableParam): boolean => p.kind !== 'probe';

/** The learner-facing label, in the vocabulary of the experiment that shows it (checked by the vocabulary test). */
export function paramLabel(p: EditableParam): string {
  if (p.label) return p.label;
  switch (p.kind) {
    case 'learningRate':
      return 'Learning rate η';
    case 'loss':
      return 'Loss function';
    case 'activation':
      return p.layer === -1 ? 'Hidden activations' : `Activation of layer ${p.layer + 1}`;
    case 'hiddenUnits':
      return `Units in hidden layer ${p.layer + 1}`;
    case 'batchSize':
      return 'Batch size B';
    case 'initialValue':
    case 'input':
    case 'target':
    case 'probe':
      return p.label;
    case 'epochs':
      return 'Epochs (passes over the data)';
    case 'seed':
      return 'Random seed (the starting point of the random numbers)';
    case 'depth':
      return 'Hidden layers (depth)';
    case 'initScale':
      return 'Starting-weight scale (1 = the usual size)';
    case 'conv':
      return {
        filters: 'Number of kernels',
        kernel: 'Kernel size (pixels per side)',
        stride: 'Stride (pixels the window moves)',
        padding: 'Padding (zero pixels added at each edge)',
      }[p.field];
  }
}

/** Preset values offered beside a numeric field (never a limit). */
export function paramPresets(p: EditableParam): (number | string)[] {
  return 'options' in p && p.options ? (p.options as (number | string)[]) : [];
}

/** True for parameters entered as a number (typed), false for a choice from a list. */
export const isNumeric = (p: EditableParam): boolean => p.kind !== 'activation' && p.kind !== 'loss';

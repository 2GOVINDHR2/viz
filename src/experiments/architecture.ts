/**
 * Architecture and starting-value edits as pure functions on a TrainConfig
 * (Fix Round 2b, defect 1). The structure view, the parameter editor, the
 * invariant tests and the fuzzer all go through these, so a contract that
 * holds at load also holds after every mutation.
 *
 * Starting values the learner set (`initialParams`) are kept only where they
 * still mean the same parameter: same layer position, unchanged layers before
 * it, and the same shape. Anything else is dropped and the parameter returns
 * to its seeded initialiser — never a stale array of the wrong size.
 */
import type { TrainConfig } from '../core/engine/session';
import { buildModel, type Activation, type LayerConfig, type ParamSpec } from '../core/layers/model';

type Dense = Extract<LayerConfig, { type: 'dense' }>;

export const MAX_HIDDEN = 6;
export const MAX_WIDTH = 32;

export const trainableParams = (config: TrainConfig): ParamSpec[] => buildModel(config.model).params;

const size = (shape: number[]): number => shape.reduce((a, b) => a * b, 1);

/** Drops starting values that no longer describe the same parameter after `after` replaced `before`. */
export function reconcileInitialParams(before: TrainConfig, after: TrainConfig): TrainConfig {
  if (!after.initialParams) return after;
  const a = before.model.layers;
  const b = after.model.layers;
  let firstChanged = 0;
  while (
    firstChanged < Math.min(a.length, b.length) &&
    JSON.stringify(a[firstChanged]) === JSON.stringify(b[firstChanged])
  )
    firstChanged++;
  const sameInputs = JSON.stringify(before.model.inputShape) === JSON.stringify(after.model.inputShape);
  const params = new Map(trainableParams(after).map((p) => [p.name, p]));
  const kept: Record<string, number[]> = {};
  for (const [name, values] of Object.entries(after.initialParams)) {
    const p = params.get(name);
    const layerIndex = Number(name.slice(1, name.indexOf('.'))) - 1;
    // Only an activation change leaves a layer's own parameters meaningful (and the next layer's shapes unchanged).
    const activationOnly =
      layerIndex === firstChanged &&
      a.length === b.length &&
      a[layerIndex]?.type === 'dense' &&
      b[layerIndex]?.type === 'dense' &&
      (a[layerIndex] as Dense).units === (b[layerIndex] as Dense).units;
    if (p && size(p.shape) === values.length && sameInputs && (layerIndex < firstChanged || activationOnly))
      kept[name] = values;
  }
  return { ...after, initialParams: Object.keys(kept).length ? kept : undefined };
}

const withLayers = (config: TrainConfig, layers: LayerConfig[]): TrainConfig =>
  reconcileInitialParams(config, { ...config, model: { ...config.model, layers } });

const hidden = (config: TrainConfig): Dense[] => config.model.layers.slice(0, -1) as Dense[];
const output = (config: TrainConfig): LayerConfig => config.model.layers[config.model.layers.length - 1];

export function addHiddenLayer(config: TrainConfig, units = 4, activation: Activation = 'tanh'): TrainConfig {
  if (hidden(config).length >= MAX_HIDDEN) return config;
  return withLayers(config, [...hidden(config), { type: 'dense', units, activation }, output(config)]);
}

export function removeHiddenLayer(config: TrainConfig, k: number): TrainConfig {
  const h = hidden(config);
  if (k < 0 || k >= h.length) return config;
  return withLayers(config, [...h.filter((_, q) => q !== k), output(config)]);
}

export function setHiddenWidth(config: TrainConfig, k: number, units: number): TrainConfig {
  const h = hidden(config);
  if (k < 0 || k >= h.length) return config;
  const u = Math.max(1, Math.min(MAX_WIDTH, Math.round(units) || 1));
  return withLayers(config, [...h.map((l, q) => (q === k ? { ...l, units: u } : l)), output(config)]);
}

export function setHiddenActivation(config: TrainConfig, k: number, activation: Activation): TrainConfig {
  const h = hidden(config);
  if (k < 0 || k >= h.length) return config;
  // The initialiser follows the activation, so an explicit one is cleared.
  return withLayers(config, [
    ...h.map((l, q) => (q === k ? { ...l, activation, init: undefined } : l)),
    output(config),
  ]);
}

/**
 * Sets the starting values of one parameter (row-major, the trace's layout). `current` is the parameter's
 * full current starting array (from the trace's INIT_PARAM); the rest of the run keeps its seeded values.
 */
export function setStartingValue(
  config: TrainConfig,
  param: string,
  current: readonly number[],
  index: number,
  value: number,
): TrainConfig {
  const p = trainableParams(config).find((x) => x.name === param);
  if (!p) throw new Error(`no trainable parameter ${param}`);
  if (current.length !== size(p.shape))
    throw new Error(`${param} needs ${size(p.shape)} values, got ${current.length}`);
  if (index < 0 || index >= current.length) throw new Error(`${param}[${index}] is out of range`);
  const values = [...current];
  values[index] = value;
  return { ...config, initialParams: { ...(config.initialParams ?? {}), [param]: values } };
}

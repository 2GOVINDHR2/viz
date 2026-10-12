/**
 * Declarative model description and its forward pass on the autodiff tape.
 *
 * Shapes are per-sample (no batch axis); the forward pass adds a leading batch
 * axis of size N. Dense layers see [N, features]; conv/pool see [N, C, H, W].
 */
import type { Tape, Var } from '../autodiff';
import type { InitializerName } from '../rng/init';
import { conv2dOutputSize } from '../tensor/ops';
import { ShapeError } from '../tensor/tensor';

export type Activation = 'linear' | 'sigmoid' | 'tanh' | 'relu' | 'softmax';

export type LayerConfig =
  | { type: 'dense'; units: number; activation: Activation; init?: InitializerName }
  | {
      type: 'conv2d';
      filters: number;
      kernel: number;
      stride?: number;
      padding?: number;
      activation: Activation;
      init?: InitializerName;
    }
  | { type: 'pool'; mode: 'max' | 'avg'; size: number; stride?: number }
  | { type: 'flatten' };

export interface ModelConfig {
  /** Per-sample input shape: [features] for dense nets, [C, H, W] for conv nets. */
  inputShape: number[];
  layers: LayerConfig[];
}

export interface ParamSpec {
  /** Globally unique, e.g. "L2.W". */
  name: string;
  layer: string;
  role: 'weight' | 'bias';
  shape: number[];
  init: InitializerName;
}

export interface BuiltLayer {
  name: string;
  index: number;
  config: LayerConfig;
  inShape: number[];
  outShape: number[];
  params: ParamSpec[];
}

export interface Model {
  config: ModelConfig;
  layers: BuiltLayer[];
  params: ParamSpec[];
  outputShape: number[];
}

function defaultInit(activation: Activation): InitializerName {
  // He initialisation keeps ReLU activations' variance stable; Glorot suits saturating units.
  return activation === 'relu' ? 'heUniform' : 'glorotUniform';
}

export function buildModel(config: ModelConfig): Model {
  let shape = [...config.inputShape];
  const layers: BuiltLayer[] = config.layers.map((lc, i) => {
    const name = `L${i + 1}`;
    const inShape = shape;
    let outShape: number[];
    const params: ParamSpec[] = [];
    switch (lc.type) {
      case 'dense': {
        if (inShape.length !== 1)
          throw new ShapeError(
            `${name}: dense layer needs a flat input, got [${inShape}]; add a flatten layer`,
          );
        outShape = [lc.units];
        params.push(
          {
            name: `${name}.W`,
            layer: name,
            role: 'weight',
            shape: [inShape[0], lc.units],
            init: lc.init ?? defaultInit(lc.activation),
          },
          { name: `${name}.b`, layer: name, role: 'bias', shape: [lc.units], init: 'zeros' },
        );
        break;
      }
      case 'conv2d': {
        if (inShape.length !== 3)
          throw new ShapeError(`${name}: conv2d needs [C, H, W] input, got [${inShape}]`);
        const [c, h, w] = inShape;
        const s = lc.stride ?? 1;
        const p = lc.padding ?? 0;
        outShape = [lc.filters, conv2dOutputSize(h, lc.kernel, s, p), conv2dOutputSize(w, lc.kernel, s, p)];
        params.push(
          {
            name: `${name}.W`,
            layer: name,
            role: 'weight',
            shape: [lc.filters, c, lc.kernel, lc.kernel],
            init: lc.init ?? defaultInit(lc.activation),
          },
          { name: `${name}.b`, layer: name, role: 'bias', shape: [lc.filters], init: 'zeros' },
        );
        break;
      }
      case 'pool': {
        if (inShape.length !== 3)
          throw new ShapeError(`${name}: pool needs [C, H, W] input, got [${inShape}]`);
        const s = lc.stride ?? lc.size;
        outShape = [
          inShape[0],
          conv2dOutputSize(inShape[1], lc.size, s, 0),
          conv2dOutputSize(inShape[2], lc.size, s, 0),
        ];
        break;
      }
      case 'flatten':
        outShape = [inShape.reduce((a, b) => a * b, 1)];
        break;
    }
    shape = outShape;
    return { name, index: i, config: lc, inShape, outShape, params };
  });
  return { config, layers, params: layers.flatMap((l) => l.params), outputShape: shape };
}

export function layerActivation(layer: BuiltLayer): Activation | null {
  const c = layer.config;
  return c.type === 'dense' || c.type === 'conv2d' ? c.activation : null;
}

export interface ForwardResult {
  output: Var;
  /** Pre-activation of the final layer; the fused softmax–cross-entropy loss consumes this. */
  logits: Var;
}

/**
 * Records the forward pass on `tape`. When `fuseSoftmax` is set, the final
 * softmax is recorded as display-only (off the gradient path) because the loss
 * applies it internally.
 */
export function forward(
  model: Model,
  tape: Tape,
  x: Var,
  params: ReadonlyMap<string, Var>,
  fuseSoftmax = false,
): ForwardResult {
  let h = x;
  let logits = x;
  const last = model.layers.length - 1;
  for (const layer of model.layers) {
    const c = layer.config;
    const meta = { layer: layer.name };
    const p = (role: string): Var => {
      const v = params.get(`${layer.name}.${role}`);
      if (!v) throw new Error(`missing parameter ${layer.name}.${role}`);
      return v;
    };
    switch (c.type) {
      case 'dense':
      case 'conv2d': {
        const z0 =
          c.type === 'dense'
            ? tape.apply('matmul', [h, p('W')], {}, meta)
            : tape.apply('conv2d', [h, p('W')], { stride: c.stride ?? 1, padding: c.padding ?? 0 }, meta);
        const z = tape.apply('addBias', [z0, p('b')], {}, meta);
        logits = z;
        const displayOnly = fuseSoftmax && layer.index === last && c.activation === 'softmax';
        h = tape.apply(c.activation, [z], {}, displayOnly ? { ...meta, onGradientPath: false } : meta);
        if (displayOnly) return { output: h, logits: z };
        break;
      }
      case 'pool':
        h = tape.apply(
          c.mode === 'max' ? 'maxPool2d' : 'avgPool2d',
          [h],
          { size: c.size, stride: c.stride ?? c.size },
          meta,
        );
        break;
      case 'flatten': {
        const n = h.value.shape[0];
        h = tape.apply('reshape', [h], { shape: `${n},${layer.outShape[0]}` }, meta);
        break;
      }
    }
  }
  return { output: h, logits };
}

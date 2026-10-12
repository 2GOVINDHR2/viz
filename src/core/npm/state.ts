/**
 * Reconstruction of the visible execution state at a cursor (NPM-SPEC §5.4).
 *
 * The state after instruction k is a fold over the trace, but it never needs
 * the whole prefix: parameter versions are found in the cursor's segment or
 * the one before it (every batch ends by updating every parameter), and the
 * current sample's activations and gradients lie within the cursor's segment.
 * Views render from this state alone; it reads nothing but the trace.
 */
import type { Tensor } from '../tensor/tensor';
import type { Instruction, NestPath } from './ir';
import type { TraceSource } from './source';

export interface LayerState {
  /** Weighted input before the bias (u = a·W or a ⋆ K). */
  u?: Tensor;
  /** Pre-activation (z = u + b). */
  z?: Tensor;
  /** Layer output (activation, pooled map or flattened vector). */
  a?: Tensor;
  /** ∂ℓ/∂a of this layer's output. */
  gradA?: Tensor;
  /** ∂ℓ/∂z of this layer. */
  gradZ?: Tensor;
  gradW?: Tensor;
  gradB?: Tensor;
  /** ∂ℓ/∂(input of this layer), sent back to the previous layer. */
  gradIn?: Tensor;
}

export interface UpdateState {
  grad?: Tensor;
  velocity?: Tensor;
  delta?: Tensor;
  before?: Tensor;
  after?: Tensor;
}

export interface ExecState {
  cursor: number;
  current: Instruction | null;
  path: NestPath | null;
  /** Current version of every initialised parameter, with the id of the instruction that produced it. */
  params: Record<string, { value: Tensor; producedBy: number }>;
  sample: {
    datasetIndex: number;
    x: Tensor;
    y: Tensor;
    layers: Record<string, LayerState>;
    loss?: number;
    /** ∂ℓ/∂(network output), or ∂ℓ/∂(logits) when the loss is fused with softmax. */
    gradOutput?: Tensor;
    gradOutputWrt?: 'output' | 'logits';
    /** Last instruction of this sample that has executed. */
    progress: number;
  } | null;
  batchLoss?: number;
  updates: Record<string, UpdateState>;
  eval?: { loss: number; accuracy: number | null; boundary: Tensor | null; bounds: number[] | null };
}

const PARAM_PRODUCERS = new Set(['INIT_PARAM', 'APPLY_UPDATE']);

export function reconstructState(src: TraceSource, cursor: number): ExecState {
  const state: ExecState = { cursor, current: null, path: null, params: {}, sample: null, updates: {} };
  if (cursor < 0) return state;
  const [s] = src.segmentBounds(cursor);
  const ins = src.range(s, cursor + 1);
  const current = ins[ins.length - 1];
  state.current = current;
  state.path = current.path;

  // Parameters: newest version at or before the cursor.
  const wanted = new Set(src.header.model.params.map((p) => p.name));
  const take = (list: Instruction[]): void => {
    for (let k = list.length - 1; k >= 0 && wanted.size > 0; k--) {
      const i = list[k];
      const name = String(i.meta.param);
      if (PARAM_PRODUCERS.has(i.kind) && wanted.has(name)) {
        state.params[name] = { value: i.results.value, producedBy: i.id };
        wanted.delete(name);
      }
    }
  };
  take(ins);
  if (wanted.size > 0 && s > 0) {
    const [ps] = src.segmentBounds(s - 1);
    take(src.range(ps, s));
  }

  // Current sample: fold from its LOAD_INPUT.
  let k0 = -1;
  for (let k = ins.length - 1; k >= 0; k--)
    if (ins[k].kind === 'LOAD_INPUT') {
      k0 = k;
      break;
    }
  if (k0 >= 0) {
    const load = ins[k0];
    const sample: NonNullable<ExecState['sample']> = {
      datasetIndex: Number(load.meta.datasetIndex),
      x: load.results.x,
      y: load.results.y,
      layers: {},
      progress: load.id,
    };
    const L = (i: Instruction): LayerState => (sample.layers[i.path.layer as string] ??= {});
    const layerNames = src.header.model.layers.map((l) => l.name);
    for (const i of ins.slice(k0 + 1)) {
      if (i.path.sample === null) break;
      sample.progress = i.id;
      switch (i.kind) {
        case 'MATMUL':
        case 'CONV2D':
          L(i).u = i.results.out;
          break;
        case 'ADD_BIAS':
          L(i).z = i.results.out;
          break;
        case 'ACTIVATE':
        case 'POOL':
        case 'FLATTEN':
          L(i).a = i.results.out;
          break;
        case 'COMPUTE_LOSS':
          sample.loss = i.results.loss.item();
          break;
        case 'GRAD_INIT': {
          sample.gradOutput = i.results.grad;
          sample.gradOutputWrt = i.meta.wrt === 'logits' ? 'logits' : 'output';
          const last = layerNames[layerNames.length - 1];
          const ls = (sample.layers[last] ??= {});
          if (i.meta.wrt === 'logits') ls.gradZ = i.results.grad;
          else ls.gradA = i.results.grad;
          break;
        }
        case 'GRAD_ACTIVATE':
          L(i).gradZ = i.results.grad;
          break;
        case 'GRAD_BIAS':
          L(i).gradB = i.results.grad;
          break;
        case 'GRAD_MATMUL_W':
          L(i).gradW = i.results.grad;
          break;
        case 'GRAD_CONV2D':
          L(i).gradW = i.results.dW;
          if (i.results.dX) L(i).gradIn = i.results.dX;
          break;
        case 'GRAD_MATMUL_X':
        case 'GRAD_POOL':
        case 'GRAD_FLATTEN':
          L(i).gradIn = i.results.grad;
          break;
        default:
          break;
      }
      // What a layer sends back is the gradient of the previous layer's output.
      if (
        i.kind === 'GRAD_MATMUL_X' ||
        i.kind === 'GRAD_POOL' ||
        i.kind === 'GRAD_FLATTEN' ||
        (i.kind === 'GRAD_CONV2D' && i.results.dX)
      ) {
        const idx = layerNames.indexOf(i.path.layer as string);
        if (idx > 0)
          (sample.layers[layerNames[idx - 1]] ??= {}).gradA =
            i.kind === 'GRAD_CONV2D' ? i.results.dX : i.results.grad;
      }
    }
    state.sample = sample;
  }

  // Batch-level loss and updates, and evaluation results, within this segment.
  for (const i of ins) {
    const p = String(i.meta.param);
    switch (i.kind) {
      case 'LOSS_REDUCE':
        state.batchLoss = i.results.loss.item();
        break;
      case 'GRAD_ACCUMULATE':
        (state.updates[p] ??= {}).grad = i.results.grad;
        break;
      case 'OPTIMIZER_STATE':
        (state.updates[p] ??= {}).velocity = i.results.velocity;
        break;
      case 'COMPUTE_UPDATE':
        (state.updates[p] ??= {}).delta = i.results.delta;
        break;
      case 'APPLY_UPDATE': {
        const u = (state.updates[p] ??= {});
        u.before = src.get(i.operands[0].ref).results[i.operands[0].slot];
        u.after = i.results.value;
        break;
      }
      case 'EVAL_END':
        state.eval = {
          loss: i.results.loss.item(),
          accuracy: i.results.accuracy ? i.results.accuracy.item() : null,
          boundary: i.results.boundary ?? null,
          bounds: (i.meta.bounds as number[] | undefined) ?? null,
        };
        break;
      default:
        break;
    }
  }
  return state;
}

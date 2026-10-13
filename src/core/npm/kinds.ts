/**
 * Registration point 1 of the NPM extension model: instruction kinds and the
 * mapping from autodiff tape ops to the instructions they emit.
 *
 * A kind declares its phase, its result slots and how to render its symbolic
 * form. An op mapping says which kind a tape op emits in the forward pass and
 * which kinds (if any) its backward rule emits, with which result slot
 * carrying the gradient for which op input. The emitter is generic over these
 * tables; it has no per-op code.
 */
import { type Instruction, type InstructionKind, type Phase, layerNumber, sup } from './ir';

export interface KindSpec {
  kind: InstructionKind;
  phase: Phase;
  /** Result slot names this kind always produces. */
  results: readonly string[];
  /** One-line description used by the specification table and tooltips. */
  summary: string;
  symbolic(i: Omit<Instruction, 'symbolic'>): string;
}

export type OperandSource =
  { from: 'upstream' } | { from: 'input'; index: number } | { from: 'output' } | { from: 'loss' };

export interface BackwardEmission {
  kind: InstructionKind;
  /** Result slot → index of the op input whose gradient it holds. */
  slots: { slot: string; input: number }[];
  operands: { source: OperandSource; role: string }[];
}

export interface OpMapping {
  op: string;
  forwardKind: InstructionKind;
  /** Role of each op input in the forward instruction. */
  forwardRoles: readonly string[];
  backward: readonly BackwardEmission[];
  /** Inputs whose gradient equals the upstream gradient (no instruction needed), e.g. the pre-bias value. */
  passthrough?: readonly number[];
  meta?(
    attrs: Readonly<Record<string, number | string | boolean>>,
    op: string,
  ): Record<string, string | number | boolean>;
}

const kinds = new Map<string, KindSpec>();
const mappings = new Map<string, OpMapping>();

export function registerInstructionKind(spec: KindSpec): void {
  if (kinds.has(spec.kind)) throw new Error(`instruction kind ${spec.kind} registered twice`);
  kinds.set(spec.kind, spec);
}

export function registerOpMapping(m: OpMapping): void {
  if (mappings.has(m.op)) throw new Error(`op mapping for ${m.op} registered twice`);
  if (!kinds.has(m.forwardKind)) throw new Error(`op ${m.op} maps to unregistered kind ${m.forwardKind}`);
  for (const b of m.backward)
    if (!kinds.has(b.kind)) throw new Error(`op ${m.op} maps to unregistered kind ${b.kind}`);
  mappings.set(m.op, m);
}

export function kindSpec(kind: InstructionKind): KindSpec {
  const s = kinds.get(kind);
  if (!s) throw new Error(`unregistered instruction kind ${kind}`);
  return s;
}

export function opMapping(op: string): OpMapping {
  const m = mappings.get(op);
  if (!m) throw new Error(`op ${op} has no NPM mapping; register one with registerOpMapping`);
  return m;
}

export const registeredKinds = (): KindSpec[] => [...kinds.values()];
export const registeredMappings = (): OpMapping[] => [...mappings.values()];

// ------------------------------------------------------------------ built-ins

const L = (i: Omit<Instruction, 'symbolic'>): number => layerNumber(i.path.layer);
const s = (n: number): string => sup(n);
const str = (v: unknown): string => String(v ?? '');
const ACT_SYMBOL: Record<string, string> = {
  sigmoid: 'σ',
  tanh: 'tanh',
  relu: 'ReLU',
  linear: 'id',
  softmax: 'softmax',
};
const LOSS_SYMBOL: Record<string, string> = { mse: 'MSE', bce: 'BCE', cce: 'CE' };
/** Parameter "L2.W" → "W²". */
const paramSym = (name: unknown): string => {
  const [layer, role] = str(name).split('.');
  return `${role === 'W' || role === 'b' ? role : role === 'gamma' ? 'γ' : role === 'beta' ? 'β' : role}${s(layerNumber(layer))}`;
};

const builtins: KindSpec[] = [
  {
    kind: 'INIT_PARAM',
    phase: 'init',
    results: ['value'],
    summary: 'Initialise one parameter tensor from a seeded distribution.',
    symbolic: (i) => `${paramSym(i.meta.param)} ~ ${str(i.meta.initializer)}`,
  },
  {
    kind: 'LOAD_INPUT',
    phase: 'forward',
    results: ['x', 'y'],
    summary: 'Load one training example and its target.',
    symbolic: (i) => `a⁰ = x⁽${str(i.meta.datasetIndex)}⁾, y = y⁽${str(i.meta.datasetIndex)}⁾`,
  },
  {
    kind: 'MATMUL',
    phase: 'forward',
    results: ['out'],
    summary: 'Multiply the incoming activations by the layer weight matrix.',
    symbolic: (i) => `u${s(L(i))} = a${s(L(i) - 1)} · W${s(L(i))}`,
  },
  {
    kind: 'CONV2D',
    phase: 'forward',
    results: ['out'],
    summary: 'Slide each kernel over the input and take dot products (cross-correlation).',
    symbolic: (i) =>
      `u${s(L(i))} = a${s(L(i) - 1)} ⋆ K${s(L(i))}  (stride ${str(i.meta.stride)}, pad ${str(i.meta.padding)})`,
  },
  {
    kind: 'ADD_BIAS',
    phase: 'forward',
    results: ['out'],
    summary: 'Add the bias of each unit (or channel).',
    symbolic: (i) => `z${s(L(i))} = u${s(L(i))} + b${s(L(i))}`,
  },
  {
    kind: 'ACTIVATE',
    phase: 'forward',
    results: ['out'],
    summary: 'Apply the activation function element-wise (softmax: per row).',
    symbolic: (i) => `a${s(L(i))} = ${ACT_SYMBOL[str(i.meta.fn)] ?? str(i.meta.fn)}(z${s(L(i))})`,
  },
  {
    kind: 'POOL',
    phase: 'forward',
    results: ['out'],
    summary: 'Down-sample each channel by taking the max (or mean) of each window.',
    symbolic: (i) =>
      `a${s(L(i))} = ${str(i.meta.mode)}pool_${str(i.meta.size)}×${str(i.meta.size)}(a${s(L(i) - 1)})`,
  },
  {
    kind: 'FLATTEN',
    phase: 'forward',
    results: ['out'],
    summary: 'Reshape feature maps into one vector (channel-major).',
    symbolic: (i) => `a${s(L(i))} = vec(a${s(L(i) - 1)})`,
  },
  {
    kind: 'FORWARD_LAYER_END',
    phase: 'forward',
    results: [],
    summary: 'Marks the end of one layer in the forward pass.',
    symbolic: (i) => `end of forward pass through layer ${L(i)}`,
  },
  {
    kind: 'COMPUTE_LOSS',
    phase: 'loss',
    results: ['loss'],
    summary: "Compare this example's prediction with its target.",
    symbolic: (i) =>
      i.meta.loss === 'cce'
        ? `ℓ = CE(softmax(z${s(Number(i.meta.outputLayer))}), y)`
        : `ℓ = ${LOSS_SYMBOL[str(i.meta.loss)]}(ŷ, y)`,
  },
  {
    kind: 'LOSS_REDUCE',
    phase: 'loss',
    results: ['loss'],
    summary: 'Average the per-example losses over the mini-batch.',
    symbolic: () => 'L = (1/B) Σₛ ℓₛ',
  },
  {
    kind: 'GRAD_INIT',
    phase: 'backward',
    results: ['grad'],
    summary: 'Start back-propagation: the gradient of the loss with respect to the network output.',
    symbolic: (i) =>
      i.meta.wrt === 'logits'
        ? `∂ℓ/∂z${s(Number(i.meta.outputLayer))} = softmax(z${s(Number(i.meta.outputLayer))}) − y`
        : `∂ℓ/∂ŷ = ${LOSS_SYMBOL[str(i.meta.loss)]}′(ŷ, y)`,
  },
  {
    kind: 'GRAD_ACTIVATE',
    phase: 'backward',
    results: ['grad'],
    summary: "Multiply the upstream gradient by the activation's derivative.",
    symbolic: (i) =>
      `∂ℓ/∂z${s(L(i))} = ∂ℓ/∂a${s(L(i))} ⊙ ${ACT_SYMBOL[str(i.meta.fn)] ?? str(i.meta.fn)}′(z${s(L(i))})`,
  },
  {
    kind: 'GRAD_BIAS',
    phase: 'backward',
    results: ['grad'],
    summary: "The bias gradient is the upstream gradient (summed over a channel's positions).",
    symbolic: (i) => `∂ℓ/∂b${s(L(i))} = Σ ∂ℓ/∂z${s(L(i))}`,
  },
  {
    kind: 'GRAD_MATMUL_W',
    phase: 'backward',
    results: ['grad'],
    summary: 'Weight gradient: outer product of the layer input and the upstream gradient.',
    symbolic: (i) => `∂ℓ/∂W${s(L(i))} = (a${s(L(i) - 1)})ᵀ · ∂ℓ/∂z${s(L(i))}`,
  },
  {
    kind: 'GRAD_MATMUL_X',
    phase: 'backward',
    results: ['grad'],
    summary: 'Send the gradient back to the previous layer through the transposed weights.',
    symbolic: (i) => `∂ℓ/∂a${s(L(i) - 1)} = ∂ℓ/∂z${s(L(i))} · (W${s(L(i))})ᵀ`,
  },
  {
    kind: 'GRAD_CONV2D',
    phase: 'backward',
    results: ['dW'],
    summary:
      'Kernel gradient (input ⋆ upstream) and, if needed, input gradient (full convolution with the kernel).',
    symbolic: (i) =>
      `∂ℓ/∂K${s(L(i))} = a${s(L(i) - 1)} ⋆ ∂ℓ/∂u${s(L(i))}${i.results.dX ? `,  ∂ℓ/∂a${s(L(i) - 1)} = ∂ℓ/∂u${s(L(i))} ∗ rot180(K${s(L(i))})` : ''}`,
  },
  {
    kind: 'GRAD_POOL',
    phase: 'backward',
    results: ['grad'],
    summary: 'Route each gradient to the window element that won the max (or spread it for mean pooling).',
    symbolic: (i) =>
      `∂ℓ/∂a${s(L(i) - 1)} = ${i.meta.mode === 'max' ? 'route to argmax' : `spread ÷ ${Number(i.meta.size) ** 2}`}(∂ℓ/∂a${s(L(i))})`,
  },
  {
    kind: 'GRAD_FLATTEN',
    phase: 'backward',
    results: ['grad'],
    summary: 'Reshape the gradient vector back into feature-map shape.',
    symbolic: (i) => `∂ℓ/∂a${s(L(i) - 1)} = reshape(∂ℓ/∂a${s(L(i))})`,
  },
  {
    kind: 'BACKWARD_LAYER_END',
    phase: 'backward',
    results: [],
    summary: 'Marks the end of one layer in the backward pass.',
    symbolic: (i) => `end of backward pass through layer ${L(i)}`,
  },
  {
    kind: 'GRAD_ACCUMULATE',
    phase: 'update',
    results: ['grad'],
    summary: "Average this parameter's per-example gradients over the mini-batch.",
    symbolic: (i) => `ḡ(${paramSym(i.meta.param)}) = (1/B) Σₛ ∂ℓₛ/∂${paramSym(i.meta.param)}`,
  },
  {
    kind: 'OPTIMIZER_STATE',
    phase: 'update',
    results: ['velocity'],
    summary: 'Update the momentum accumulator.',
    symbolic: (i) => `v(${paramSym(i.meta.param)}) ← ${str(i.meta.momentum)}·v + ḡ`,
  },
  {
    kind: 'COMPUTE_UPDATE',
    phase: 'update',
    results: ['delta'],
    summary: 'Scale the (momentum-smoothed) gradient by −η to get the step.',
    symbolic: (i) =>
      `Δ${paramSym(i.meta.param)} = −${str(i.meta.lr)} · ${i.meta.optimizer === 'momentum' ? 'v' : 'ḡ'}`,
  },
  {
    kind: 'APPLY_UPDATE',
    phase: 'update',
    results: ['value'],
    summary: 'Add the step to the parameter.',
    symbolic: (i) => `${paramSym(i.meta.param)} ← ${paramSym(i.meta.param)} + Δ${paramSym(i.meta.param)}`,
  },
  {
    kind: 'EPOCH_BEGIN',
    phase: 'control',
    results: ['order'],
    summary: 'Start a pass over the training set (in a freshly shuffled order).',
    symbolic: (i) => `begin epoch ${str(i.path.epoch)}`,
  },
  {
    kind: 'EPOCH_END',
    phase: 'control',
    results: ['meanLoss', 'batchLosses', 'gradNorms', 'paramNorms'],
    summary: 'End of the pass; summarise its losses and per-parameter gradient and weight magnitudes.',
    symbolic: (i) => `end epoch ${str(i.path.epoch)}`,
  },
  {
    kind: 'BATCH_BEGIN',
    phase: 'control',
    results: ['indices'],
    summary: 'Start a mini-batch.',
    symbolic: (i) => `begin batch ${str(i.path.batch)} (B = ${str(i.meta.size)})`,
  },
  {
    kind: 'BATCH_END',
    phase: 'control',
    results: [],
    summary: 'End of the mini-batch; parameters have been updated.',
    symbolic: (i) => `end batch ${str(i.path.batch)}`,
  },
  {
    kind: 'EVAL_BEGIN',
    phase: 'eval',
    results: [],
    summary: 'Evaluate the current model on the whole training set (no learning).',
    symbolic: () => 'begin evaluation',
  },
  {
    kind: 'EVAL_END',
    phase: 'eval',
    results: ['loss'],
    summary: 'Report evaluation loss and accuracy (and the decision boundary for 2-D data).',
    symbolic: () => 'end evaluation',
  },
];
builtins.forEach(registerInstructionKind);

const up = (role = 'upstream'): { source: OperandSource; role: string } => ({
  source: { from: 'upstream' },
  role,
});
const inp = (index: number, role: string): { source: OperandSource; role: string } => ({
  source: { from: 'input', index },
  role,
});

for (const fn of ['linear', 'sigmoid', 'tanh', 'relu', 'softmax']) {
  registerOpMapping({
    op: fn,
    forwardKind: 'ACTIVATE',
    forwardRoles: ['preactivation'],
    meta: (_a, op) => ({ fn: op }),
    backward: [
      {
        kind: 'GRAD_ACTIVATE',
        slots: [{ slot: 'grad', input: 0 }],
        operands: [up(), inp(0, 'preactivation'), { source: { from: 'output' }, role: 'activation' }],
      },
    ],
  });
}

registerOpMapping({
  op: 'matmul',
  forwardKind: 'MATMUL',
  forwardRoles: ['input', 'weight'],
  backward: [
    { kind: 'GRAD_MATMUL_W', slots: [{ slot: 'grad', input: 1 }], operands: [up(), inp(0, 'input')] },
    { kind: 'GRAD_MATMUL_X', slots: [{ slot: 'grad', input: 0 }], operands: [up(), inp(1, 'weight')] },
  ],
});

registerOpMapping({
  op: 'addBias',
  forwardKind: 'ADD_BIAS',
  forwardRoles: ['input', 'bias'],
  passthrough: [0],
  backward: [{ kind: 'GRAD_BIAS', slots: [{ slot: 'grad', input: 1 }], operands: [up()] }],
});

registerOpMapping({
  op: 'conv2d',
  forwardKind: 'CONV2D',
  forwardRoles: ['input', 'kernel'],
  meta: (a) => ({ stride: Number(a.stride), padding: Number(a.padding) }),
  backward: [
    {
      kind: 'GRAD_CONV2D',
      slots: [
        { slot: 'dW', input: 1 },
        { slot: 'dX', input: 0 },
      ],
      operands: [up(), inp(0, 'input'), inp(1, 'kernel')],
    },
  ],
});

for (const [op, mode] of [
  ['maxPool2d', 'max'],
  ['avgPool2d', 'avg'],
] as const) {
  registerOpMapping({
    op,
    forwardKind: 'POOL',
    forwardRoles: ['input'],
    meta: (a) => ({ mode, size: Number(a.size), stride: Number(a.stride) }),
    backward: [{ kind: 'GRAD_POOL', slots: [{ slot: 'grad', input: 0 }], operands: [up(), inp(0, 'input')] }],
  });
}

registerOpMapping({
  op: 'reshape',
  forwardKind: 'FLATTEN',
  forwardRoles: ['input'],
  backward: [{ kind: 'GRAD_FLATTEN', slots: [{ slot: 'grad', input: 0 }], operands: [up()] }],
});

for (const [op, loss] of [
  ['mseLoss', 'mse'],
  ['bceLoss', 'bce'],
  ['softmaxCrossEntropy', 'cce'],
] as const) {
  registerOpMapping({
    op,
    forwardKind: 'COMPUTE_LOSS',
    forwardRoles: [loss === 'cce' ? 'logits' : 'prediction', 'target'],
    meta: () => ({ loss }),
    backward: [
      {
        kind: 'GRAD_INIT',
        slots: [{ slot: 'grad', input: 0 }],
        operands: [
          { source: { from: 'loss' }, role: 'loss' },
          inp(0, loss === 'cce' ? 'logits' : 'prediction'),
          inp(1, 'target'),
        ],
      },
    ],
  });
}

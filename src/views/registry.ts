/**
 * Registration point 4 of the NPM extension model: visual mappings.
 *
 * A visual mapping tells the views, from the instruction alone, what to
 * highlight and in which direction information is flowing. Views never ask the
 * engine; if a view needs something the mapping cannot derive from the
 * instruction and its operands, the IR is incomplete.
 */
import type { Instruction, InstructionKind } from '../core/npm/ir';

export type Flow = 'forward' | 'backward' | 'update' | 'none';
export type Target = 'input' | 'units' | 'edges' | 'bias' | 'loss' | 'layer' | 'network' | 'none';

export interface VisualMapping {
  flow: Flow;
  /** What part of the network diagram the instruction acts on. */
  target: Target;
  /** Which result slot holds the values to paint on the target (if any). */
  valueSlot?: string;
  /** Short label for the persistent mode indicator, e.g. "Forward · weighted sum". */
  label: string;
}

const mappings = new Map<string, VisualMapping>();

export function registerVisualMapping(kind: InstructionKind, m: VisualMapping): void {
  if (mappings.has(kind)) throw new Error(`visual mapping for ${kind} registered twice`);
  mappings.set(kind, m);
}

export function visualMapping(ins: Instruction): VisualMapping {
  const m = mappings.get(ins.kind);
  if (!m) throw new Error(`no visual mapping registered for ${ins.kind}`);
  return m;
}

export const mappedKinds = (): string[] => [...mappings.keys()];

const builtins: [InstructionKind, VisualMapping][] = [
  ['INIT_PARAM', { flow: 'none', target: 'edges', valueSlot: 'value', label: 'Initialise parameters' }],
  ['LOAD_INPUT', { flow: 'forward', target: 'input', valueSlot: 'x', label: 'Forward · load example' }],
  ['MATMUL', { flow: 'forward', target: 'edges', valueSlot: 'out', label: 'Forward · weighted sum' }],
  ['CONV2D', { flow: 'forward', target: 'edges', valueSlot: 'out', label: 'Forward · convolution' }],
  ['ADD_BIAS', { flow: 'forward', target: 'bias', valueSlot: 'out', label: 'Forward · add bias' }],
  ['ACTIVATE', { flow: 'forward', target: 'units', valueSlot: 'out', label: 'Forward · activation' }],
  ['POOL', { flow: 'forward', target: 'units', valueSlot: 'out', label: 'Forward · pooling' }],
  ['FLATTEN', { flow: 'forward', target: 'units', valueSlot: 'out', label: 'Forward · flatten' }],
  ['FORWARD_LAYER_END', { flow: 'forward', target: 'layer', label: 'Forward · layer done' }],
  [
    'COMPUTE_LOSS',
    { flow: 'forward', target: 'loss', valueSlot: 'loss', label: 'Loss · compare with target' },
  ],
  ['LOSS_REDUCE', { flow: 'none', target: 'loss', valueSlot: 'loss', label: 'Loss · batch average' }],
  ['GRAD_INIT', { flow: 'backward', target: 'loss', valueSlot: 'grad', label: 'Backward · start at loss' }],
  [
    'GRAD_ACTIVATE',
    { flow: 'backward', target: 'units', valueSlot: 'grad', label: 'Backward · through activation' },
  ],
  ['GRAD_BIAS', { flow: 'backward', target: 'bias', valueSlot: 'grad', label: 'Backward · bias gradient' }],
  [
    'GRAD_MATMUL_W',
    { flow: 'backward', target: 'edges', valueSlot: 'grad', label: 'Backward · weight gradient' },
  ],
  [
    'GRAD_MATMUL_X',
    { flow: 'backward', target: 'units', valueSlot: 'grad', label: 'Backward · to previous layer' },
  ],
  [
    'GRAD_CONV2D',
    { flow: 'backward', target: 'edges', valueSlot: 'dW', label: 'Backward · kernel gradient' },
  ],
  [
    'GRAD_POOL',
    { flow: 'backward', target: 'units', valueSlot: 'grad', label: 'Backward · through pooling' },
  ],
  ['GRAD_FLATTEN', { flow: 'backward', target: 'units', valueSlot: 'grad', label: 'Backward · un-flatten' }],
  ['BACKWARD_LAYER_END', { flow: 'backward', target: 'layer', label: 'Backward · layer done' }],
  [
    'GRAD_ACCUMULATE',
    { flow: 'update', target: 'edges', valueSlot: 'grad', label: 'Update · average gradients' },
  ],
  ['OPTIMIZER_STATE', { flow: 'update', target: 'edges', valueSlot: 'velocity', label: 'Update · momentum' }],
  ['COMPUTE_UPDATE', { flow: 'update', target: 'edges', valueSlot: 'delta', label: 'Update · compute step' }],
  ['APPLY_UPDATE', { flow: 'update', target: 'edges', valueSlot: 'value', label: 'Update · apply step' }],
  ['EPOCH_BEGIN', { flow: 'none', target: 'network', label: 'Epoch begins' }],
  ['EPOCH_END', { flow: 'none', target: 'network', label: 'Epoch ends' }],
  ['BATCH_BEGIN', { flow: 'none', target: 'network', label: 'Mini-batch begins' }],
  ['BATCH_END', { flow: 'none', target: 'network', label: 'Mini-batch ends' }],
  ['EVAL_BEGIN', { flow: 'none', target: 'network', label: 'Evaluation' }],
  ['EVAL_END', { flow: 'none', target: 'network', label: 'Evaluation result' }],
];
builtins.forEach(([k, m]) => registerVisualMapping(k, m));

/**
 * The Neural Program Model (NPM): a flat, ordered sequence of typed
 * instructions describing one complete training run. Normative description:
 * docs/NPM-SPEC.md. Wire format: schema.json.
 */
import type { Tensor } from '../tensor/tensor';

export const NPM_VERSION = '1.0.0';

export const PHASES = ['init', 'forward', 'loss', 'backward', 'update', 'eval', 'control'] as const;
export type Phase = (typeof PHASES)[number];

/** Built-in instruction kinds, grouped as in the specification. Extensions may register more. */
export const BUILTIN_KINDS = {
  forward: [
    'INIT_PARAM',
    'LOAD_INPUT',
    'MATMUL',
    'ADD_BIAS',
    'CONV2D',
    'POOL',
    'FLATTEN',
    'ACTIVATE',
    'FORWARD_LAYER_END',
  ],
  loss: ['COMPUTE_LOSS', 'LOSS_REDUCE'],
  backward: [
    'GRAD_INIT',
    'GRAD_ACTIVATE',
    'GRAD_MATMUL_W',
    'GRAD_MATMUL_X',
    'GRAD_BIAS',
    'GRAD_CONV2D',
    'GRAD_POOL',
    'GRAD_FLATTEN',
    'BACKWARD_LAYER_END',
  ],
  update: ['GRAD_ACCUMULATE', 'OPTIMIZER_STATE', 'COMPUTE_UPDATE', 'APPLY_UPDATE'],
  control: ['EPOCH_BEGIN', 'EPOCH_END', 'BATCH_BEGIN', 'BATCH_END', 'EVAL_BEGIN', 'EVAL_END'],
} as const;

export type BuiltinKind = (typeof BUILTIN_KINDS)[keyof typeof BUILTIN_KINDS][number];
/** Extension kinds are plain strings registered at runtime (see kinds.ts). */
export type InstructionKind = BuiltinKind | (string & {});

/**
 * Position of an instruction in the training hierarchy
 * epoch → batch → sample → phase → layer → operation.
 * A null level means the instruction sits above that level (e.g. an update is
 * per batch, so its `sample` is null).
 */
export interface NestPath {
  epoch: number | null;
  batch: number | null;
  sample: number | null;
  phase: Phase;
  layer: string | null;
}

/** A value produced by an earlier instruction: its id and the name of the result slot. */
export interface Operand {
  ref: number;
  slot: string;
  /** What the value is to this instruction, e.g. "input", "weight", "upstream". */
  role: string;
}

export type MetaValue = string | number | boolean | null | number[] | string[];

export interface Instruction {
  /** Position in the trace, 0-based, dense and strictly increasing. */
  id: number;
  kind: InstructionKind;
  path: NestPath;
  operands: Operand[];
  /** Named result tensors. Scalars have shape []. */
  results: Record<string, Tensor>;
  /** Kind-specific metadata (activation name, stride, learning rate, parameter name …). */
  meta: Record<string, MetaValue>;
  /** Human-readable symbolic form with this instruction's indices substituted, e.g. "u¹ = a⁰ · W¹". */
  symbolic: string;
}

/** Everything a consumer needs besides the instructions: the run's configuration and model summary. */
export interface TraceHeader {
  format: 'npm-trace';
  version: string;
  generator: string;
  seed: number;
  config: unknown;
  model: {
    inputShape: number[];
    outputShape: number[];
    layers: {
      name: string;
      type: string;
      inShape: number[];
      outShape: number[];
      activation: string | null;
      params: string[];
    }[];
    params: { name: string; layer: string; role: string; shape: number[] }[];
  };
  dataset: {
    name: string;
    n: number;
    inputShape: number[];
    classes: string[] | null;
    xs: Tensor | null;
    ys: Tensor | null;
  };
  /** Instruction count for the full run, known before instructions are materialised. */
  length: number;
  /** Granularity unit boundaries: first instruction id of each epoch, plus the end. */
  epochStarts: number[];
}

export interface Trace {
  header: TraceHeader;
  instructions: Instruction[];
}

const SUP: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};
export const sup = (n: number): string => String(n).replace(/\d/g, (d) => SUP[d]);

/** "L3" → 3. */
export const layerNumber = (layer: string | null): number => (layer ? Number(layer.slice(1)) : 0);

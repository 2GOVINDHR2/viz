/**
 * Reverse-mode automatic differentiation over an explicit tape.
 *
 * The tape is the computation graph the Neural Program Model is emitted from:
 * every forward op appends one entry, and backward walks the entries in reverse
 * calling the op's registered gradient rule. Because the emitter reads this
 * tape, the trace can never disagree with the numbers the engine computed.
 */
import { Tensor } from '../tensor/tensor';
import { add } from '../tensor/ops';
import { getOp, type OpAttrs } from './registry';

let nextVarId = 1;

export class Var {
  readonly id: number;
  readonly value: Tensor;
  readonly requiresGrad: boolean;
  /** The tape entry that produced this value; null for leaves. */
  readonly entry: TapeEntry | null;
  readonly name: string | undefined;

  constructor(value: Tensor, requiresGrad: boolean, entry: TapeEntry | null, name?: string) {
    this.id = nextVarId++;
    this.value = value;
    this.requiresGrad = requiresGrad;
    this.entry = entry;
    this.name = name;
  }
}

/** Where an entry sits in the network; the NPM emitter uses it to attribute instructions to layers. */
export interface EntryMeta {
  readonly layer?: string;
  /** False for values computed only for display (e.g. softmax probabilities beside a fused loss). */
  readonly onGradientPath?: boolean;
}

export interface TapeEntry {
  readonly index: number;
  readonly op: string;
  readonly inputs: readonly Var[];
  readonly attrs: OpAttrs;
  readonly saved: unknown;
  readonly meta: EntryMeta;
  output: Var;
}

export interface BackwardStep {
  entry: TapeEntry;
  /** ∂L/∂output of this entry. */
  gradOutput: Tensor;
  /** ∂L/∂input contributions from this entry (null when the input needs no gradient). */
  gradInputs: readonly (Tensor | null)[];
}

export class Tape {
  readonly entries: TapeEntry[] = [];

  leaf(value: Tensor, requiresGrad: boolean, name?: string): Var {
    return new Var(value, requiresGrad, null, name);
  }

  apply(op: string, inputs: readonly Var[], attrs: OpAttrs = {}, meta: EntryMeta = {}): Var {
    const rule = getOp(op);
    if (rule.arity !== inputs.length) {
      throw new Error(`op ${op} takes ${rule.arity} inputs, got ${inputs.length}`);
    }
    const { value, saved } = rule.forward(
      inputs.map((v) => v.value),
      attrs,
    );
    const entry: TapeEntry = {
      index: this.entries.length,
      op,
      inputs,
      attrs,
      saved,
      meta,
      output: undefined as never,
    };
    const out = new Var(
      value,
      inputs.some((v) => v.requiresGrad),
      entry,
    );
    entry.output = out;
    this.entries.push(entry);
    return out;
  }
}

/**
 * Back-propagates from `root`. Returns gradients keyed by Var id for every Var
 * that requires a gradient and lies on a path to `root`. `onStep` observes each
 * entry's gradient computation in reverse tape order, which is the order the
 * backward-phase NPM instructions are emitted in.
 */
export function backward(
  tape: Tape,
  root: Var,
  seed: Tensor = Tensor.full(root.value.shape, 1),
  onStep?: (step: BackwardStep) => void,
): Map<number, Tensor> {
  const grads = new Map<number, Tensor>();
  grads.set(root.id, seed);
  const end = root.entry ? root.entry.index : -1;
  for (let i = end; i >= 0; i--) {
    const entry = tape.entries[i];
    const gOut = grads.get(entry.output.id);
    if (!gOut || !entry.output.requiresGrad) continue;
    const rule = getOp(entry.op);
    const raw = rule.backward({
      grad: gOut,
      inputs: entry.inputs.map((v) => v.value),
      output: entry.output.value,
      attrs: entry.attrs,
      saved: entry.saved,
    });
    const gradInputs = entry.inputs.map((v, k) => (v.requiresGrad ? raw[k] : null));
    gradInputs.forEach((g, k) => {
      if (!g) return;
      const v = entry.inputs[k];
      if (g.size !== v.value.size) {
        throw new Error(
          `gradient rule for ${entry.op} returned shape [${g.shape}] for input [${v.value.shape}]`,
        );
      }
      const prev = grads.get(v.id);
      grads.set(v.id, prev ? add(prev, g) : g);
    });
    onStep?.({ entry, gradOutput: gOut, gradInputs });
  }
  return grads;
}

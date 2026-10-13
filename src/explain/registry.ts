/**
 * Registration point 3 of the NPM extension model: explainers.
 *
 * An explainer turns one instruction into (i) the general mathematical form,
 * (ii) the same form with this instruction's actual numbers substituted, and
 * (iii) a plain-language sentence saying what happened and why it happens at
 * this point of the training cycle. Explainers read only the instruction and
 * the values it references — never engine state — so every explanation is
 * derived from, and therefore faithful to, the computation.
 */
import type { Instruction, InstructionKind, Operand, TraceHeader } from '../core/npm/ir';
import type { Tensor } from '../core/tensor/tensor';

export type Verbosity = 'novice' | 'detailed';

export interface ExplainContext {
  header: TraceHeader;
  /** Resolves an operand to the tensor it references. */
  value(o: Operand): Tensor;
  /** Index into the instruction's main result to focus on (e.g. the neuron a learner clicked). */
  focus: number;
  verbosity: Verbosity;
}

export interface Explanation {
  /** LaTeX, general form. */
  general: string;
  /** LaTeX, with this instruction's numbers substituted. */
  substituted: string;
  /** One or two plain-language sentences: what happened and why now. */
  sentence: string;
  /** Additional sentences shown at the detailed verbosity level. */
  detail?: string;
}

export type Explainer = (ins: Instruction, ctx: ExplainContext) => Explanation;

const explainers = new Map<string, Explainer>();

export function registerExplainer(kind: InstructionKind, fn: Explainer): void {
  if (explainers.has(kind)) throw new Error(`explainer for ${kind} registered twice`);
  explainers.set(kind, fn);
}

export function hasExplainer(kind: InstructionKind): boolean {
  return explainers.has(kind);
}

export function explain(ins: Instruction, ctx: ExplainContext): Explanation {
  const fn = explainers.get(ins.kind);
  if (!fn) throw new Error(`no explainer registered for ${ins.kind}`);
  return fn(ins, ctx);
}

export const explainedKinds = (): string[] => [...explainers.keys()];

/**
 * Gradient-rule registry: registration point 2 of the NPM extension model
 * (see docs/NPM-SPEC.md §7). An op exists only if it registers both its
 * forward computation and its backward rule, and the gradcheck suite fails
 * for any registered op without a finite-difference test case.
 */
import type { Tensor } from '../tensor/tensor';

export type OpAttrs = Readonly<Record<string, number | string | boolean>>;

export interface ForwardResult {
  value: Tensor;
  /** Anything the backward rule needs that is not an input or the output (e.g. max-pool argmax). */
  saved?: unknown;
}

export interface BackwardContext {
  grad: Tensor;
  inputs: readonly Tensor[];
  output: Tensor;
  attrs: OpAttrs;
  saved: unknown;
}

export interface OpRule {
  readonly name: string;
  readonly arity: number;
  /** Indices of inputs that are never differentiated (e.g. loss targets). */
  readonly nonDifferentiable?: readonly number[];
  forward(inputs: readonly Tensor[], attrs: OpAttrs): ForwardResult;
  backward(ctx: BackwardContext): readonly (Tensor | null)[];
}

const rules = new Map<string, OpRule>();

export function registerOp(rule: OpRule): void {
  if (rules.has(rule.name)) throw new Error(`op ${rule.name} registered twice`);
  rules.set(rule.name, rule);
}

export function getOp(name: string): OpRule {
  const rule = rules.get(name);
  if (!rule) throw new Error(`unknown op ${name}`);
  return rule;
}

export function registeredOps(): string[] {
  return [...rules.keys()];
}

export function numAttr(attrs: OpAttrs, key: string): number {
  const v = attrs[key];
  if (typeof v !== 'number') throw new Error(`attribute ${key} must be a number`);
  return v;
}

/**
 * Extension layers: the part of registration point 1 that lets a new
 * operation appear in a model configuration as
 *   { type: 'extension', kind: 'layerNorm', options: { … } }.
 * Built-in layers do not go through this table.
 */
import type { Tape, Var } from '../autodiff';
import type { InitializerName } from '../rng/init';

export type LayerOptions = Readonly<Record<string, number | string | boolean>>;

export interface ExtensionParam {
  /** Suffix after the layer name, e.g. "gamma" → "L2.gamma". */
  role: string;
  shape: number[];
  init: InitializerName;
}

export interface ExtensionLayer {
  kind: string;
  outShape(inShape: readonly number[], options: LayerOptions): number[];
  params(inShape: readonly number[], options: LayerOptions): ExtensionParam[];
  /** Records the layer on the tape. `p(role)` returns the parameter Var for that role. */
  forward(tape: Tape, x: Var, p: (role: string) => Var, options: LayerOptions, meta: { layer: string }): Var;
}

const layers = new Map<string, ExtensionLayer>();

export function registerLayer(def: ExtensionLayer): void {
  if (layers.has(def.kind)) throw new Error(`layer ${def.kind} registered twice`);
  layers.set(def.kind, def);
}

export function extensionLayer(kind: string): ExtensionLayer {
  const d = layers.get(kind);
  if (!d) throw new Error(`unknown extension layer ${kind}; register it with registerLayer`);
  return d;
}

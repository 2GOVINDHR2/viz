/**
 * What the learner reads in place of the instruction set's identifiers (Fix Round 4, A1; ADR-062).
 *
 * The trace names things by identifier: instruction kinds (`MATMUL`), instruction numbers (`#17`), parameters
 * (`L1.W`) and elements (`L1.unit[1]`). Those are the representation's vocabulary, not the learner's.
 *  - **Guided path:** only the plain names below are shown.
 *  - **Expert mode:** the plain name leads, and the identifier follows as secondary monospace, because there the
 *    identifier is part of what is being demonstrated.
 *
 * Presentation layer only: the meanings come from the kind registry (NPM-SPEC §4.1), unchanged.
 */
import { kindSpec } from '../core/npm/kinds';
import type { InstructionKind, TraceHeader } from '../core/npm/ir';

/** A short noun phrase for running text ("Run to …"). Extension kinds fall back to their registered meaning. */
const LABEL: Record<string, string> = {
  INIT_PARAM: 'setting a starting value',
  LOAD_INPUT: 'loading an example',
  MATMUL: 'the weighted sum',
  ADD_BIAS: 'adding the bias',
  CONV2D: 'the convolution',
  POOL: 'the pooling step',
  FLATTEN: 'flattening the feature maps',
  ACTIVATE: 'the activation',
  FORWARD_LAYER_END: 'the end of a layer',
  COMPUTE_LOSS: 'the loss calculation',
  LOSS_REDUCE: 'averaging the loss over the batch',
  GRAD_INIT: 'the start of back-propagation',
  GRAD_ACTIVATE: 'multiplying by the activation’s slope',
  GRAD_MATMUL_W: 'the weight gradient',
  GRAD_MATMUL_X: 'sending the gradient back a layer',
  GRAD_BIAS: 'the bias gradient',
  GRAD_CONV2D: 'the kernel gradient',
  GRAD_POOL: 'routing the gradient through the pooling step',
  GRAD_FLATTEN: 'reshaping the gradient',
  BACKWARD_LAYER_END: 'the end of a layer in the backward pass',
  GRAD_ACCUMULATE: 'averaging the gradients over the batch',
  OPTIMIZER_STATE: 'updating the momentum',
  COMPUTE_UPDATE: 'computing the step',
  APPLY_UPDATE: 'applying the update',
  EPOCH_BEGIN: 'the start of a pass over the data',
  EPOCH_END: 'the end of a pass over the data',
  BATCH_BEGIN: 'the start of a batch',
  BATCH_END: 'the end of a batch',
  EVAL_BEGIN: 'the start of an evaluation',
  EVAL_END: 'the evaluation result',
};

/** The kind's meaning, as NPM-SPEC §4.1 gives it: a full sentence. */
export function kindMeaning(kind: InstructionKind): string {
  try {
    return kindSpec(kind).summary;
  } catch {
    return 'An instruction of an extension kind.';
  }
}

/** A short noun phrase for the kind, for running text. */
export function kindLabel(kind: InstructionKind): string {
  return LABEL[kind] ?? kindMeaning(kind).replace(/\.$/, '').toLowerCase();
}

/** "hidden layer 1" or "the output layer", from a layer name such as "L2". */
export function layerTitle(header: TraceHeader, layer: string): string {
  const k = header.model.layers.findIndex((l) => l.name === layer);
  if (k < 0) return layer;
  return k === header.model.layers.length - 1 ? 'the output layer' : `hidden layer ${k + 1}`;
}

/** A parameter in words: "weights into the output layer", "biases of hidden layer 1". */
export function paramTitle(header: TraceHeader, name: string): string {
  const p = header.model.params.find((x) => x.name === name);
  if (!p) return name;
  const where = layerTitle(header, p.layer);
  const conv = header.model.layers.find((l) => l.name === p.layer)?.type === 'conv2d';
  if (p.role === 'bias' || name.endsWith('.b')) return `biases of ${where}`;
  return conv ? `kernels of ${where}` : `weights into ${where}`;
}

/**
 * An inspector element in words. Ids: `x[i]`, `L.unit[j]`, `L.W[i,j]`, `L.b[j]`, `L.map[c](r,q)` (ADR-047).
 * Returns the id unchanged if it is not one of those forms.
 */
export function elementTitle(header: TraceHeader, id: string): string {
  let m = /^x\[(\d+)\]$/.exec(id);
  if (m) return `input ${m[1]}`;
  m = /^(\w+)\.unit\[(\d+)\]$/.exec(id);
  if (m) return `neuron ${m[2]} of ${layerTitle(header, m[1])}`;
  m = /^(\w+)\.W\[(\d+),(\d+)\]$/.exec(id);
  if (m) {
    const k = header.model.layers.findIndex((l) => l.name === m![1]);
    const from = k <= 0 ? `input ${m[2]}` : `neuron ${m[2]} of hidden layer ${k}`;
    return `the weight from ${from} to neuron ${m[3]} of ${layerTitle(header, m[1])}`;
  }
  m = /^(\w+)\.b\[(\d+)\]$/.exec(id);
  if (m) return `the bias of neuron ${m[2]} of ${layerTitle(header, m[1])}`;
  m = /^(\w+)\.map\[(\d+)\]\((\d+),(\d+)\)$/.exec(id);
  if (m) return `cell (${m[3]}, ${m[4]}) of feature map ${m[2]} in ${layerTitle(header, m[1])}`;
  return id;
}

/**
 * Text written with expert-only identifier markers, `[[MATMUL]]`, as in the walkthrough strings. In the guided path
 * a marker is dropped; in expert mode it becomes the identifier, shown by the caller as monospace.
 */
export function splitMarkers(text: string): ({ text: string } | { ident: string })[] {
  const out: ({ text: string } | { ident: string })[] = [];
  let last = 0;
  for (const m of text.matchAll(/\s?\[\[([A-Za-z0-9_.[\],]+)\]\]/g)) {
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ ident: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** The text a guided-path learner sees: markers removed. */
export const guidedText = (text: string): string =>
  splitMarkers(text)
    .map((p) => ('text' in p ? p.text : ''))
    .join('');

/** Identifier patterns that must never reach a guided-path screen (tested by tests/unit/identifiers.test.ts). */
export const IDENTIFIER_PATTERNS: { what: string; re: RegExp }[] = [
  {
    what: 'an instruction kind',
    re: /\b[A-Z][A-Z0-9]{2,}(?:_[A-Z0-9]+)+\b|\b(?:MATMUL|ACTIVATE|CONV2D|POOL|FLATTEN)\b/,
  },
  { what: 'an instruction number', re: /(?:^|[\s(])#\d+\b/ },
  { what: 'a parameter identifier', re: /\bL\d+\.(?:W|b)\b/ },
  { what: 'an element identifier', re: /\bL\d+\.(?:unit|map)\[|\bx\[\d+\]/ },
];

/**
 * A sentence from the core (a breakpoint reason, say) with every parameter identifier replaced by its words. The
 * core's text is left as it is; this is how the guided path shows it.
 */
export function plainParams(header: TraceHeader, text: string): string {
  return text.replace(/\b(L\d+\.(?:W|b))\b/g, (id) => paramTitle(header, id));
}

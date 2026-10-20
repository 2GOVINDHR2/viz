/**
 * Selection binding (Fix Round 2b, defect 2): which instructions produced and
 * which consumed the element the learner selected, read from the trace's own
 * data flow (each instruction's operands name the instruction and result slot
 * they read). Nothing is inferred from the view.
 *
 * Granularity is the tensor: a neuron's value is produced by the instruction
 * whose result holds its layer's activations, and consumed by every
 * instruction that reads that result.
 */
import type { Instruction, TraceHeader } from '../core/npm/ir';
import type { ExecState } from '../core/npm/state';
import type { Focus } from './focus';

export interface InstructionRef {
  id: number;
  kind: string;
}

export interface Provenance {
  produced: InstructionRef[];
  consumed: InstructionRef[];
}

/** Stable identifier of a selectable element, shown in the inspector and used to bind its values. */
export function elementId(header: TraceHeader, focus: Focus): string {
  if (focus.kind === 'edge') return `${focus.layer}.W[${focus.i + 1},${focus.j + 1}]`;
  if (focus.layer === 'input') return `x[${focus.index + 1}]`;
  const l = header.model.layers.find((x) => x.name === focus.layer);
  if (l && l.outShape.length === 3) {
    const [, H, W] = l.outShape;
    const c = Math.floor(focus.index / (H * W));
    const r = Math.floor((focus.index % (H * W)) / W);
    return `${focus.layer}.map[${c + 1}](${r + 1},${(focus.index % W) + 1})`;
  }
  return `${focus.layer}.unit[${focus.index + 1}]`;
}

const FORWARD_UNIT = new Set(['MATMUL', 'CONV2D', 'ADD_BIAS', 'ACTIVATE', 'POOL', 'FLATTEN']);
const BACKWARD_UNIT = new Set(['GRAD_ACTIVATE', 'GRAD_BIAS', 'GRAD_POOL', 'GRAD_FLATTEN']);
const UPDATE = new Set(['GRAD_ACCUMULATE', 'OPTIMIZER_STATE', 'COMPUTE_UPDATE', 'APPLY_UPDATE']);

/** The instructions of the example whose values the state shows: from its LOAD_INPUT up to the cursor. */
function sampleWindow(window: readonly Instruction[], exec: ExecState): Instruction[] {
  if (!exec.sample) return [];
  let start = -1;
  for (let k = window.length - 1; k >= 0; k--)
    if (window[k].kind === 'LOAD_INPUT' && Number(window[k].meta.datasetIndex) === exec.sample.datasetIndex) {
      start = k;
      break;
    }
  if (start < 0) return [];
  const out: Instruction[] = [];
  for (let k = start; k < window.length && window[k].id <= exec.cursor; k++) {
    if (k > start && window[k].kind === 'LOAD_INPUT') break;
    out.push(window[k]);
  }
  return out;
}

/**
 * `window` must be consecutive instructions ending at the cursor and long enough to contain the current
 * example's LOAD_INPUT and the producer of the selected weight's current version.
 */
export function provenance(
  header: TraceHeader,
  exec: ExecState,
  focus: Focus,
  window: readonly Instruction[],
): Provenance {
  const upTo = window.filter((i) => i.id <= exec.cursor);
  const sample = sampleWindow(upTo, exec);
  const layers = header.model.layers;
  const k = layers.findIndex((l) => l.name === focus.layer);
  const next = k >= 0 && k + 1 < layers.length ? layers[k + 1].name : null;
  const isOutput = k === layers.length - 1;
  let produced: Instruction[];
  let scope: Instruction[];
  if (focus.kind === 'edge') {
    const param = `${focus.layer}.W`;
    const version = exec.params[param]?.producedBy;
    produced = upTo.filter(
      (i) =>
        i.id === version ||
        (i.kind === 'GRAD_MATMUL_W' && i.path.layer === focus.layer && sample.includes(i)) ||
        (UPDATE.has(i.kind) && i.meta.param === param && i.id > (version ?? -1)),
    );
    scope = upTo.filter((i) => i.id >= (version ?? 0));
  } else if (focus.layer === 'input') {
    produced = sample.filter((i) => i.kind === 'LOAD_INPUT');
    scope = sample;
  } else {
    produced = sample.filter(
      (i) =>
        (i.path.layer === focus.layer && (FORWARD_UNIT.has(i.kind) || BACKWARD_UNIT.has(i.kind))) ||
        // The error arriving at this layer's output comes from the next layer, or from the loss.
        (i.kind === 'GRAD_MATMUL_X' && next !== null && i.path.layer === next) ||
        (i.kind === 'GRAD_INIT' && isOutput),
    );
    scope = sample;
  }
  const ids = new Set(produced.map((i) => i.id));
  const consumed = scope.filter((i) => !ids.has(i.id) && i.operands.some((o) => ids.has(o.ref)));
  const ref = (i: Instruction): InstructionRef => ({ id: i.id, kind: i.kind });
  return { produced: produced.map(ref), consumed: consumed.map(ref) };
}

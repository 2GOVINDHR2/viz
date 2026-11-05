/**
 * Diagnostic questions asked of a trace (Fix Round 5, 3.2; NPM-SPEC §10.2; ADR-074). Each is a pure function of the
 * instructions alone, so it answers over a trace file exactly as over the live run, and each answer points at the
 * instructions that justify it, so the learner can jump there.
 *
 *  1. Where does a layer's gradient first fall below a threshold (10⁻⁴ by default)?
 *  2. Which instructions read the weight that changed most in an epoch?
 *  3. Which example had the largest loss in an epoch, and what was its forward pass?
 *  4. Where did a ReLU neuron go inactive and never recover?
 *  5. After which instruction did the loss stop decreasing?
 */
import type { Instruction } from '../../core/npm/ir';
import { largestMagnitude } from './query';

/** 1. The first batch gradient (GRAD_ACCUMULATE) of any weight whose every element is below the threshold. */
export function firstVanishing(
  instructions: Instruction[],
  threshold = 1e-4,
): { ins: Instruction; param: string; magnitude: number } | null {
  for (const ins of instructions) {
    if (ins.kind !== 'GRAD_ACCUMULATE' || !String(ins.meta.param).endsWith('.W')) continue;
    const m = largestMagnitude(ins);
    if (m < threshold) return { ins, param: String(ins.meta.param), magnitude: m };
  }
  return null;
}

/**
 * 2. The weight element that changed most over an epoch (from the version current at the epoch's start to the one
 * at its end), and every instruction in the epoch that read any version of that weight tensor.
 */
export function readersOfMostChanged(
  instructions: Instruction[],
  epoch: number,
): { param: string; element: number; before: number; after: number; readers: number[] } | null {
  // The producer of each parameter's newest version, walking the trace in order.
  const current = new Map<string, Instruction>();
  let start: Map<string, Instruction> | null = null;
  for (const ins of instructions) {
    if (ins.path.epoch === epoch && !start) start = new Map(current);
    if (start && ins.path.epoch !== null && ins.path.epoch > epoch) break;
    if (ins.kind === 'INIT_PARAM' || ins.kind === 'APPLY_UPDATE') current.set(String(ins.meta.param), ins);
  }
  if (!start) return null;
  let best: { param: string; element: number; before: number; after: number } | null = null;
  for (const [param, a] of start) {
    const b = current.get(param)!;
    if (!param.endsWith('.W')) continue;
    const x = a.results.value.data;
    const y = b.results.value.data;
    for (let k = 0; k < y.length; k++) {
      const d = Math.abs(y[k] - x[k]);
      if (!best || d > Math.abs(best.after - best.before))
        best = { param, element: k, before: x[k], after: y[k] };
    }
  }
  if (!best) return null;
  // Every version of that tensor alive during the epoch: the one at its start and every update within it.
  const versions = new Set<number>([start.get(best.param)!.id]);
  for (const ins of instructions)
    if (ins.path.epoch === epoch && ins.kind === 'APPLY_UPDATE' && ins.meta.param === best.param)
      versions.add(ins.id);
  const readers = instructions
    .filter((i) => i.path.epoch === epoch && i.operands.some((o) => versions.has(o.ref)))
    .map((i) => i.id);
  return { ...best, readers };
}

/** 3. The example with the largest loss in an epoch, and the ids of its forward pass (LOAD_INPUT to COMPUTE_LOSS). */
export function largestLossExample(
  instructions: Instruction[],
  epoch: number,
): { loss: number; datasetIndex: number; lossAt: number; forward: number[] } | null {
  let best: Instruction | null = null;
  for (const ins of instructions)
    if (ins.kind === 'COMPUTE_LOSS' && ins.path.epoch === epoch) {
      const v = ins.results.loss.data[0];
      if (
        !best ||
        v > best.results.loss.data[0] ||
        (Number.isNaN(v) && !Number.isNaN(best.results.loss.data[0]))
      )
        best = ins;
    }
  if (!best) return null;
  const { batch, sample } = best.path;
  const forward = instructions.filter(
    (i) =>
      i.path.epoch === epoch &&
      i.path.batch === batch &&
      i.path.sample === sample &&
      (i.path.phase === 'forward' || i.id === best!.id),
  );
  const load = forward.find((i) => i.kind === 'LOAD_INPUT');
  return {
    loss: best.results.loss.data[0],
    datasetIndex: Number(load?.meta.datasetIndex ?? -1),
    lossAt: best.id,
    forward: forward.map((i) => i.id),
  };
}

/**
 * 4. ReLU neurons that went inactive and never recovered: after their last positive response (in training, over
 * every example), every later response of that neuron is zero, and there is at least one later response.
 */
export function deadRelus(
  instructions: Instruction[],
): { layer: string; unit: number; lastActive: number | null; inactiveFrom: number }[] {
  const seen = new Map<string, { last: number | null; firstAfter: number | null }>();
  for (const ins of instructions) {
    if (ins.kind !== 'ACTIVATE' || ins.meta.fn !== 'relu' || ins.path.phase !== 'forward') continue;
    const out = ins.results.out.data;
    // A convolutional layer's maps are not single neurons; only dense layers' units are reported.
    // (A dense layer's responses are [1, units]; a convolutional layer's are maps.)
    if (ins.results.out.shape.filter((d) => d !== 1).length > 1) continue;
    for (let u = 0; u < out.length; u++) {
      const k = `${ins.path.layer}#${u}`;
      const s = seen.get(k) ?? { last: null, firstAfter: null };
      if (out[u] > 0) {
        s.last = ins.id;
        s.firstAfter = null;
      } else if (s.firstAfter === null) s.firstAfter = ins.id;
      seen.set(k, s);
    }
  }
  return [...seen.entries()]
    .filter(([, s]) => s.firstAfter !== null)
    .map(([k, s]) => {
      const [layer, unit] = k.split('#');
      return { layer, unit: Number(unit), lastActive: s.last, inactiveFrom: s.firstAfter! };
    })
    .filter((d) => {
      // Inactive from then to the end: the neuron's every later response is zero (checked by construction above,
      // since any positive response resets it). A neuron is reported only if it stayed dead for a whole pass.
      const tail = instructions.filter(
        (i) =>
          i.id >= d.inactiveFrom &&
          i.kind === 'ACTIVATE' &&
          i.path.layer === d.layer &&
          i.path.phase === 'forward',
      );
      const epochs = new Set(tail.map((i) => i.path.epoch));
      return epochs.size >= 2;
    });
}

/**
 * 5. The end of the epoch with the lowest evaluation loss: after it, the loss never falls below that value again.
 * Null when the lowest loss is the last epoch's (it never stopped decreasing).
 */
export function lossStoppedDecreasing(
  instructions: Instruction[],
): { at: number; epoch: number; loss: number; later: number } | null {
  const evals = instructions.filter((i) => i.kind === 'EVAL_END');
  if (evals.length < 2) return null;
  let k = 0;
  for (let j = 1; j < evals.length; j++)
    if (evals[j].results.loss.data[0] < evals[k].results.loss.data[0]) k = j;
  if (k === evals.length - 1) return null;
  return {
    at: evals[k].id,
    epoch: Number(evals[k].path.epoch),
    loss: evals[k].results.loss.data[0],
    later: evals.length - 1 - k,
  };
}

/**
 * "What changed since the previous step": a comparison of two reconstructed
 * states, phrased for the learner. Like every explanation it is derived from
 * the trace, so it reports exactly what the step did.
 */
import { layerTitle, paramTitle } from './names';
import type { TraceHeader } from '../core/npm/ir';
import type { ExecState, LayerState } from '../core/npm/state';
import type { Tensor } from '../core/tensor/tensor';
import { num } from './format';

/** Each layer field, as expert mode and as the guided path name it. */
const LAYER_FIELDS: [keyof LayerState, string, string][] = [
  ['u', 'weighted sums u', 'weighted totals'],
  ['z', 'pre-activations z', 'totals with the bias added'],
  ['a', 'outputs a', 'responses'],
  ['gradA', 'output gradients ∂ℓ/∂a', 'how much each response affects the mistake'],
  ['gradZ', 'error signals ∂ℓ/∂z', 'error signals'],
  ['gradW', 'weight gradients ∂ℓ/∂W', 'which way each weight should move'],
  ['gradB', 'bias gradients ∂ℓ/∂b', 'which way each bias should move'],
];

function maxAbsDelta(a: Tensor, b: Tensor): { value: number; index: number } {
  let value = 0;
  let index = 0;
  for (let i = 0; i < a.size; i++) {
    const d = Math.abs(b.data[i] - a.data[i]);
    if (d > value) {
      value = d;
      index = i;
    }
  }
  return { value, index };
}

/** Short vectors in full; long ones (images) by size and range, so the list stays readable. */
function vec(d: ArrayLike<number>): string {
  const xs = Array.from(d);
  if (xs.length <= 8) return `x = [${xs.map(num).join(', ')}]`;
  return `x has ${xs.length} values between ${num(Math.min(...xs))} and ${num(Math.max(...xs))}`;
}

/** On the guided path, a parameter whose largest change is below this is reported only as "barely moved". */
export const TINY_CHANGE = 1e-4;

export function describeChanges(
  header: TraceHeader,
  prev: ExecState | null,
  cur: ExecState | null,
  /** The guided path: plain wording, tiny parameter changes collapsed into one line (Fix Round 5, 1.5). */
  guided = false,
): string[] {
  if (!cur || !prev) return [];
  const out: string[] = [];
  const n = cur.cursor - prev.cursor;
  if (n === 0)
    return [
      guided ? 'Nothing changed: you are at the same point.' : 'Nothing changed: the cursor did not move.',
    ];
  const pass = cur.path?.epoch;
  out.push(
    guided
      ? n > 0
        ? `${n} calculation step${n > 1 ? 's' : ''} done.`
        : `You’ve moved back to ${pass === null || pass === undefined ? 'before training began' : `partway through pass ${pass + 1}`}. Everything on screen is exactly as it was then.`
      : n > 0
        ? `${n} instruction${n > 1 ? 's' : ''} executed.`
        : `Stepped back over ${-n} instruction${n < -1 ? 's' : ''}; the state is restored exactly as it was.`,
  );

  if (cur.completedEpochs !== prev.completedEpochs)
    out.push(
      guided
        ? `Passes through the data completed: ${prev.completedEpochs} → ${cur.completedEpochs}.`
        : `Completed epochs: ${prev.completedEpochs} → ${cur.completedEpochs}.`,
    );
  if (
    cur.sample &&
    (!prev.sample ||
      cur.sample.datasetIndex !== prev.sample.datasetIndex ||
      cur.path?.batch !== prev.path?.batch)
  )
    out.push(
      `A new example is in the network: training example ${cur.sample.datasetIndex + 1} (${vec(cur.sample.x.data)}).`,
    );

  let barely = 0;
  for (const p of header.model.params) {
    const a = prev.params[p.name];
    const b = cur.params[p.name];
    if (!b) continue;
    if (!a) {
      out.push(`${capital(paramTitle(header, p.name))} [[${p.name}]] were initialised.`);
      continue;
    }
    if (a.producedBy === b.producedBy) continue;
    const d = maxAbsDelta(a.value, b.value);
    const delta = b.value.data[d.index] - a.value.data[d.index];
    // A zero change is not a change; on the guided path a tiny one is not worth a line each (Fix Round 5, 1.5).
    if (delta === 0) continue;
    if (guided && Math.abs(delta) < TINY_CHANGE) {
      barely++;
      continue;
    }
    out.push(
      `${capital(paramTitle(header, p.name))} [[${p.name}]] changed: the largest change is ${num(b.value.data[d.index] - a.value.data[d.index])} (element ${d.index + 1}, ${num(a.value.data[d.index])} → ${num(b.value.data[d.index])}).`,
    );
  }

  if (barely)
    out.push(
      `${out.some((t) => t.includes(' changed: ')) ? 'The other parameters' : 'The parameters'} barely moved (each by less than ${num(TINY_CHANGE)}).`,
    );

  if (cur.sample && prev.sample && cur.sample.datasetIndex === prev.sample.datasetIndex) {
    for (const l of header.model.layers) {
      const A = prev.sample.layers[l.name] ?? {};
      const B = cur.sample.layers[l.name] ?? {};
      const fresh = LAYER_FIELDS.filter(([f]) => B[f] && !A[f]).map(([, label, plain]) =>
        guided ? plain : label,
      );
      if (fresh.length)
        out.push(
          `${capital(layerTitle(header, l.name))}: ${fresh.join(', ')} ${fresh.length > 1 ? 'are' : 'is'} now known.`,
        );
    }
  }
  if (cur.sample?.loss !== undefined && cur.sample.loss !== prev.sample?.loss)
    out.push(
      guided
        ? `How far off this guess was: ${num(cur.sample.loss)}.`
        : `Example loss ℓ = ${num(cur.sample.loss)}.`,
    );
  if (cur.batchLoss !== undefined && cur.batchLoss !== prev.batchLoss)
    out.push(
      guided
        ? `How far off the batch was on average: ${num(cur.batchLoss)}.`
        : `Batch loss L = ${num(cur.batchLoss)}.`,
    );
  if (cur.lastEval && cur.lastEval.epoch !== prev.lastEval?.epoch)
    out.push(
      `Evaluation after epoch ${cur.lastEval.epoch + 1}: loss ${num(cur.lastEval.loss)}${cur.lastEval.accuracy !== null ? `, accuracy ${num(cur.lastEval.accuracy * 100)}%` : ''}${prev.lastEval ? ` (was ${num(prev.lastEval.loss)})` : ''}.`,
    );
  return out;
}

const capital = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

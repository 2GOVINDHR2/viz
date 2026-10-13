/**
 * "What changed since the previous step": a comparison of two reconstructed
 * states, phrased for the learner. Like every explanation it is derived from
 * the trace, so it reports exactly what the step did.
 */
import type { TraceHeader } from '../core/npm/ir';
import type { ExecState, LayerState } from '../core/npm/state';
import type { Tensor } from '../core/tensor/tensor';
import { num } from './format';

const LAYER_FIELDS: [keyof LayerState, string][] = [
  ['u', 'weighted sums u'],
  ['z', 'pre-activations z'],
  ['a', 'outputs a'],
  ['gradA', 'output gradients ∂ℓ/∂a'],
  ['gradZ', 'error signals ∂ℓ/∂z'],
  ['gradW', 'weight gradients ∂ℓ/∂W'],
  ['gradB', 'bias gradients ∂ℓ/∂b'],
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

export function describeChanges(
  header: TraceHeader,
  prev: ExecState | null,
  cur: ExecState | null,
): string[] {
  if (!cur || !prev) return [];
  const out: string[] = [];
  const n = cur.cursor - prev.cursor;
  if (n === 0) return ['Nothing changed: the cursor did not move.'];
  out.push(
    n > 0
      ? `${n} instruction${n > 1 ? 's' : ''} executed.`
      : `Stepped back over ${-n} instruction${n < -1 ? 's' : ''}; the state is restored exactly as it was.`,
  );

  if (cur.completedEpochs !== prev.completedEpochs)
    out.push(`Completed epochs: ${prev.completedEpochs} → ${cur.completedEpochs}.`);
  if (
    cur.sample &&
    (!prev.sample ||
      cur.sample.datasetIndex !== prev.sample.datasetIndex ||
      cur.path?.batch !== prev.path?.batch)
  )
    out.push(`A new example is in the network: #${cur.sample.datasetIndex} (${vec(cur.sample.x.data)}).`);

  for (const p of header.model.params) {
    const a = prev.params[p.name];
    const b = cur.params[p.name];
    if (!b) continue;
    if (!a) {
      out.push(`${p.name} was initialised.`);
      continue;
    }
    if (a.producedBy === b.producedBy) continue;
    const d = maxAbsDelta(a.value, b.value);
    out.push(
      `${p.name} changed: the largest change is ${num(b.value.data[d.index] - a.value.data[d.index])} (element ${d.index + 1}, ${num(a.value.data[d.index])} → ${num(b.value.data[d.index])}).`,
    );
  }

  if (cur.sample && prev.sample && cur.sample.datasetIndex === prev.sample.datasetIndex) {
    for (const l of header.model.layers) {
      const A = prev.sample.layers[l.name] ?? {};
      const B = cur.sample.layers[l.name] ?? {};
      const fresh = LAYER_FIELDS.filter(([f]) => B[f] && !A[f]).map(([, label]) => label);
      if (fresh.length)
        out.push(
          `Layer ${l.name.slice(1)}: ${fresh.join(', ')} ${fresh.length > 1 ? 'are' : 'is'} now known.`,
        );
    }
  }
  if (cur.sample?.loss !== undefined && cur.sample.loss !== prev.sample?.loss)
    out.push(`Example loss ℓ = ${num(cur.sample.loss)}.`);
  if (cur.batchLoss !== undefined && cur.batchLoss !== prev.batchLoss)
    out.push(`Batch loss L = ${num(cur.batchLoss)}.`);
  if (cur.lastEval && cur.lastEval.epoch !== prev.lastEval?.epoch)
    out.push(
      `Evaluation after epoch ${cur.lastEval.epoch + 1}: loss ${num(cur.lastEval.loss)}${cur.lastEval.accuracy !== null ? `, accuracy ${num(cur.lastEval.accuracy * 100)}%` : ''}${prev.lastEval ? ` (was ${num(prev.lastEval.loss)})` : ''}.`,
    );
  return out;
}

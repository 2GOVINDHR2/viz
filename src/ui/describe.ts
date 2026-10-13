/** Text equivalent of the visual state, for screen readers and as a running caption (WCAG 1.1.1). */
import type { TraceHeader } from '../core/npm/ir';
import type { ExecState } from '../core/npm/state';
import { num } from '../explain/format';

const PHASE: Record<string, string> = {
  init: 'initialisation',
  forward: 'forward pass',
  loss: 'loss',
  backward: 'backward pass',
  update: 'parameter update',
  eval: 'evaluation',
  control: 'control',
};

export function describeState(header: TraceHeader, exec: ExecState | null, length: number): string {
  if (!exec?.current)
    return `Ready. The training run has ${length.toLocaleString('en')} instructions. Nothing has executed yet.`;
  const p = exec.current.path;
  const parts: string[] = [`Instruction ${exec.cursor + 1} of ${length.toLocaleString('en')}.`];
  if (p.epoch !== null)
    parts.push(
      `Epoch ${p.epoch + 1} of ${header.epochStarts.length - 1}${p.batch !== null ? `, batch ${p.batch + 1}` : ''}${p.sample !== null ? `, example ${p.sample + 1} in the batch` : ''}.`,
    );
  parts.push(`Phase: ${PHASE[p.phase] ?? p.phase}${p.layer ? `, layer ${p.layer.slice(1)}` : ''}.`);
  if (exec.sample) {
    parts.push(
      `Input x = [${Array.from(exec.sample.x.data).map(num).join(', ')}], target y = [${Array.from(exec.sample.y.data).map(num).join(', ')}].`,
    );
    const out = exec.sample.layers[header.model.layers[header.model.layers.length - 1].name]?.a;
    if (out) parts.push(`Prediction ${Array.from(out.data).map(num).join(', ')}.`);
    if (exec.sample.loss !== undefined) parts.push(`Example loss ${num(exec.sample.loss)}.`);
  }
  if (exec.batchLoss !== undefined) parts.push(`Batch loss ${num(exec.batchLoss)}.`);
  if (exec.eval)
    parts.push(
      `Last evaluation: loss ${num(exec.eval.loss)}${exec.eval.accuracy !== null ? `, accuracy ${num(exec.eval.accuracy * 100)}%` : ''}.`,
    );
  return parts.join(' ');
}

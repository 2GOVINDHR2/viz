/** Text equivalent of the visual state, for screen readers and as a running caption (WCAG 1.1.1). */
import type { TraceHeader } from '../core/npm/ir';
import type { ExecState } from '../core/npm/state';
import { num } from '../explain/format';
import { learnerGloss, layerTitle } from '../explain/names';

const PHASE: Record<string, string> = {
  init: 'initialisation',
  forward: 'forward pass',
  loss: 'loss',
  backward: 'backward pass',
  update: 'parameter update',
  eval: 'evaluation',
  control: 'control',
};

export function describeState(
  header: TraceHeader,
  exec: ExecState | null,
  length: number,
  /** The guided path: no instruction numbers (ADR-062). */
  guided = false,
): string {
  if (!exec?.current)
    return guided
      ? 'Ready. Nothing has been calculated yet.'
      : `Ready. The training run has ${length.toLocaleString('en')} instructions. The training run has not started yet.`;
  const p = exec.current.path;
  const parts: string[] = guided
    ? [capital(learnerGloss(header, exec.current))]
    : [`Instruction ${(exec.cursor + 1).toLocaleString('en')} of ${length.toLocaleString('en')}.`];
  if (p.epoch !== null)
    parts.push(
      `${guided ? 'Pass' : 'Epoch'} ${p.epoch + 1} of ${header.epochStarts.length - 1}${p.batch !== null ? `, batch ${p.batch + 1}` : ''}${p.sample !== null ? `, example ${p.sample + 1} in the batch` : ''}.`,
    );
  parts.push(
    `${guided ? 'Stage' : 'Phase'}: ${PHASE[p.phase] ?? p.phase}${p.layer ? `, ${layerTitle(header, p.layer)}` : ''}.`,
  );
  if (exec.sample) {
    parts.push(
      guided
        ? `Input ${vector(exec.sample.x.data)}, correct answer ${Array.from(exec.sample.y.data).map(num).join(', ')}.`
        : `Input x = ${vector(exec.sample.x.data)}, target y = [${Array.from(exec.sample.y.data).map(num).join(', ')}].`,
    );
    const out = exec.sample.layers[header.model.layers[header.model.layers.length - 1].name]?.a;
    if (out) parts.push(`Prediction ${Array.from(out.data).map(num).join(', ')}.`);
    if (exec.sample.loss !== undefined)
      parts.push(
        guided ? `How far off: ${num(exec.sample.loss)}.` : `Example loss ${num(exec.sample.loss)}.`,
      );
  }
  if (exec.batchLoss !== undefined)
    parts.push(guided ? `Batch average: ${num(exec.batchLoss)}.` : `Batch loss ${num(exec.batchLoss)}.`);
  if (exec.eval)
    parts.push(
      `Last evaluation: loss ${num(exec.eval.loss)}${exec.eval.accuracy !== null ? `, accuracy ${num(exec.eval.accuracy * 100)}%` : ''}.`,
    );
  return parts.join(' ');
}

/** A vector in a sentence; a long one (an image) is summarised, not listed in full. */
function vector(d: ArrayLike<number>): string {
  if (d.length <= 16) return `[${Array.from(d).map(num).join(', ')}]`;
  let nz = 0;
  for (let k = 0; k < d.length; k++) if (d[k] !== 0) nz++;
  return `${d.length} values (${nz} non-zero)`;
}

const capital = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Where the run is, for the position read-out. Expert mode counts instructions; the guided path names the place
 * in the run's own hierarchy instead (pass, batch, example, phase, layer), with no instruction number (ADR-062).
 */
export function positionText(
  header: TraceHeader,
  exec: ExecState | null,
  length: number,
  guided: boolean,
): string {
  if (!guided)
    return `Instruction ${((exec?.cursor ?? -1) + 1).toLocaleString('en')} / ${length.toLocaleString('en')}`;
  const p = exec?.current?.path;
  if (!p) return 'Not started';
  const where: string[] = [];
  if (p.epoch !== null) where.push(`pass ${p.epoch + 1} of ${header.epochStarts.length - 1}`);
  if (p.batch !== null) where.push(`batch ${p.batch + 1}`);
  if (p.sample !== null) where.push(`example ${p.sample + 1}`);
  where.push(`${PHASE[p.phase] ?? p.phase}${p.layer ? `, ${layerTitle(header, p.layer)}` : ''}`);
  return capital(where.join(' · '));
}

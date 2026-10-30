/**
 * Test values for every declared parameter (Fix Round 3, invariants F–H). For a parameter in a given setting:
 *  - `alternative`: a valid value other than the current one, as a learner might type it;
 *  - `divergent`: a valid value that makes training diverge, where the parameter can (learning rate, scale);
 *  - `invalid`: entries the engine cannot run, each of which must be rejected with a message.
 *
 * Continuous values are deliberately not round (0.411, 1.137), so a rounding or clamping defect cannot hide
 * behind a value it leaves unchanged.
 *
 * Pure: imports only the application's own modules, so the e2e suite can use it too.
 */
import { paramPresets, paramValue, validateParam, type Setting } from '../../src/experiments/params';
import type { EditableParam } from '../../src/experiments/types';

function candidates(s: Setting, p: EditableParam): (number | string)[] {
  const now = paramValue(s, p);
  const n = Number(now);
  switch (p.kind) {
    case 'activation':
    case 'loss':
      return paramPresets(p);
    case 'probe':
      return p.min !== undefined && p.max !== undefined
        ? [p.min + 0.37 * (p.max - p.min), p.min + 0.63 * (p.max - p.min)]
        : [n * 1.37, n / 2];
    case 'learningRate':
      // A value no preset or rounding would produce, so a typed value is seen to arrive exactly.
      return [Number((n * 1.37).toPrecision(4)), ...paramPresets(p)];
    case 'batchSize':
      return [...paramPresets(p), n - 1, n + 1];
    case 'epochs':
      return [n - 1, n + 1];
    case 'seed':
      return [n + 1];
    case 'depth':
    case 'hiddenUnits':
      return [n - 1, n + 1];
    case 'initScale':
      return [1.37, 0.5];
    case 'conv':
      return [n - 1, n + 1];
    case 'input':
      return [Number((n + 0.537).toPrecision(6))];
    case 'target':
      return [0.37, 1 - n];
    case 'initialValue':
      return [Number((n + 1.137).toPrecision(6))];
  }
}

/** A valid value different from the current one (the first of a short list that validates). */
export function alternative(s: Setting, p: EditableParam, perEpoch = 0): number | string {
  const now = String(paramValue(s, p));
  for (const c of candidates(s, p)) {
    if (String(c) === now) continue;
    // The candidate as typed, not as validation returns it: a validator that alters values must not hide it.
    if (validateParam(s, p, String(c), perEpoch).ok) return c;
  }
  throw new Error(`no alternative value for ${p.kind}`);
}

/** A value that training accepts and that makes it diverge, for the parameters that can. */
export function divergent(p: EditableParam): string | null {
  switch (p.kind) {
    case 'learningRate':
      return '50';
    case 'initScale':
      return '1000';
    case 'probe':
      return p.id.startsWith('lr:') ? '50' : null;
    default:
      return null;
  }
}

/**
 * An extreme value that is still valid: it must be accepted and run. It need not diverge (a huge input to a
 * sigmoid saturates it rather than diverging), but any non-finite value it produces must reach the NaN/∞ path.
 */
export function extreme(p: EditableParam): string | null {
  return p.kind === 'initialValue' || p.kind === 'input' ? '1e6' : null;
}

/** Entries that must be rejected with a message. */
export function invalid(s: Setting, p: EditableParam): string[] {
  switch (p.kind) {
    case 'activation':
    case 'loss':
      return ['banana'];
    case 'probe':
      return p.min !== undefined && p.max !== undefined ? ['abc', String(p.max + 1)] : ['abc', ''];
    case 'learningRate':
    case 'initialValue':
    case 'input':
    case 'initScale':
      return ['abc', '1..2', ''];
    case 'target':
      return s.config.loss === 'bce' ? ['abc', '2', '-1'] : ['abc'];
    case 'conv':
      return ['abc', p.field === 'padding' ? '-1' : '0', '1.5', '100'];
    case 'seed':
      return ['abc', '1.5', '-3', String(2 ** 32)];
    default:
      return ['abc', '0', '1.5', '-3'];
  }
}

/** Number and tensor formatting for explanations (LaTeX and plain text). */
import type { Tensor } from '../core/tensor/tensor';

/** Four significant digits; scientific notation outside [1e-3, 1e4). */
export function num(v: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e-3 && a < 1e4) return String(Number(v.toPrecision(4)));
  return v.toExponential(2).replace('e', '×10^').replace('^+', '^');
}

/** LaTeX rendering of a number, with explicit sign handling and \times10^{…} exponents. */
export function tex(v: number): string {
  if (Number.isNaN(v)) return '\\text{NaN}';
  if (!Number.isFinite(v)) return v > 0 ? '\\infty' : '-\\infty';
  const s = num(v);
  const m = /^(-?[\d.]+)×10\^(-?\d+)$/.exec(s);
  return m ? `${m[1]}\\times10^{${m[2]}}` : s;
}

/** Parenthesise negatives so substituted products read correctly: 2 · (−0.5). */
export const texp = (v: number): string => (v < 0 || Object.is(v, -0) ? `(${tex(v)})` : tex(v));

/** Row vector, truncated with an ellipsis beyond `max` entries. */
export function texVec(t: Tensor | ArrayLike<number>, max = 6): string {
  const d = 'data' in t ? (t as Tensor).data : (t as ArrayLike<number>);
  const n = d.length;
  const shown = Array.from({ length: Math.min(n, max) }, (_, i) => tex(d[i]));
  if (n > max) shown.push('\\cdots');
  return `\\begin{bmatrix}${shown.join(' & ')}\\end{bmatrix}`;
}

export function shapeText(t: Tensor): string {
  return t.shape.length ? t.shape.join('×') : 'scalar';
}

/** Flat index → multi-index for a shape. */
export function unravel(index: number, shape: readonly number[]): number[] {
  const out = new Array<number>(shape.length);
  let r = index;
  for (let i = shape.length - 1; i >= 0; i--) {
    out[i] = r % shape[i];
    r = Math.floor(r / shape[i]);
  }
  return out;
}

export function norm(t: Tensor): number {
  let s = 0;
  for (let i = 0; i < t.size; i++) s += t.data[i] * t.data[i];
  return Math.sqrt(s);
}

/** Sum of substituted terms, truncated to `max` terms: "a·b + c·d + ⋯". */
export function texSum(terms: string[], max = 4): string {
  if (terms.length <= max) return terms.join(' + ');
  return `${terms.slice(0, max - 1).join(' + ')} + \\cdots + ${terms[terms.length - 1]}`;
}

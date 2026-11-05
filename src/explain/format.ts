/** Number and tensor formatting for explanations (LaTeX and plain text). */
import type { Tensor } from '../core/tensor/tensor';

const SUPER: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/** Mantissa and exponent with three significant digits, for values outside [1e-3, 1e4). */
function sci(v: number): { m: string; e: string } {
  const [m, e] = v.toExponential(2).split('e');
  return { m, e: String(Number(e)) };
}

const plainRange = (a: number): boolean => a >= 1e-3 && a < 1e4;

/**
 * Who is reading (Fix Round 5, 1.3; ADR-069). The one display-formatting layer between the engine and every surface
 * that renders a number: the guided path reads numbers as a person would say them ("essentially zero",
 * "0.00047", "12,400", "3.2 million"), never scientific notation; expert mode keeps four significant digits with
 * scientific notation. The value itself is never changed: full precision is `exact`, shown on focus or hover.
 *
 * Set once per render from the mode (App); everything that formats through `num`/`tex` follows it. Exports and the
 * trace listing call `expertNum`, which ignores it.
 */
export type Reader = 'guided' | 'expert';
let reader: Reader = 'expert';
export function setReader(r: Reader): void {
  reader = r;
}
export const currentReader = (): Reader => reader;

/** Below this magnitude the guided path says "essentially zero". */
export const ESSENTIALLY_ZERO = 1e-6;

const SCALE: [number, string][] = [
  [1e12, 'trillion'],
  [1e9, 'billion'],
  [1e6, 'million'],
];

/** A number as the guided path says it: plain decimals, words for the very small and the very large. */
export function plainNum(v: number): string {
  if (Number.isNaN(v)) return 'not a number';
  if (!Number.isFinite(v)) return v > 0 ? 'infinitely large' : 'infinitely negative';
  if (v === 0) return '0';
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a < ESSENTIALLY_ZERO) return 'essentially zero';
  if (a < 1e-3) return sign + String(Number(a.toPrecision(2)));
  if (a < 1e4) return sign + String(Number(a.toPrecision(4)));
  if (a >= 1e15) return `${sign}more than a thousand trillion`;
  for (const [s, w] of SCALE) if (a >= s) return `${sign}${Number((a / s).toPrecision(3))} ${w}`;
  return sign + Math.round(a).toLocaleString('en-US');
}

/** The full-precision value, for a title or a focused field. */
export const exact = (v: number): string => (Number.isFinite(v) ? String(v) : num(v));

/** Four significant digits; scientific notation (1.13×10⁻⁷) outside [1e-3, 1e4); the guided path says it plainly. */
export function num(v: number): string {
  return reader === 'guided' ? plainNum(v) : expertNum(v);
}

/** The expert form whoever is reading: four significant digits, scientific notation outside [1e-3, 1e4). */
export function expertNum(v: number): string {
  if (Number.isNaN(v)) return 'NaN';
  if (!Number.isFinite(v)) return v > 0 ? '∞' : '−∞';
  if (v === 0) return '0';
  if (plainRange(Math.abs(v))) return String(Number(v.toPrecision(4)));
  const { m, e } = sci(v);
  return `${m}×10${e.replace(/./g, (c) => SUPER[c] ?? c)}`;
}

/** LaTeX rendering of a number, with \times10^{…} exponents. */
export function tex(v: number): string {
  if (reader === 'guided') {
    const p = plainNum(v);
    return /[a-z]/.test(p) ? `\\text{${p.replace('−', '-')}}` : p.replace('−', '-').replace(/,/g, '{,}');
  }
  if (Number.isNaN(v)) return '\\text{NaN}';
  if (!Number.isFinite(v)) return v > 0 ? '\\infty' : '-\\infty';
  if (v === 0 || plainRange(Math.abs(v))) return v === 0 ? '0' : String(Number(v.toPrecision(4)));
  const { m, e } = sci(v);
  return `${m}\\times10^{${e}}`;
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

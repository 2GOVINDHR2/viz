/** Small SVG-writing helpers shared by the figure builders. */
import { INK, type PrintMode } from './ink';

export const FONT = "'DejaVu Sans', Arial, Helvetica, sans-serif";

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SUP: Record<string, string> = {
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
/** 10 to an integer power with superscript digits, e.g. 10⁻⁴. */
export const pow10 = (e: number): string => `10${String(e).replace(/./g, (c) => SUP[c] ?? c)}`;

export const fmt = (v: number, d = 4): string => {
  if (!Number.isFinite(v)) return String(v);
  if (v !== 0 && (Math.abs(v) < 1e-3 || Math.abs(v) >= 1e5)) return v.toExponential(2);
  return String(Number(v.toPrecision(d)));
};

export function text(
  x: number,
  y: number,
  s: string,
  o: {
    size?: number;
    anchor?: 'start' | 'middle' | 'end';
    weight?: number;
    fill?: string;
    rotate?: boolean;
  } = {},
): string {
  const t = o.rotate ? ` transform="rotate(-90 ${x} ${y})"` : '';
  return `<text x="${x}" y="${y}" font-size="${o.size ?? 11}" text-anchor="${o.anchor ?? 'start'}"${o.weight ? ` font-weight="${o.weight}"` : ''} fill="${o.fill ?? '#000'}"${t}>${esc(s)}</text>`;
}

export function wrap(s: string, maxChars: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of s.split(/\s+/)) {
    if (line && (line + ' ' + w).length > maxChars) {
      lines.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines;
}

/** A complete, standalone figure: white background, title, body, caption. No UI chrome. */
export function frame(
  body: string,
  w: number,
  h: number,
  o: { title: string; caption: string; mode: PrintMode },
): string {
  const ink = INK[o.mode];
  const pad = 12;
  // Wide enough for the title (≈ 7.6 px per character at 13 px bold).
  w = Math.max(w, Math.ceil(o.title.length * 7.6), 300);
  const cap = wrap(o.caption, Math.floor((w - 2 * pad) / 6.1));
  const capH = cap.length ? cap.length * 14 + 10 : 0;
  const W = w + 2 * pad;
  const H = h + 30 + capH + pad;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`,
    `<title>${esc(o.title)}</title>`,
    `<rect width="${W}" height="${H}" fill="#ffffff"/>`,
    text(pad, 20, o.title, { size: 13, weight: 700, fill: ink.text }),
    `<g transform="translate(${pad},30)">${body}</g>`,
    ...cap.map((l, k) => text(pad, 30 + h + 18 + k * 14, l, { size: 10.5, fill: ink.text })),
    '</svg>',
  ].join('\n');
}

/** Linear or log axis ticks. */
export function ticks(lo: number, hi: number, n = 5, log = false): number[] {
  if (log) {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) out.push(10 ** e);
    return out.filter((t) => t >= lo * 0.999 && t <= hi * 1.001);
  }
  const span = hi - lo || 1;
  const step = 10 ** Math.floor(Math.log10(span / n));
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => span / s <= n) ?? step * 10;
  const out: number[] = [];
  for (let t = Math.ceil(lo / nice) * nice; t <= hi + 1e-12; t += nice) out.push(Number(t.toPrecision(12)));
  return out;
}

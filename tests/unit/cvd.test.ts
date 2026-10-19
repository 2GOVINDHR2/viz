/**
 * Colour-vision-deficiency check of every hue pair that carries meaning.
 * Protanopia and deuteranopia are simulated with the Machado, Oliveira &
 * Fernandes (2009) matrices at severity 1.0 in linear RGB; distance is
 * ΔE in OKLab × 100. Target: ≥ 15 for every pair (Fix Round 1, B7); every pair also has a
 * non-colour cue (dash pattern, label, icon or border pattern). The numbers are written to reports/cvd.json.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

type RGB = [number, number, number];
const MACHADO: Record<'protan' | 'deutan', number[][]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
};
const hex = (h: string): RGB => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16) / 255) as RGB;
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function oklab([r, g, b]: RGB): RGB {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function sim(h: string, kind: 'normal' | 'protan' | 'deutan'): RGB {
  const c = hex(h).map(lin) as RGB;
  if (kind === 'normal') return c;
  const M = MACHADO[kind];
  return M.map((row) => Math.min(1, Math.max(0, row[0] * c[0] + row[1] * c[1] + row[2] * c[2]))) as RGB;
}
const dE = (a: string, b: string, kind: 'normal' | 'protan' | 'deutan') => {
  const [x, y] = [oklab(sim(a, kind)), oklab(sim(b, kind))];
  return 100 * Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

const PAIRS: { name: string; a: string; b: string; min: number }[] = [
  { name: 'series 1–2 (light)', a: '#2a78d6', b: '#863103', min: 15 },
  { name: 'series 2–3 (light)', a: '#863103', b: '#1baf7a', min: 15 },
  { name: 'series 1–3 (light)', a: '#2a78d6', b: '#1baf7a', min: 15 },
  { name: 'series 1–2 (dark)', a: '#3987e5', b: '#995c00', min: 15 },
  { name: 'series 2–3 (dark)', a: '#995c00', b: '#13ae8a', min: 15 },
  { name: 'series 1–3 (dark)', a: '#3987e5', b: '#13ae8a', min: 15 },
  { name: 'positive vs negative weight / value', a: '#0072b2', b: '#d55e00', min: 15 },
  { name: 'forward vs backward mode', a: '#0072b2', b: '#631d39', min: 15 },
  { name: 'backward vs update mode', a: '#631d39', b: '#946200', min: 15 },
  { name: 'forward vs update mode', a: '#0072b2', b: '#946200', min: 15 },
  { name: 'forward vs backward mode (dark)', a: '#56b4e9', b: '#d2656a', min: 15 },
  { name: 'backward vs update mode (dark)', a: '#d2656a', b: '#e3b23c', min: 15 },
  { name: 'forward vs update mode (dark)', a: '#56b4e9', b: '#e3b23c', min: 15 },
];

describe('palettes under colour-vision deficiency', () => {
  const rows = PAIRS.map((p) => ({
    ...p,
    normal: +dE(p.a, p.b, 'normal').toFixed(1),
    protan: +dE(p.a, p.b, 'protan').toFixed(1),
    deutan: +dE(p.a, p.b, 'deutan').toFixed(1),
  }));
  writeFileSync(resolve(import.meta.dirname, '../../reports/cvd.json'), JSON.stringify(rows, null, 2) + '\n');

  for (const r of rows)
    it(`${r.name}: ΔE ≥ ${r.min} for protanopia and deuteranopia`, () => {
      expect(r.protan).toBeGreaterThanOrEqual(r.min);
      expect(r.deutan).toBeGreaterThanOrEqual(r.min);
      expect(r.normal).toBeGreaterThanOrEqual(15);
    });

  it('the simulation reproduces known behaviour: red and green collapse for deuteranopes', () => {
    expect(dE('#d62728', '#2ca02c', 'deutan')).toBeLessThan(dE('#d62728', '#2ca02c', 'normal') / 2);
  });
});

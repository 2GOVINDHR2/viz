import { describe, expect, it } from 'vitest';
import { textOn, valueFill } from '../../src/views/execution/NetworkView';

function contrast(a: string, b: string): number {
  const lum = (c: string): number => {
    const m = c.startsWith('#')
      ? [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16))
      : (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const [r, g, bl] = m.map((x) => {
      const y = x / 255;
      return y <= 0.03928 ? y / 12.92 : ((y + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('neuron value text contrast (WCAG 1.4.3)', () => {
  it('keeps at least 4.5:1 between the printed value and the fill across the whole value range', () => {
    let worst = Infinity;
    for (let v = -1; v <= 1.0001; v += 0.01) worst = Math.min(worst, contrast(textOn(v), valueFill(v)));
    expect(worst).toBeGreaterThanOrEqual(4.5);
  });
});

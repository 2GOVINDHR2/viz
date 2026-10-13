/**
 * P9 figure export: the standard figure set is built from a trace file alone,
 * every figure is a standalone SVG with a CSV of what it draws, and the
 * greyscale and high-contrast modes contain no hue.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDataset } from '../../src/core/engine/host';
import { deserializeTrace, memorySource, storeSource, TraceStore } from '../../src/core/npm';
import { experimentById } from '../../src/experiments/registry';
import { figureSet } from '../../src/export/figures';
import { architectureTraces } from '../support/traces';

const xor = memorySource(
  deserializeTrace(readFileSync(resolve(import.meta.dirname, '../../samples/xor-mlp.trace.json'), 'utf8')),
);
const colours = (svg: string) => [...svg.matchAll(/#([0-9a-fA-F]{6})\b/g)].map((m) => m[1].toLowerCase());
const isGrey = (h: string) => h.slice(0, 2) === h.slice(2, 4) && h.slice(2, 4) === h.slice(4, 6);

/** Well-formedness check with Python's XML parser (no browser needed). */
function wellFormed(svgs: string[]): void {
  const dir = mkdtempSync(resolve(tmpdir(), 'svg-'));
  svgs.forEach((s, k) => writeFileSync(`${dir}/${k}.svg`, s));
  execFileSync('python3', [
    '-c',
    'import sys,glob,xml.dom.minidom as m\n[m.parse(f) for f in glob.glob(sys.argv[1]+"/*.svg")]',
    dir,
  ]);
}

describe('standard figure set from a trace file', () => {
  const figs = figureSet(xor, { mode: 'colour' });

  it('contains every applicable figure for a dense 2-D classifier', () => {
    expect(figs.map((f) => f.id)).toEqual([
      'architecture',
      'forward-pass',
      'backward-pass',
      'loss-curve',
      'gradient-magnitude',
      'decision-boundary',
    ]);
  });

  it('produces standalone, well-formed SVG without UI chrome or unresolved CSS variables', () => {
    for (const f of figs) {
      expect(f.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(f.svg).not.toMatch(/var\(--|tabindex|role="button"|aria-pressed/);
      expect(f.svg).toContain(`<title>${f.title.replace(/&/g, '&amp;')}</title>`);
    }
    wellFormed(figs.map((f) => f.svg));
  });

  it('writes a CSV of exactly the plotted numbers beside each figure', () => {
    const rows = (id: string) =>
      figs
        .find((f) => f.id === id)!
        .csv.trim()
        .split('\r\n')
        .slice(1);
    const epochs = xor.header.epochStarts.length - 1;
    expect(rows('loss-curve')).toHaveLength(epochs);
    expect(rows('architecture')).toHaveLength(xor.header.model.layers.length);
    expect(rows('gradient-magnitude')).toHaveLength(epochs * 2);
    const loss = figs
      .find((f) => f.id === 'loss-curve')!
      .csv.split('\r\n')[1]
      .split(',');
    expect(Number(loss[1])).toBeCloseTo(xor.get(xor.header.epochStarts[1] - 1).results.meanLoss.item(), 12);
  });

  it('greyscale and high-contrast figures use no hue at all', () => {
    for (const mode of ['greyscale', 'highContrast'] as const)
      for (const f of figureSet(xor, { mode })) {
        const hues = colours(f.svg).filter((c) => !isGrey(c));
        expect(hues, `${mode} ${f.id}`).toEqual([]);
        expect(f.svg).not.toMatch(/rgb\(/);
      }
  });

  it('uses a replacement caption when one is given', () => {
    const f = figureSet(xor, {
      mode: 'colour',
      captions: { 'loss-curve': 'Figure 3. Training curve & more.' },
    }).find((x) => x.id === 'loss-curve')!;
    expect(f.caption).toBe('Figure 3. Training curve & more.');
    expect(f.svg).toContain('Figure 3. Training curve &amp; more.');
  });

  it('at a cursor, shows only what the views show there (epochs completed so far)', () => {
    const mid = xor.header.epochStarts[1] + 3;
    const f = figureSet(xor, { mode: 'colour' }, mid);
    expect(
      f
        .find((x) => x.id === 'loss-curve')!
        .csv.trim()
        .split('\r\n'),
    ).toHaveLength(2);
    expect(f.some((x) => x.id === 'backward-pass')).toBe(false);
  });

  it('a CNN trace yields convolution feature maps with kernels, maps and pooled maps in its CSV', () => {
    const t = architectureTraces(1).find((x) => x.id === 'cnn')!;
    const f = figureSet(storeSource(t.store), { mode: 'greyscale' });
    expect(f.map((x) => x.id)).toContain('feature-maps');
    const kinds = new Set(
      f
        .find((x) => x.id === 'feature-maps')!
        .csv.split('\r\n')
        .slice(1, -1)
        .map((r) => r.split(',')[0]),
    );
    expect([...kinds].sort()).toEqual(['feature_map', 'input', 'kernel', 'pooled']);
    wellFormed(f.map((x) => x.svg));
  });

  it('a deep network gets room for every column (no overlap of column positions)', () => {
    const d1 = experimentById('vanishing-gradients');
    const src = storeSource(
      TraceStore.generate({ ...d1.config, epochs: 1 }, resolveDataset(d1.dataset)).store,
    );
    const svg = figureSet(src, { mode: 'colour' }).find((x) => x.id === 'forward-pass')!.svg;
    const xs = [...svg.matchAll(/<text x="([\d.]+)" y="22" class="col-label"/g)].map((m) => Number(m[1]));
    expect(xs).toHaveLength(10);
    for (let k = 1; k < xs.length; k++) expect(xs[k] - xs[k - 1]).toBeGreaterThanOrEqual(140);
  });
});

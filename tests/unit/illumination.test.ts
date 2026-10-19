/**
 * Illumination contract (Fix Round 2, §3.2). For every experiment, every
 * instruction of the first batch and its update — plus the epoch and
 * evaluation boundaries — must light something, and the view that draws the
 * network must render exactly what the contract says (elements marked
 * `data-lit`).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { registerAsset, resolveDataset } from '../../src/core/engine/host';
import { TraceStore, reconstructState, storeSource } from '../../src/core/npm';
import { loadMnist } from '../../src/experiments/data/mnist';
import { EXPERIMENTS } from '../../src/experiments/registry';
import { ConvView } from '../../src/views/execution/ConvView';
import { NetworkView } from '../../src/views/execution/NetworkView';
import { illumination, isLit } from '../../src/views/illumination';

registerAsset('mnist-012', loadMnist);

describe('every instruction lights its target in the view', () => {
  for (const e of EXPERIMENTS) {
    it(`${e.number} ${e.title}`, () => {
      const { store } = TraceStore.generate({ ...e.config, epochs: 1 }, resolveDataset(e.dataset));
      const src = storeSource(store);
      const conv = src.header.model.layers.some((l) => l.type === 'conv2d');
      // The prologue, one full example, the first update, and the end of the epoch.
      const firstUpdateEnd = (() => {
        for (let c = 0; c < src.length; c++) if (src.get(c).kind === 'BATCH_END') return c;
        return src.length - 1;
      })();
      const cursors = [
        ...Array.from({ length: Math.min(firstUpdateEnd + 1, conv ? 120 : 400) }, (_, c) => c),
        ...Array.from({ length: 8 }, (_, k) => src.length - 1 - k),
      ];
      const kinds = new Set<string>();
      for (const c of cursors) {
        const exec = reconstructState(src, c);
        const lit = illumination(src.header, exec);
        expect(isLit(lit), `${exec.current!.kind} at ${c} lights nothing`).toBe(true);
        const html = renderToStaticMarkup(
          createElement(conv ? ConvView : NetworkView, {
            header: src.header,
            exec,
            focus: null,
            onFocus: () => undefined,
          }),
        );
        expect(html, `${exec.current!.kind} at ${c} renders nothing lit`).toMatch(/data-lit="/);
        if (lit.loss) expect(html).toMatch(/data-lit="loss"/);
        if (lit.network) expect(html).toMatch(/data-lit="network"/);
        kinds.add(exec.current!.kind);
      }
      expect(kinds.size).toBeGreaterThan(8);
    });
  }
});

describe('the lit element is the right one', () => {
  it('a bias update lights the bias, not the weights', () => {
    const e = EXPERIMENTS[0];
    const { store } = TraceStore.generate({ ...e.config, epochs: 1 }, resolveDataset(e.dataset));
    const src = storeSource(store);
    let seen = 0;
    for (let c = 0; c < src.length; c++) {
      const ins = src.get(c);
      if (ins.kind !== 'APPLY_UPDATE') continue;
      const lit = illumination(src.header, reconstructState(src, c));
      if (String(ins.meta.param).endsWith('.b')) expect([lit.bias, lit.edges]).toEqual(['L1', null]);
      else expect([lit.bias, lit.edges]).toEqual([null, 'L1']);
      seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });
});

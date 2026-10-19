/**
 * Fix Round 2, §3.1: the explanation's Simple/Detailed control must change
 * what is displayed for every instruction, not only for the few kinds that
 * carry an extra sentence. Simple hides the formulas behind in-place reveals;
 * Detailed shows the instruction, the formulas and every change.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveDataset } from '../../src/core/engine/host';
import { TraceStore, reconstructState, storeSource } from '../../src/core/npm';
import type { Tensor } from '../../src/core/tensor/tensor';
import { ExplanationPanel } from '../../src/explain/ExplanationPanel';
import { EXPERIMENTS } from '../../src/experiments/registry';

describe('explanation verbosity changes the output', () => {
  for (const id of ['single-neuron', 'xor-mlp']) {
    it(id, () => {
      const e = EXPERIMENTS.find((x) => x.id === id)!;
      const { store } = TraceStore.generate({ ...e.config, epochs: 1 }, resolveDataset(e.dataset));
      const src = storeSource(store);
      const kinds = new Set<string>();
      for (let c = 0; c < Math.min(src.length, 300); c++) {
        const exec = reconstructState(src, c);
        const operands: Record<string, Tensor> = {};
        for (const o of exec.current!.operands)
          operands[`${o.ref}.${o.slot}`] = src.get(o.ref).results[o.slot];
        const render = (verbosity: 'novice' | 'detailed') =>
          renderToStaticMarkup(
            createElement(ExplanationPanel, {
              header: src.header,
              exec,
              operands,
              focusIndex: 0,
              verbosity,
              onVerbosity: () => undefined,
              changes: [],
            }),
          );
        const simple = render('novice');
        const detailed = render('detailed');
        expect(simple, exec.current!.kind).not.toEqual(detailed);
        expect(simple).not.toContain('In general');
        expect(detailed).toContain('In general');
        expect(detailed).toContain(`<code>${exec.current!.kind}</code>`);
        kinds.add(exec.current!.kind);
      }
      expect(kinds.size).toBeGreaterThan(10);
    });
  }
});

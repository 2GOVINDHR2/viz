/**
 * Fix Round 2, §2.2 principle 5 and §2.3: each experiment declares its
 * surface; step sizes unlock with the curriculum; nothing undeclared renders.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveDataset } from '../../src/core/engine/host';
import { TraceStore, reconstructState, storeSource } from '../../src/core/npm';
import { GRANULARITIES } from '../../src/core/npm/stats';
import { EXPERIMENTS } from '../../src/experiments/registry';
import {
  UNLOCKED_BY,
  isUnlocked,
  offeredGranularities,
  startingGranularity,
} from '../../src/experiments/surface';
import { StructureView } from '../../src/views/structure/StructureView';

describe('granularity unlocked by the curriculum', () => {
  it('follows the table of the brief', () => {
    expect(UNLOCKED_BY).toEqual({
      operation: 'single-neuron',
      layer: 'forward-propagation',
      phase: 'backpropagation',
      sample: 'gradient-descent',
      batch: 'gradient-descent',
      epoch: 'xor-mlp',
    });
  });
  for (const e of EXPERIMENTS) {
    it(`${e.number} ${e.title}: declares only taught step sizes; novice and expert start within what they offer`, () => {
      expect(e.surface.granularities.length).toBeGreaterThan(0);
      for (const g of e.surface.granularities) expect(isUnlocked(g, e), g).toBe(true);
      expect(offeredGranularities(e, 'novice')).toContain(startingGranularity(e, 'novice'));
      expect(offeredGranularities(e, 'expert')).toEqual([...GRANULARITIES]);
      expect(startingGranularity(e, 'expert')).toBe(e.defaultGranularity);
    });
  }
  it('every step size is available by the CNN experiment', () => {
    expect(EXPERIMENTS.find((e) => e.id === 'cnn-mnist')!.surface.granularities.sort()).toEqual(
      [...GRANULARITIES].sort(),
    );
  });
});

describe('the architecture editor renders only where declared (§3.3)', () => {
  it('declared exactly for experiments whose network has a hidden layer to edit', () => {
    for (const e of EXPERIMENTS) {
      const dense = e.config.model.layers.every((l) => l.type === 'dense');
      if (e.surface.architectureEditor) expect(dense && e.config.model.layers.length > 1, e.id).toBe(true);
    }
    expect(EXPERIMENTS.find((e) => e.id === 'single-neuron')!.surface.architectureEditor).toBe(false);
  });
  for (const e of EXPERIMENTS.filter((x) => x.config.model.layers.every((l) => l.type === 'dense'))) {
    it(`${e.number} ${e.title}: "add hidden layer" ${e.surface.architectureEditor ? 'is' : 'is not'} offered`, () => {
      const { store } = TraceStore.generate({ ...e.config, epochs: 1 }, resolveDataset(e.dataset));
      const src = storeSource(store);
      const html = renderToStaticMarkup(
        createElement(StructureView, {
          header: src.header,
          exec: reconstructState(src, -1),
          config: e.config,
          defaults: e.config,
          busy: false,
          onReconfigure: () => undefined,
          allowEdit: e.surface.architectureEditor,
        }),
      );
      expect(html.includes('add hidden layer')).toBe(e.surface.architectureEditor);
    });
  }
});

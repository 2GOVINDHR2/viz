/**
 * Fix Round 5, 1.4 (ADR-071): canvas annotations are declared per experiment. Experiments 1–5 draw no gradients;
 * experiment 4's ∂ℓ/∂z moved to an experiment 6 walkthrough step, whose claim (∂ℓ/∂z = ŷ − y for a sigmoid output
 * with cross-entropy) is checked here against the trace.
 */
import { describe, expect, it } from 'vitest';
import { renderedAnnotations } from '../../src/experiments/controls';
import { EXPERIMENTS, experimentById } from '../../src/experiments/registry';
import { lab, open, renderApp } from '../support/lab';

describe('1.4 canvas annotations', () => {
  it('experiments 1–5 declare no error signal; 6 onwards may draw one', () => {
    for (const e of EXPERIMENTS.slice(0, 5)) expect(e.surface.annotations, e.id).not.toContain('errorSignal');
    expect(experimentById('backpropagation').surface.annotations).toBeUndefined();
  });

  it('experiment 4 in expert mode, in its backward pass, writes no ∂ℓ/∂z on the canvas', async () => {
    await open('loss', 'expert');
    const len = lab().length;
    for (const c of [Math.floor(len / 3), Math.floor(len / 2), len - 2]) {
      await lab().jump(c);
      const html = renderApp();
      expect(renderedAnnotations(html).has('errorSignal')).toBe(false);
      const svg = html.slice(
        html.indexOf('network-svg'),
        html.indexOf('</svg>', html.indexOf('network-svg')),
      );
      expect(svg).not.toContain('∂ℓ/∂');
    }
  });

  it('experiment 6 teaches the error signal, and ∂ℓ/∂z = ŷ − y holds in its trace', async () => {
    const step = experimentById('backpropagation').walkthrough.find((w) => w.text.includes('ŷ − y'));
    expect(step).toBeTruthy();
    await open('backpropagation', 'expert');
    const out = lab().header!.model.layers.at(-1)!.name;
    let checked = 0;
    for (let c = 0; c < Math.min(lab().length, 4000) && checked < 5; c += 37) {
      await lab().jump(c);
      const s = lab().exec?.sample;
      const g = s?.layers[out]?.gradZ;
      const a = s?.layers[out]?.a;
      if (!g || !a || !s) continue;
      for (let k = 0; k < g.data.length; k++) expect(g.data[k]).toBeCloseTo(a.data[k] - s.y.data[k], 12);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
    const html = renderApp();
    expect(renderedAnnotations(html).has('errorSignal')).toBe(true);
  });
});

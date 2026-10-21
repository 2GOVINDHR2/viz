/**
 * Fix Round 2, §2.2 principle 4: no term appears on a novice screen before the
 * experiment that teaches it. Each purpose-built screen is rendered from a
 * real trace at several positions, and its narration is checked at every
 * position of the first two epochs.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveDataset } from '../../src/core/engine/host';
import { TraceStore, epochSummaries, reconstructState, storeSource } from '../../src/core/npm';
import { EXPERIMENTS, experimentById } from '../../src/experiments/registry';
import { TERMS } from '../../src/experiments/vocabulary';
import { emptyProgress } from '../../src/experiments/progress';
import { NOVICE_SCREENS } from '../../src/ui/App';
import { narrateBackprop } from '../../src/ui/novice/Backprop';
import { narrateGradientDescent } from '../../src/ui/novice/GradientDescent';
import { narrateSingleNeuron } from '../../src/ui/novice/SingleNeuron';
import { renderCurrentState, useLab } from '../../src/ui/store';
import { detailPhrase, passedSentence } from '../../src/experiments/semanticStep';

// Server renders read the store's current state, not its initial one (Fix Round 2b; see ADR-050).
renderCurrentState();
import type { ExecState } from '../../src/core/npm/state';

const position = (id: string): number => EXPERIMENTS.findIndex((e) => e.id === id);

/** Terms the experiment may not use yet. */
function forbidden(id: string) {
  return TERMS.filter((t) => t.introducedIn === 'expert' || position(t.introducedIn) > position(id));
}

function violations(id: string, text: string): string[] {
  return forbidden(id)
    .filter((t) => t.pattern.test(text))
    .map(
      (t) =>
        `"${t.label}" (introduced by ${t.introducedIn}) in: …${text.slice(Math.max(0, text.search(t.pattern) - 60), text.search(t.pattern) + 40)}…`,
    );
}

const visibleText = (html: string): string =>
  html
    .replace(/<p class="handoff">[\s\S]*?<\/p>/g, ' ')
    .replace(/<(title|desc|style|script)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ');

const NARRATE: Record<string, (exec: ExecState | null) => string> = {
  'single-neuron': narrateSingleNeuron,
  'gradient-descent': (e) => narrateGradientDescent(e, 50),
  backpropagation: narrateBackprop,
};

describe('vocabulary follows the curriculum', () => {
  it('the check catches a term used too early', () => {
    expect(violations('single-neuron', 'The loss of this example')).toHaveLength(1);
    expect(violations('single-neuron', 'one layer of neurons')).toHaveLength(1);
    expect(violations('gradient-descent', 'the loss and its gradient')).toEqual([]);
    expect(violations('backpropagation', 'step one operation')).toHaveLength(1);
  });

  it('every term is introduced by a real experiment or kept to expert mode', () => {
    for (const t of TERMS)
      expect(t.introducedIn === 'expert' || position(t.introducedIn) >= 0, t.label).toBe(true);
  });

  for (const id of Object.keys(NOVICE_SCREENS)) {
    it(`${id}: the screen and its narration use only terms already taught`, () => {
      const exp = experimentById(id);
      const { store } = TraceStore.generate(
        { ...exp.config, epochs: Math.min(exp.config.epochs, 3) },
        resolveDataset(exp.dataset),
      );
      const src = storeSource(store);
      const epochs = epochSummaries(src);
      const found: string[] = [];
      for (const c of [-1, 5, 20, 40, Math.floor(src.length / 2), src.length - 1]) {
        useLab.setState({
          experimentId: id,
          mode: 'novice',
          header: src.header,
          length: src.length,
          cursor: c,
          exec: reconstructState(src, c),
          config: exp.config,
          epochs,
          generating: false,
          progress: emptyProgress(),
        });
        const html = renderToStaticMarkup(createElement(NOVICE_SCREENS[id], { exp }));
        // The render shows the state just set, not the store's initial one (ADR-050). Without this check the
        // test passed on screens with no run: the title and self-check render either way (ADR-054).
        expect(html).toContain(`data-cursor="${c}"`);
        const text = visibleText(html);
        expect(text).toContain(`Experiment ${exp.number}`);
        expect(text).toContain('Check your understanding');
        found.push(...violations(id, text));
      }
      for (let c = -1; c < Math.min(src.length, src.header.epochStarts[2] ?? src.length); c++)
        found.push(...violations(id, NARRATE[id](c < 0 ? null : reconstructState(src, c))));
      // What a novice step passes on the way is narrated too (ADR-053): every phrase, for every instruction.
      for (let c = 0; c < Math.min(src.length, src.header.epochStarts[2] ?? src.length); c++) {
        const ins = src.get(c);
        found.push(...violations(id, detailPhrase(ins)), ...violations(id, passedSentence([[ins]])));
      }
      expect([...new Set(found)]).toEqual([]);
    });
  }
});

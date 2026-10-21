/**
 * Fix Round 2b invariants A–D as properties over every experiment, in both
 * modes, driving the real store with the engine in-process
 * (tests/support/lab.ts):
 *  A. the declared control surface renders, and nothing undeclared does; reset is required;
 *  B. every trainable parameter is reachable and editable after every architecture mutation;
 *  C. selecting any node or edge shows that element's own trace values and data flow, at
 *     several cursor positions including mid-backward-pass;
 *  D. reset restores the initial state, and the re-run trace hash is identical.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  addHiddenLayer,
  removeHiddenLayer,
  setHiddenActivation,
  setHiddenWidth,
} from '../../src/experiments/architecture';
import { declaredControls } from '../../src/experiments/controls';
import { EXPERIMENTS } from '../../src/experiments/registry';
import type { TrainConfig } from '../../src/core/engine/session';
import { allFocuses, checkA, checkB, checkC, checkD, interestingCursors } from '../support/invariants';
import { freshSource, lab, open, renderApp, traceHash } from '../support/lab';
import { Inspector } from '../../src/views/execution/Inspector';
import type { Focus } from '../../src/views/focus';
import type { Provenance } from '../../src/views/provenance';

describe('A. reset is a required control of every experiment screen', () => {
  for (const e of EXPERIMENTS)
    for (const mode of ['novice', 'expert'] as const)
      it(`${e.number} ${mode}`, () => {
        const novice = mode === 'novice' && !!e.surface.noviceControls;
        expect(declaredControls(e, mode, e.config, novice).always).toContain('reset-experiment');
      });
});

describe('A, C and D on every experiment, in both modes', () => {
  for (const e of EXPERIMENTS)
    for (const mode of ['novice', 'expert'] as const)
      it(`${e.number} ${e.title} (${mode})`, async () => {
        await open(e.id, mode);
        const initial = traceHash(freshSource(e.id, e.config));
        const v: string[] = [...checkA()];
        // C at several positions; the CNN has thousands of cells, so a sample of positions there.
        const cursors = interestingCursors();
        for (const c of e.id === 'cnn-mnist' ? cursors.slice(0, 3) : cursors) {
          await lab().jump(c);
          v.push(...checkC(), ...checkA());
        }
        // Change things, then reset.
        await lab().jump(cursors[1] ?? 0);
        lab().setFocus(allFocuses(lab().header!)[1]);
        lab().setGranularity('epoch');
        v.push(...(await checkD(initial)), ...checkA());
        expect(v).toEqual([]);
      }, 240_000);
});

describe('B. every parameter stays reachable and editable after every architecture mutation', () => {
  const mutations: [string, (c: TrainConfig) => TrainConfig][] = [
    ['add a hidden layer', (c) => addHiddenLayer(c, 3, 'tanh')],
    ['widen the new layer', (c) => setHiddenWidth(c, c.model.layers.length - 2, 5)],
    ['change its activation', (c) => setHiddenActivation(c, c.model.layers.length - 2, 'relu')],
    ['remove the first hidden layer', (c) => removeHiddenLayer(c, 0)],
    ['add another', (c) => addHiddenLayer(c)],
  ];
  for (const e of EXPERIMENTS.filter((x) => x.surface.parameterEditor))
    it(`${e.number} ${e.title}`, async () => {
      await open(e.id, 'expert');
      const v: string[] = [...checkB(), ...checkA()];
      if (e.surface.architectureEditor)
        for (const [what, m] of mutations) {
          await lab().reconfigure(m(lab().config));
          if (lab().error) v.push(`${what}: ${lab().error}`);
          v.push(...checkB().map((x) => `${what}: ${x}`), ...checkA().map((x) => `${what}: ${x}`));
          await lab().jump(interestingCursors()[1] ?? 0);
          v.push(...checkC().map((x) => `${what}: ${x}`));
        }
      expect(v).toEqual([]);
    }, 240_000);
});

describe('the invariants catch the defects they were written for (fault injection)', () => {
  it('A catches a screen without its reset control (defect 3)', async () => {
    await open('single-neuron', 'novice');
    const html = renderApp().replace(/data-control="reset-experiment"/g, '');
    expect(checkA(html).join('\n')).toContain('declared but not rendered: reset-experiment');
  });

  it('B catches a parameter the editor does not expose after adding a layer (defect 1)', async () => {
    await open('xor-mlp', 'expert');
    await lab().reconfigure(addHiddenLayer(lab().config));
    const last = lab().header!.model.params.at(-1)!.name;
    const html = renderApp().replace(`data-control="param:${last}"`, '');
    expect(checkB(undefined, html).join('\n')).toContain(`${last} is not reachable`);
  });

  it('C catches a panel that shows another element’s values (defect 2)', async () => {
    await open('xor-mlp', 'expert');
    await lab().jump(interestingCursors()[1]);
    const { header, exec } = lab();
    // The panel for neuron 1 rendered when neuron 2 (or weight [1,2]) is selected.
    const wrong = (f: Focus, prov: Provenance): string =>
      renderToStaticMarkup(
        createElement(Inspector, {
          header: header!,
          exec,
          focus:
            f.kind === 'unit' && f.layer !== 'input'
              ? { ...f, index: (f.index + 1) % 4 }
              : f.kind === 'edge'
                ? { ...f, j: (f.j + 1) % 4 }
                : f,
          onClear: () => undefined,
          provenance: prov,
        }),
      );
    const v = checkC(
      allFocuses(header!).filter((f) => f.layer === 'L1'),
      wrong,
    );
    expect(v.some((x) => x.includes('does not identify') || x.includes('unrelated element'))).toBe(true);
  });
});

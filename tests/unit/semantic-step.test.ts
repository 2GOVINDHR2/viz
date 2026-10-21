/**
 * Novice semantic stepping (ADR-053): a presentation-layer filter over NPM-SPEC §5.2 units.
 *  - each novice step lands on a stop unit, and the passed range plus the stop unit is exactly what the
 *    step executed: nothing is skipped silently;
 *  - the store's loop through the engine equals the pure function;
 *  - expert mode keeps §5.3 stepping exactly.
 */
import { describe, expect, it } from 'vitest';
import { stepBackward, stepForward, unitBounds } from '../../src/core/npm';
import { isStop, semanticStep } from '../../src/experiments/semanticStep';
import { EXPERIMENTS } from '../../src/experiments/registry';
import { offeredGranularities } from '../../src/experiments/surface';
import { useLab } from '../../src/ui/store';
import { currentSource, freshSource, lab, open } from '../support/lab';

const capped = (id: string) => {
  const e = EXPERIMENTS.find((x) => x.id === id)!;
  return { ...e.config, epochs: Math.min(e.config.epochs, 2) };
};

describe('semantic step over a trace', () => {
  for (const e of EXPERIMENTS.filter((x) => x.id !== 'cnn-mnist'))
    for (const g of offeredGranularities(e, 'novice'))
      it(`${e.number} at ${g}: lands on stops; passed + stop unit = exactly what was executed; Back undoes it`, () => {
        const src = freshSource(e.id, capped(e.id));
        let c = -1;
        for (let k = 0; k < 60; k++) {
          const m = semanticStep(src, c, g, 1);
          if (m.cursor === c) break;
          // A stop, or the end of the run when no stop is left.
          if (!isStop(src.get(m.cursor), g)) {
            // The end of the run, with no stop left: everything after the old cursor was passed.
            expect(m.cursor).toBe(src.length - 1);
            expect(m.passed).toEqual([c + 1, m.cursor]);
            break;
          }
          const [unitStart] = unitBounds(src, m.cursor, g);
          // Every instruction in (c, m.cursor] is either passed or in the stop unit.
          const from = m.passed ? m.passed[0] : Math.max(unitStart, c + 1);
          expect(from).toBe(c + 1);
          if (m.passed) {
            expect(m.passed[1] + 1).toBe(Math.max(unitStart, c + 1));
            for (let id = m.passed[0]; id <= m.passed[1]; id++)
              expect(isStop(src.get(id), g), `#${id} ${src.get(id).kind} passed but is a stop`).toBe(false);
          } else expect(unitStart <= c + 1).toBe(true);
          // Back returns to the previous stop (or the start).
          const b = semanticStep(src, m.cursor, g, -1);
          expect(b.cursor === -1 || isStop(src.get(b.cursor), g)).toBe(true);
          expect(b.cursor).toBeLessThanOrEqual(c);
          c = m.cursor;
        }
      });
});

describe('the store’s novice step equals the pure function; expert is §5.3', () => {
  for (const id of ['single-neuron', 'forward-propagation', 'gradient-descent', 'backpropagation', 'xor-mlp'])
    it(
      id,
      async () => {
        const e = EXPERIMENTS.find((x) => x.id === id)!;
        for (const mode of ['novice', 'expert'] as const) {
          await open(id, mode);
          // Breakpoints stop a step where they fire, in both modes; this test compares stepping alone.
          useLab.setState({
            breakpoints: Object.fromEntries(Object.keys(lab().breakpoints).map((k) => [k, false])) as never,
          });
          const src = currentSource();
          for (const g of offeredGranularities(e, mode)) {
            lab().setGranularity(g);
            await lab().jump(-1);
            let c = -1;
            for (let k = 0; k < 25; k++) {
              await lab().step(1);
              const want =
                mode === 'novice'
                  ? semanticStep(src, c, g, 1)
                  : { cursor: stepForward(src, c, g), passed: null };
              expect(lab().cursor, `${mode} ${g} step ${k}`).toBe(want.cursor);
              const got = lab().passed;
              expect(got ? [got.instructions[0].id, got.instructions.at(-1)!.id] : null).toEqual(want.passed);
              c = lab().cursor;
            }
            for (let k = 0; k < 5; k++) {
              await lab().step(-1);
              const want = mode === 'novice' ? semanticStep(src, c, g, -1).cursor : stepBackward(src, c, g);
              expect(lab().cursor, `${mode} ${g} back ${k}`).toBe(want);
              c = lab().cursor;
            }
          }
        }
      },
      120_000,
    );
});

import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { registeredKinds, type Instruction, type Trace } from '../../src/core/npm';
import { explain, explainedKinds, tex, type ExplainContext } from '../../src/explain';
import { architectureTraces } from '../support/traces';

const traces = architectureTraces(1).map((t) => t.store.toTrace());

function ctxFor(trace: Trace, focus = 0): ExplainContext {
  return {
    header: trace.header,
    value: (o) => trace.instructions[o.ref].results[o.slot],
    focus,
    verbosity: 'detailed',
  };
}

describe('explanations', () => {
  it('every registered instruction kind has an explainer', () => {
    const have = new Set(explainedKinds());
    expect(
      registeredKinds()
        .map((k) => k.kind)
        .filter((k) => !have.has(k)),
    ).toEqual([]);
  });

  it('every instruction of every planned architecture explains to valid KaTeX and a sentence, at several focus positions', () => {
    let count = 0;
    for (const trace of traces) {
      for (const ins of trace.instructions) {
        for (const focus of [0, 1, 7, 10_000]) {
          const e = explain(ins, ctxFor(trace, focus));
          expect(e.sentence.length, ins.kind).toBeGreaterThan(20);
          expect(
            () => katex.renderToString(e.general, { throwOnError: true }),
            `${ins.kind} general: ${e.general}`,
          ).not.toThrow();
          expect(
            () => katex.renderToString(e.substituted, { throwOnError: true }),
            `${ins.kind} substituted: ${e.substituted}`,
          ).not.toThrow();
          expect(e.sentence).not.toMatch(/undefined|NaN(?!\))|\[object/);
          count++;
        }
      }
    }
    expect(count).toBeGreaterThan(1000);
  });

  it('substituted forms end with the instruction’s actual result (explanations are derived, not canned)', () => {
    const trace = traces.find((t) => t.header.dataset.name === 'xor')!;
    const check = (kind: string, slot: string, focus = 0): void => {
      const ins = trace.instructions.find((i) => i.kind === kind) as Instruction;
      const e = explain(ins, ctxFor(trace, focus));
      const k = Math.min(focus, ins.results[slot].size - 1);
      expect(e.substituted.endsWith(`= ${tex(ins.results[slot].data[k])}`), `${kind}: ${e.substituted}`).toBe(
        true,
      );
    };
    check('MATMUL', 'out', 0);
    check('MATMUL', 'out', 2);
    check('ADD_BIAS', 'out', 1);
    check('ACTIVATE', 'out', 3);
    check('COMPUTE_LOSS', 'loss');
    check('GRAD_MATMUL_W', 'grad', 5);
    check('GRAD_MATMUL_X', 'grad', 1);
    check('GRAD_ACTIVATE', 'grad', 2);
    check('GRAD_ACCUMULATE', 'grad', 4);
    check('COMPUTE_UPDATE', 'delta', 3);
    check('APPLY_UPDATE', 'value', 3);
  });

  it('the update explanation states the direction implied by the sign of the step', () => {
    const trace = traces[0];
    for (const ins of trace.instructions.filter((i) => i.kind === 'APPLY_UPDATE')) {
      const e = explain(ins, ctxFor(trace, 0));
      const delta = trace.instructions[ins.operands[1].ref].results.delta.data[0];
      expect(e.sentence).toContain(delta < 0 ? 'decreased' : delta > 0 ? 'increased' : 'did not change');
    }
  });
});

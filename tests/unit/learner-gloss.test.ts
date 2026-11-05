/**
 * Fix Round 5, 1.2 and 1.5 (ADR-070): every built-in kind has a learner gloss free of identifiers and notation, the
 * guided path shows it, and "What changed" omits zero changes and collapses tiny ones.
 */
import { describe, expect, it } from 'vitest';
import { registeredKinds } from '../../src/core/npm/kinds';
import { describeChanges, TINY_CHANGE } from '../../src/explain/diff';
import { learnerGloss } from '../../src/explain/names';
import { IDENTIFIER_PATTERNS } from '../../src/explain/names';

const identifiersIn = (t: string): string[] =>
  IDENTIFIER_PATTERNS.filter(({ re }) => re.test(t)).map(({ what }) => what);
import { lab, open } from '../support/lab';

describe('1.2 learner glosses', () => {
  it('every built-in kind has a gloss, different from its specification meaning, with no identifier or notation', () => {
    for (const k of registeredKinds()) {
      expect(k.learnerGloss, k.kind).toBeTruthy();
      expect(k.learnerGloss).not.toBe(k.summary);
      expect(identifiersIn(k.learnerGloss!), k.kind).toEqual([]);
      expect(k.learnerGloss, k.kind).not.toMatch(/[∂ℓσ²¹⁰]|\b[xyzWb]\b/);
    }
  });

  it('a gloss is made specific by the instruction: which example, how many examples a pass covers', async () => {
    await open('single-neuron', 'novice');
    const h = lab().header!;
    const fake = (kind: string, meta: Record<string, number> = {}) =>
      ({ kind, meta, path: { epoch: 0, batch: 0, sample: 0, phase: 'forward', layer: null } }) as never;
    expect(learnerGloss(h, fake('LOAD_INPUT', { datasetIndex: 3 }))).toBe(
      'Training example 4 goes into the network.',
    );
    expect(learnerGloss(h, fake('EPOCH_END'))).toBe(
      `That’s one full pass through all ${h.dataset.n} training examples. Here’s how it went.`,
    );
    expect(learnerGloss(h, fake('COMPUTE_LOSS'))).toBe('How far off was this guess?');
  });
});

describe('1.5 what changed', () => {
  it('omits zero changes, collapses tiny ones on the guided path, and says where a step back landed', async () => {
    await open('single-neuron', 'novice');
    const h = lab().header!;
    await lab().jump(40);
    const base = lab().exec!;
    const p = h.model.params[0].name;
    const withDelta = (d: number) => {
      const v = base.params[p]!.value;
      const data = Float64Array.from(v.data, (x, k) => (k === 0 ? x + d : x));
      return {
        ...base,
        cursor: base.cursor + 1,
        params: { ...base.params, [p]: { ...base.params[p]!, producedBy: -2, value: { ...v, data } } },
      } as never;
    };
    const zero = describeChanges(h, base, withDelta(0), true);
    expect(zero.join(' ')).not.toMatch(/changed|barely/);
    const tiny = describeChanges(h, base, withDelta(TINY_CHANGE / 10), true);
    expect(tiny.join(' ')).toMatch(/The parameters barely moved/);
    expect(describeChanges(h, base, withDelta(TINY_CHANGE / 10), false).join(' ')).toMatch(
      /changed: the largest/,
    );
    expect(describeChanges(h, base, withDelta(0.5), true).join(' ')).toMatch(
      /changed: the largest change is 0.5/,
    );
    const back = describeChanges(h, withDelta(0), base, true)[0];
    expect(back).toMatch(/^You’ve moved back to .*Everything on screen is exactly as it was then\.$/);
  });
});

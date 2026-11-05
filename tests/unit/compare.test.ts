/**
 * Fix Round 4, D4: comparing two points reports exactly what the trace holds at them.
 * Checked against values read independently from the trace: across the first weight update, exactly the weights
 * change, by that update's own step; nothing changes between a point and itself; and the panel renders the counts.
 */
import { describe, expect, it } from 'vitest';
import { reconstructState } from '../../src/core/npm';
import { compareStates } from '../../src/views/trace/compare';
import { currentSource, lab, open, renderApp } from '../support/lab';

describe('D4. compare two points', () => {
  it('across the first weight update: the weights change by the update step, the bias does not', async () => {
    await open('single-neuron', 'expert');
    const src = currentSource();
    const all = src.range(0, src.length);
    const upd = all.find((i) => i.kind === 'APPLY_UPDATE' && i.meta.param === 'L1.W')!;
    const A = reconstructState(src, upd.id - 1);
    const B = reconstructState(src, upd.id);
    const c = compareStates(src.header, A, B);
    const w = c.params.find((p) => p.name === 'L1.W')!;
    const b = c.params.find((p) => p.name === 'L1.b')!;
    // Independently: the parameter values before the update, and the update's own result.
    const before = Array.from(A.params['L1.W'].value.data);
    const after = Array.from(upd.results.value.data);
    const diffs = after.map((v, k) => Math.abs(v - before[k]));
    expect(w.changed).toBe(diffs.filter((d) => d > 0).length);
    expect(w.largest!.index).toBe(diffs.indexOf(Math.max(...diffs)));
    expect(w.largest!.b).toBe(after[w.largest!.index]);
    expect(w.largest!.a).toBe(before[w.largest!.index]);
    expect(b.changed).toBe(0);
    expect(b.largest).toBeNull();
  });

  it('across every weight update of the run: the largest change is the element that moved most', async () => {
    // One update alone can have its largest change in the first element, which would hide a comparison that
    // just reports the first changed element (the first mutation run showed exactly that).
    await open('single-neuron', 'expert');
    const src = currentSource();
    const ups = src.range(0, src.length).filter((i) => i.kind === 'APPLY_UPDATE' && i.meta.param === 'L1.W');
    const seen = new Set<number>();
    for (const upd of ups) {
      const before = Array.from(reconstructState(src, upd.id - 1).params['L1.W'].value.data);
      const after = Array.from(upd.results.value.data);
      const diffs = after.map((v, k) => Math.abs(v - before[k]));
      const c = compareStates(src.header, reconstructState(src, upd.id - 1), reconstructState(src, upd.id));
      const w = c.params.find((p) => p.name === 'L1.W')!;
      expect(w.largest!.index).toBe(diffs.indexOf(Math.max(...diffs)));
      seen.add(w.largest!.index);
    }
    // The run's updates move each weight most at some point, so both indices are exercised.
    expect(seen.size).toBe(2);
  });

  it('a point compared with itself: nothing differs', async () => {
    await open('single-neuron', 'expert');
    const src = currentSource();
    const S = reconstructState(src, 200);
    const c = compareStates(src.header, S, S);
    expect(c.params.every((p) => p.changed === 0)).toBe(true);
    expect(c.layers.every((l) => l.changed === 0)).toBe(true);
  });

  it('the panel: pin at A, move to B, and the rendered counts are the comparison’s', async () => {
    await open('single-neuron', 'expert');
    const src = currentSource();
    const upd = src.range(0, src.length).find((i) => i.kind === 'APPLY_UPDATE' && i.meta.param === 'L1.W')!;
    await lab().jump(upd.id - 1);
    lab().pinHere();
    await lab().jump(upd.id);
    const html = renderApp();
    expect(html).toContain(`data-compare="${upd.id - 1}:${upd.id}"`);
    expect(html).toMatch(/data-param="L1\.W" data-changed="[12]"/);
    expect(html).toContain('data-param="L1.b" data-changed="0"');
    // Reset clears the pin (invariant D's "initial state").
    await lab().resetExperiment();
    expect(lab().pinned).toBeNull();
  });
});

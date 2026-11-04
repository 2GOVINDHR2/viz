/**
 * Fix Round 4, D1: the trace view's highlighted row is the engine's cursor, at every granularity, after every step
 * forwards and backwards, and after a jump. The row is found by `aria-current` in the rendered list, and its id is
 * compared with the store's cursor, which the engine set.
 */
import { describe, expect, it } from 'vitest';
import { GRANULARITIES } from '../../src/core/npm/stats';
import { filterTrace, firstGradient, largestMagnitude } from '../../src/views/trace/query';
import { learnerGloss } from '../../src/explain/names';
import { primeWholeTrace } from '../../src/views/trace/TraceView';
import { currentSource, lab, open, renderApp } from '../support/lab';

function highlighted(html: string): number[] {
  return [
    ...html.matchAll(
      /<div role="listitem" class="trace-row current"[^>]*aria-current="step" data-id="(\d+)"/g,
    ),
  ].map((m) => Number(m[1]));
}

describe('D1. the trace view follows the cursor', () => {
  it('experiment 1, expert mode: the current row is the cursor at every granularity', async () => {
    await open('single-neuron', 'expert');
    const v: string[] = [];
    expect(renderApp()).toContain('aria-label="The trace"');
    for (const g of GRANULARITIES) {
      lab().setGranularity(g);
      for (const dir of [1, 1, 1, -1, 1] as const) {
        await lab().step(dir);
        const rows = highlighted(renderApp());
        if (rows.length !== 1 || rows[0] !== lab().cursor)
          v.push(
            `${g} ${dir > 0 ? 'forward' : 'back'}: cursor ${lab().cursor}, highlighted ${rows.join(',') || 'none'}`,
          );
      }
    }
    for (const c of [0, 1234, lab().length - 1]) {
      await lab().jump(c);
      const rows = highlighted(renderApp());
      if (rows.length !== 1 || rows[0] !== c) v.push(`jump ${c}: highlighted ${rows.join(',') || 'none'}`);
    }
    expect(v).toEqual([]);
  });

  it('is declared for every experiment in expert mode (Fix Round 5, 3.1)', async () => {
    for (const id of ['single-neuron', 'xor-mlp', 'vanishing-gradients']) {
      await open(id, 'expert');
      expect(renderApp(), id).toContain('aria-label="The trace"');
    }
  });

  it('guided: every step in plain words, the cursor highlighted, no numbers, kinds or identifiers', async () => {
    await open('xor-mlp', 'novice');
    const src = currentSource();
    primeWholeTrace(lab().header!, src.range(0, src.length));
    lab().setDeeper('trace', true);
    for (const c of [3, 40, 777]) {
      await lab().jump(c);
      const html = renderApp();
      const panel = html.slice(
        html.indexOf('aria-label="The trace"'),
        html.indexOf('</section>', html.indexOf('aria-label="The trace"')),
      );
      expect(panel).toContain('data-guided="true"');
      expect(highlighted(panel)).toEqual([c]);
      const row = new RegExp(`data-id="${c}"[\\s\\S]*?<span class="trace-meaning">([^<]*)<`).exec(panel)!;
      expect(row[1].replace(/&#x27;|’/g, "'")).toBe(
        learnerGloss(lab().header!, src.get(c)).replace(/’/g, "'"),
      );
      expect(panel).not.toMatch(/class="ident"|#\d|data-control="trace:(kind|find|ask)"/);
    }
  });
});

describe('D2. trace queries', () => {
  it('filter and gradient search agree with a direct scan of the trace', async () => {
    await open('single-neuron', 'expert');
    const src = currentSource();
    const all = src.range(0, src.length);
    const loads = filterTrace(all, { kind: 'LOAD_INPUT' });
    expect(loads.length).toBe(all.filter((i) => i.kind === 'LOAD_INPUT').length);
    expect(loads.every((id) => all[id].kind === 'LOAD_INPUT')).toBe(true);
    const epoch3 = filterTrace(all, { phase: 'backward', epoch: 2 });
    expect(epoch3.every((id) => all[id].path.phase === 'backward' && all[id].path.epoch === 2)).toBe(true);
    expect(epoch3.length).toBeGreaterThan(0);
    // The first gradient below a threshold: nothing earlier qualifies, and it does.
    const hit = firstGradient(all, { when: 'below', threshold: 1e-2 })!;
    expect(hit).not.toBeNull();
    expect(largestMagnitude(hit)).toBeLessThan(1e-2);
    for (const i of all.slice(0, hit.id))
      if (i.path.phase === 'backward' || i.kind === 'GRAD_ACCUMULATE')
        expect(largestMagnitude(i)).toBeGreaterThanOrEqual(1e-2);
  });
});

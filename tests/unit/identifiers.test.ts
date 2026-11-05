/**
 * Fix Round 4, A1 (ADR-062): no guided-path screen shows an identifier of the instruction set, in visible text,
 * tooltips or accessible names. Checked on every experiment's guided screen at several positions, after real steps
 * (so the "passed on the way" list is filled), with every disclosure section open and with a selection made.
 */
import { describe, expect, it } from 'vitest';
import { IDENTIFIER_PATTERNS } from '../../src/explain/names';
import { EXPERIMENTS } from '../../src/experiments/registry';
import { allFocuses, interestingCursors } from '../support/invariants';
import { lab, open, renderApp } from '../support/lab';

/** Everything a learner can read or hear: text nodes, SVG titles, and aria-label / title / alt / placeholder values. */
export function readable(html: string): string {
  const main = html.slice(html.indexOf('<main'), html.lastIndexOf('</main>') + 7) || html;
  const attrs = [...main.matchAll(/\s(?:aria-label|aria-valuetext|title|alt|placeholder)="([^"]*)"/g)].map(
    (m) => m[1],
  );
  const text = main
    .replace(/<(style|script)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;|&#\d+;/g, ' ');
  return `${text} ${attrs.join(' ')}`.replace(/\s+/g, ' ');
}

export function identifiersIn(text: string): string[] {
  const out: string[] = [];
  for (const { what, re } of IDENTIFIER_PATTERNS) {
    const g = new RegExp(re.source, 'g');
    for (const m of text.matchAll(g))
      out.push(`${what} "${m[0].trim()}" in …${text.slice(Math.max(0, m.index! - 50), m.index! + 40)}…`);
  }
  return out;
}

describe('A1. no identifiers on the guided path', () => {
  it('the check catches each kind of identifier', () => {
    expect(identifiersIn('Step to an ACTIVATE instruction')).toHaveLength(1);
    expect(identifiersIn('Run to the first COMPUTE_LOSS')).toHaveLength(1);
    expect(identifiersIn('instruction #17 MATMUL')).toHaveLength(2);
    expect(identifiersIn('L1.W [2×3]')).toHaveLength(1);
    expect(identifiersIn('target L1.unit[1]: ∂ℓ/∂z and x[1]')).toHaveLength(2);
    expect(identifiersIn('L1 weights and the L1/L2 boundary')).toHaveLength(3);
    expect(identifiersIn('∂ℓ/∂z = 4.69×10⁻⁴, or 1.2e-7')).toHaveLength(2);
    expect(identifiersIn('EPOCH_END (#1355)')).toHaveLength(2);
    expect(identifiersIn('the weighted sum of hidden layer 1, for training example 14')).toEqual([]);
  });

  for (const e of EXPERIMENTS)
    it(`${e.number} ${e.title}`, async () => {
      await open(e.id, 'novice');
      const found = new Set<string>();
      const check = (): void => {
        for (const m of renderApp().matchAll(/data-control="deeper:([^"]+)"/g)) lab().setDeeper(m[1], true);
        for (const v of identifiersIn(readable(renderApp()))) found.add(v);
      };
      check();
      // Real steps, so the narration of what a step passed is rendered too.
      for (let k = 0; k < 6; k++) await lab().step(1);
      check();
      const cursors = interestingCursors();
      for (const c of e.id === 'cnn-mnist' ? cursors.slice(0, 2) : cursors) {
        await lab().jump(c);
        check();
      }
      // A selection: the inspector's element and its provenance.
      const focus = allFocuses(lab().header!)[1];
      if (focus) {
        lab().setFocus(focus);
        await lab().jump(cursors[1] ?? 0);
        await new Promise((r) => setTimeout(r, 0));
        check();
      }
      expect([...found]).toEqual([]);
    }, 240_000);
});

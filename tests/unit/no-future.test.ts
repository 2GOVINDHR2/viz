/**
 * Fix Round 4, A4: no panel shows state the cursor has not reached.
 *
 * The NPM computes the whole run before the learner steps through it. The one piece of store state that carries the
 * whole run is the per-epoch summary list (one record per epoch, read from EVAL_END and EPOCH_END). This property
 * renders every screen at several cursors twice: as it is, and with that list cut to the epochs the cursor has
 * completed. Any difference means a panel showed a value from later in the trace.
 *
 * Pure engine requests a panel makes for itself (D2's comparison runs) are separate, complete runs by design and are
 * not part of the learner's run; they are outside this property.
 */
import { describe, expect, it } from 'vitest';
import { EXPERIMENTS } from '../../src/experiments/registry';
import { useLab } from '../../src/ui/store';
import { interestingCursors } from '../support/invariants';
import { lab, open, renderApp } from '../support/lab';

/** Epochs whose EPOCH_END the cursor has passed. */
export function completedBy(cursor: number): number {
  const starts = lab().header!.epochStarts;
  let n = 0;
  while (n + 1 < starts.length && starts[n + 1] - 1 <= cursor) n++;
  return n;
}

export async function futureLeaks(): Promise<string[]> {
  const out: string[] = [];
  const all = lab().epochs;
  const cursors = [...new Set([-1, 0, ...interestingCursors(), lab().header!.epochStarts[1] ?? 0])].filter(
    (c) => c < lab().length,
  );
  for (const c of cursors) {
    await lab().jump(c);
    for (const m of renderApp().matchAll(/data-control="deeper:([^"]+)"/g)) lab().setDeeper(m[1], true);
    const full = renderApp();
    useLab.setState({ epochs: all.slice(0, completedBy(c)) });
    const cut = renderApp();
    useLab.setState({ epochs: all });
    if (full !== cut) {
      let k = 0;
      while (k < full.length && full[k] === cut[k]) k++;
      out.push(
        `@${c} (${completedBy(c)} of ${all.length} epochs done): …${full.slice(Math.max(0, k - 120), k + 80).replace(/<[^>]+>/g, ' ')}…`,
      );
    }
  }
  return out;
}

describe('A4. nothing from later in the run is shown before the cursor reaches it', () => {
  for (const e of EXPERIMENTS)
    for (const mode of ['novice', 'expert'] as const)
      it(`${e.number} ${e.title} (${mode})`, async () => {
        await open(e.id, mode);
        expect(await futureLeaks()).toEqual([]);
      }, 240_000);
});

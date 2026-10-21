/**
 * Control audit (Fix Round 2, §3.4). Every interactive control is checked for
 * an observable change in state or output, never only for its presence:
 * step controls against the engine's own navigator (the same deterministic
 * trace is generated here as an oracle), parameter edits against the trace
 * they produce, toggles against what they display, and each experiment's
 * screen against its declared surface. The inventory and findings are in
 * docs/CONTROL-AUDIT.md.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { resolveDataset } from '../../src/core/engine/host';
import {
  runToBreakpoint,
  stepBackward,
  stepForward,
  storeSource,
  TraceStore,
  type TraceSource,
} from '../../src/core/npm';
import { GRANULARITIES, type Granularity } from '../../src/core/npm/stats';
import { applyEdit, editValue } from '../../src/experiments/edits';
import { EXPERIMENTS, experimentById } from '../../src/experiments/registry';
import { offeredGranularities, startingGranularity } from '../../src/experiments/surface';
import type { TrainConfig } from '../../src/core/engine/session';
import { activeBreakpoints, type BreakpointToggles } from '../../src/ui/store';
import { semanticStep } from '../../src/experiments/semanticStep';
import { openExperiment, unlockAll } from './helpers';

const TECH: Record<Granularity, string> = {
  operation: 'Operation',
  layer: 'Layer',
  phase: 'Phase',
  sample: 'Example',
  batch: 'Batch',
  epoch: 'Epoch',
};

const BP_KEYS = [
  'nonFinite',
  'vanishing',
  'exploding',
  'deadRelu',
  'lossIncrease',
  'lossPlateau',
  'gradInit',
] as const;

const traces = new Map<string, TraceSource>();
function oracle(id: string, config?: TrainConfig): TraceSource {
  const e = experimentById(id);
  const key = `${id}:${JSON.stringify(config ?? null)}`;
  if (!traces.has(key))
    traces.set(key, storeSource(TraceStore.generate(config ?? e.config, resolveDataset(e.dataset)).store));
  return traces.get(key)!;
}

/** The cursor, from the position read-out (expert) or the novice screen's data attribute. */
async function cursor(page: Page): Promise<number> {
  const novice = page.locator('article.novice');
  if (await novice.count()) return Number(await novice.getAttribute('data-cursor'));
  const t = (await page.locator('.controls .position').textContent()) ?? '';
  // "Generating trace…" while a run regenerates: no position yet, so a poll keeps waiting.
  const m = /Instruction ([\d,]+)/.exec(t);
  return m ? Number(m[1].replace(/,/g, '')) - 1 : Number.NaN;
}

async function expectCursor(page: Page, value: number): Promise<void> {
  await expect.poll(() => cursor(page), { timeout: 30_000 }).toBe(value);
}

/** Reset only when there is something to reset (the button is disabled at the start). */
async function reset(page: Page): Promise<void> {
  if ((await cursor(page)) >= 0) await page.getByRole('button', { name: '⏮ Start' }).click();
  await expectCursor(page, -1);
}

async function scrubTo(page: Page, c: number): Promise<void> {
  await page.getByLabel('Position', { exact: true }).fill(String(c));
  await expectCursor(page, c);
}

/** The novice path's semantic step (ADR-053), with the experiment's suggested breakpoints, as the store runs it. */
function noviceStep(id: string, src: TraceSource, c: number, g: Granularity, dir: 1 | -1 = 1): number {
  const toggles = Object.fromEntries(
    BP_KEYS.map((k) => [k, k === 'nonFinite']),
  ) as unknown as BreakpointToggles;
  for (const k of experimentById(id).suggestedBreakpoints) toggles[k] = true;
  return semanticStep(src, c, g, dir, activeBreakpoints(toggles)).cursor;
}

/**
 * Performs an action that regenerates the run and waits until the new run is ready. `ready` alone can pass on
 * the old run's start screen before the regeneration has begun (a race seen on CI), so this waits for the
 * run counter to move.
 */
async function regenerated(page: Page, action: () => Promise<unknown>): Promise<void> {
  const runs = async (): Promise<number> => Number(await page.locator('.app').getAttribute('data-runs'));
  const before = await runs();
  await action();
  await expect.poll(runs, { timeout: 90_000 }).toBeGreaterThan(before);
  await ready(page);
}

const ready = (page: Page) => expect(page.getByText(/Instruction 0 \//)).toBeVisible({ timeout: 90_000 });

test.describe('control audit: expert workbench', () => {
  test.setTimeout(240_000);
  test.beforeEach(async ({ page }) => {
    await unlockAll(page);
    await page.goto('/?mode=expert');
    await ready(page);
  });

  test('each of the six step sizes moves the cursor by exactly one unit, forward and back', async ({
    page,
  }) => {
    await openExperiment(page, 'XOR needs a hidden layer');
    const src = oracle('xor-mlp');
    let c = 137;
    await scrubTo(page, c);
    for (const g of GRANULARITIES) {
      await page.getByRole('radio', { name: TECH[g], exact: true }).click();
      await page.getByRole('button', { name: 'Step ▶' }).click();
      c = stepForward(src, c, g);
      await expectCursor(page, c);
      await page.getByRole('button', { name: '◀ Back' }).click();
      c = stepBackward(src, c, g);
      await expectCursor(page, c);
      // And forward again, so the next level starts somewhere new.
      await page.getByRole('button', { name: 'Step ▶' }).click();
      c = stepForward(src, c, g);
      await expectCursor(page, c);
    }
  });

  test('keyboard: arrows step, digits choose the step size, Home resets, Space runs and pauses', async ({
    page,
  }) => {
    await openExperiment(page, 'XOR needs a hidden layer');
    const src = oracle('xor-mlp');
    await page.locator('section.network').click();
    let c = -1;
    for (const [k, g] of GRANULARITIES.entries()) {
      await page.keyboard.press(String(k + 1));
      await expect(page.getByRole('radio', { name: TECH[g], exact: true })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      await page.keyboard.press('ArrowRight');
      c = stepForward(src, c, g);
      await expectCursor(page, c);
    }
    await page.keyboard.press('ArrowLeft');
    await expectCursor(page, stepBackward(src, c, 'epoch'));
    await page.keyboard.press('Home');
    await expectCursor(page, -1);
    await page.keyboard.press('1');
    await page.keyboard.press('Space');
    await expect.poll(() => cursor(page)).toBeGreaterThan(3);
    await page.keyboard.press('Space');
    const stopped = await cursor(page);
    await page.waitForTimeout(800);
    expect(await cursor(page)).toBe(stopped);
  });

  test('scrubber, reset, run/pause and speed change the position as stated', async ({ page }) => {
    await scrubTo(page, 40);
    await page.getByRole('button', { name: '⏮ Start' }).click();
    await expectCursor(page, -1);
    // Speed: the same run for 1.5 s at the slowest and at the fastest setting.
    // Breakpoints off, so the run is not stopped by one.
    for (const box of await page.locator('.breakpoints input[type="checkbox"]').all())
      if (await box.isChecked()) await box.click();
    const speed = page.getByLabel('Speed');
    const run = async (value: string): Promise<number> => {
      await reset(page);
      await speed.fill(value);
      await page.getByRole('radio', { name: 'Operation', exact: true }).click();
      await page.getByRole('button', { name: '▶▶ Run' }).click();
      await page.waitForTimeout(1500);
      await page.getByRole('button', { name: '❚❚ Pause' }).click();
      const at = await cursor(page);
      await page.waitForTimeout(500);
      expect(await cursor(page), 'pause stops the run').toBe(at);
      return at;
    };
    const slow = await run('20');
    const fast = await run('1000');
    expect(fast).toBeGreaterThan(3 * Math.max(1, slow));
  });

  test('each breakpoint toggle changes where "To breakpoint" stops, exactly as the engine says', async ({
    page,
  }) => {
    const labels: Record<(typeof BP_KEYS)[number], RegExp> = {
      nonFinite: /NaN or infinity/,
      vanishing: /gradient vanishes/,
      exploding: /gradient explodes/,
      deadRelu: /ReLU unit is inactive/,
      lossIncrease: /epoch loss rises/,
      lossPlateau: /epoch loss stops decreasing/,
      gradInit: /back-propagation starts/,
    };
    // Configurations reachable from the shipped controls in which the pathologies occur.
    const cases = [
      { title: 'Learning-rate pathology', id: 'lr-pathology', edit: 1.1 },
      { title: 'Vanishing gradients', id: 'vanishing-gradients', edit: 'relu' },
      { title: 'XOR needs a hidden layer', id: 'xor-mlp', edit: null },
    ] as const;
    const hits: string[] = [];
    for (const c of cases) {
      await openExperiment(page, c.title);
      const e = experimentById(c.id);
      let config: TrainConfig = e.config;
      if (c.edit !== null) {
        await page.locator('.tryit .try-row').first().locator('select').selectOption(String(c.edit));
        await ready(page);
        config = applyEdit(e.config, e.editable[0], c.edit);
      }
      const src = oracle(c.id, config);
      for (const k of BP_KEYS) {
        for (const other of BP_KEYS) {
          const box = page.getByLabel(labels[other]);
          if ((await box.isChecked()) !== (other === k)) await box.click();
        }
        await reset(page);
        const only = Object.fromEntries(BP_KEYS.map((x) => [x, x === k])) as unknown as BreakpointToggles;
        const expected = runToBreakpoint(src, -1, activeBreakpoints(only));
        await page.getByRole('button', { name: '⇥ To breakpoint' }).click();
        await expectCursor(page, expected.cursor);
        if (expected.hit) {
          hits.push(`${c.id}:${k}`);
          await expect(page.getByRole('alert')).toContainText('Paused');
        }
      }
    }
    // Every toggle except NaN/∞ stops a run somewhere reachable from the shipped controls. No shipped
    // control reaches a non-finite value (tests/unit/pathologies.test.ts needs η = 8 for 150 epochs);
    // docs/CONTROL-AUDIT.md records this.
    for (const k of BP_KEYS)
      expect(
        hits.some((h) => h.endsWith(`:${k}`)),
        `${k}`,
      ).toBe(k !== 'nonFinite');
  });

  test('every declared parameter edit changes the computation and the trace', async ({ page }) => {
    for (const e of EXPERIMENTS.filter((x) => x.id !== 'cnn-mnist')) {
      await openExperiment(page, e.title);
      for (const [k, p] of e.editable.entries()) {
        const before = oracle(e.id);
        const value =
          p.kind === 'initialValue'
            ? Math.min(
                p.max,
                Number((before.header.config as TrainConfig).initialParams?.[p.param]?.[p.index] ?? 0) + 1,
              )
            : (p.options as (string | number)[]).find((o) => String(o) !== String(editValue(e.config, p)))!;
        const after = oracle(e.id, applyEdit(e.config, p, value));
        const row = page.locator('.tryit .try-row').nth(k);
        await regenerated(page, () =>
          p.kind === 'initialValue'
            ? row.locator('input[type="range"]').fill(String(value))
            : row.locator('select').selectOption(String(value)),
        );
        // The run regenerated from the edited configuration: the trace the engine shows is the oracle's.
        await scrubTo(page, after.length - 1);
        const shown = (await page.locator('.summary').textContent()) ?? '';
        const describesEnd = shown.includes(
          `Instruction ${after.length.toLocaleString('en')} of ${after.length.toLocaleString('en')}`,
        );
        expect(describesEnd, `${e.id} ${p.kind}: ${shown}`).toBe(true);
        expect(
          JSON.stringify(after.get(after.length - 1).results) !==
            JSON.stringify(before.get(before.length - 1).results) || after.length !== before.length,
          `${e.id} ${p.kind} changes the trace`,
        ).toBe(true);
        // Back to the experiment's own setting for the next parameter.
        await regenerated(page, () =>
          page.getByRole('button', { name: new RegExp(`^${e.number}\\. `) }).click(),
        );
      }
    }
  });

  test('the CNN’s two declared parameters regenerate the run with the new setting', async ({ page }) => {
    await openExperiment(page, 'A CNN on handwritten digits');
    const rows = page.locator('.tryit .try-row');
    await rows.nth(0).locator('select').selectOption('tanh');
    await ready(page);
    await expect(page.locator('.layer-card').first()).toContainText('tanh');
    const end = async (): Promise<string> => {
      const max = Number(await page.getByLabel('Position', { exact: true }).getAttribute('max'));
      await scrubTo(page, max);
      return (await page.locator('.summary').textContent()) ?? '';
    };
    const before = await end();
    await rows.nth(1).locator('select').selectOption('0.5');
    await ready(page);
    expect(await end()).not.toEqual(before);
  });

  test('structure view: expanding, editing each field, adding and removing layers, apply and restore', async ({
    page,
  }) => {
    await openExperiment(page, 'XOR needs a hidden layer');
    const cards = page.locator('.layer-card');
    await cards.first().locator('.layer-head').click();
    await expect(cards.first().locator('.layer-steps')).toBeVisible();
    await cards.first().locator('.layer-head').click();
    await expect(cards.first().locator('.layer-steps')).toBeHidden();
    await page.getByLabel('Activation of hidden layer 1').selectOption('relu');
    await page.getByRole('button', { name: '+ add hidden layer' }).click();
    await page.getByRole('button', { name: 'Apply and restart' }).click();
    await ready(page);
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText('relu');
    await page.getByRole('button', { name: 'Remove hidden layer 2' }).click();
    await page.locator('.edit select').filter({ hasText: '0.01' }).selectOption('2');
    await page.locator('.edit select').filter({ hasText: '300' }).selectOption('10');
    await page.getByRole('button', { name: 'Apply and restart' }).click();
    await ready(page);
    await expect(cards).toHaveCount(2);
    await expect(page.getByText('0 of 10 epochs complete')).toBeVisible();
    await page.getByRole('button', { name: 'restore defaults' }).click();
    await ready(page);
    await expect(page.getByText('0 of 150 epochs complete')).toBeVisible();
    await expect(cards.first()).toContainText('tanh');
  });

  test('network and inspector: a neuron, a weight, and clearing the selection', async ({ page }) => {
    await openExperiment(page, 'XOR needs a hidden layer');
    await scrubTo(page, 30);
    await page.getByRole('button', { name: /^Hidden 1 \(tanh\), unit 2/ }).click();
    await expect(page.locator('.inspector h2')).toContainText('Layer 1, neuron 2 (tanh)');
    await page.getByRole('button', { name: /Weight from Input unit 2 to Hidden 1 \(tanh\) unit 3/ }).click();
    await expect(page.locator('.inspector h2')).toContainText('Weight W1[2,3]');
    await page.locator('.inspector').getByRole('button', { name: 'Clear' }).click();
    await expect(page.locator('.inspector h2')).not.toContainText('W1[2,3]');
  });

  test('parameter editor: a layer added by the structure editor has editable weights (defect 1)', async ({
    page,
  }) => {
    await openExperiment(page, 'XOR needs a hidden layer');
    await page.getByRole('button', { name: '+ add hidden layer' }).click();
    await page.getByRole('button', { name: 'Apply and restart' }).click();
    await ready(page);
    const params = page.locator('section.params');
    // The new hidden layer's weights and biases, and the output layer's, are all listed.
    for (const name of ['L1.W', 'L1.b', 'L2.W', 'L2.b', 'L3.W', 'L3.b'])
      await expect(params.locator(`[data-control="param:${name}"]`)).toBeVisible();
    await params.locator('[data-control="param:L2.W"]').click();
    const cell = params.getByLabel('L2.W[1,1] starting value');
    await cell.fill('0.75');
    await cell.press('Enter');
    await ready(page);
    // The value shown is read back from the regenerated trace's starting values.
    await params.locator('[data-control="param:L2.W"]').click();
    await expect(params.getByLabel('L2.W[1,1] starting value')).toHaveValue('0.75');
    await scrubTo(page, 30);
    await page
      .getByRole('button', { name: /Weight from Hidden 1 \(tanh\) unit 1 to Hidden 2 \(tanh\) unit 1/ })
      .press('Enter');
    await expect(
      page.locator('.inspector [data-key="before"], .inspector [data-key="w"]').first(),
    ).toContainText('0.75');
  });

  test('inspector: the panel names the element, shows its values and the instructions that made and used it', async ({
    page,
  }) => {
    await openExperiment(page, 'XOR needs a hidden layer');
    await scrubTo(page, 30);
    await page.getByRole('button', { name: /^Hidden 1 \(tanh\), unit 2/ }).click();
    const panel = page.locator('.inspector');
    await expect(panel).toHaveAttribute('data-element', 'L1.unit[2]');
    await expect(panel.locator('[data-of="L1.unit[2]"]').first()).toBeVisible();
    await expect(panel.locator('[data-of="L1.unit[3]"]')).toHaveCount(0);
    await expect(panel.getByText('In the trace')).toBeVisible();
    await expect(panel.locator('[data-instruction]').first()).toBeVisible();
  });

  test('reset experiment: an edited, moved, selected experiment returns to how it opened (defect 3)', async ({
    page,
  }) => {
    await openExperiment(page, 'XOR needs a hidden layer');
    await page.locator('.edit select').filter({ hasText: '300' }).selectOption('10');
    await page.getByRole('button', { name: 'Apply and restart' }).click();
    await ready(page);
    await expect(page.getByText('0 of 10 epochs complete')).toBeVisible();
    await scrubTo(page, 30);
    await page.getByRole('button', { name: /^Hidden 1 \(tanh\), unit 2/ }).click();
    await page.locator('main [data-control="reset-experiment"]').click();
    await ready(page);
    await expect(page.getByText('0 of 150 epochs complete')).toBeVisible();
    await expectCursor(page, -1);
    await expect(page.locator('.inspector [data-of]')).toHaveCount(0);
  });

  test('training view: the gradient heat map and the table view', async ({ page }) => {
    await openExperiment(page, 'Vanishing gradients');
    await scrubTo(page, oracle('vanishing-gradients').length - 1);
    const cell = page.locator('rect.pickable').nth(30);
    const epoch = Number(/Epoch (\d+)/.exec((await cell.locator('title').textContent()) ?? '')![1]);
    await cell.click();
    const src = oracle('vanishing-gradients');
    await expectCursor(page, src.header.epochStarts[epoch] - 1);
    const table = page.locator('details.table-view').first();
    await table.locator('summary').click();
    await expect(table.locator('table')).toBeVisible();
  });

  test('walkthrough: next, previous, hide and show change what is shown', async ({ page }) => {
    await openExperiment(page, 'A single neuron');
    const walk = page.locator('section.walkthrough');
    const first = await walk.locator('.walk-text').textContent();
    await walk.getByRole('button', { name: 'Next ▶' }).click();
    await expect(walk.locator('.walk-text')).not.toHaveText(first!);
    await walk.getByRole('button', { name: '◀ Previous' }).click();
    await expect(walk.locator('.walk-text')).toHaveText(first!);
    await walk.getByRole('button', { name: 'Hide' }).click();
    await expect(page.locator('section.walkthrough')).toHaveCount(0);
    await page.getByRole('button', { name: /Show the guided walkthrough/ }).click();
    await expect(page.locator('section.walkthrough .walk-text')).toHaveText(first!);
  });

  test('explanation: Simple/Detailed and the two in-place reveals change the output', async ({ page }) => {
    await openExperiment(page, 'XOR needs a hidden layer');
    await scrubTo(page, 30);
    const panel = page.locator('section.explanation');
    await page.getByRole('radio', { name: 'Simple' }).click();
    await expect(panel.locator('.katex')).toHaveCount(0);
    await expect(panel.locator('.kind')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Show the maths' }).click();
    await expect(panel.locator('.katex')).toHaveCount(1);
    await panel.getByRole('button', { name: "Show this step's numbers" }).click();
    await expect(panel.locator('.katex')).toHaveCount(2);
    await panel.getByRole('button', { name: 'Hide the maths' }).click();
    await expect(panel.locator('.katex')).toHaveCount(1);
    await page.getByRole('radio', { name: 'Detailed' }).click();
    await expect(panel.locator('.katex')).toHaveCount(2);
    await expect(panel.locator('.kind code')).toBeVisible();
  });

  test('self-check: every option of every question gives its own feedback', async ({ page }) => {
    for (const e of EXPERIMENTS) {
      await openExperiment(page, e.title);
      for (const [qi, q] of e.selfCheck.entries()) {
        const set = page.locator('section.selfcheck fieldset').nth(qi);
        for (const o of q.options) {
          await set.getByLabel(o.text, { exact: true }).check();
          await expect(set.locator('.feedback')).toContainText(o.feedback);
        }
      }
    }
  });

  test('walkthrough: every "Show me" action changes the position, the step size or the run', async ({
    page,
  }) => {
    const state = async (): Promise<string> =>
      JSON.stringify([
        await cursor(page),
        await page
          .locator('.controls [role="radio"][aria-checked="true"]')
          .getAttribute('aria-label')
          .catch(() => null),
        await page.locator('.structure .small.muted').first().textContent(),
        await page
          .locator('.tryit')
          .textContent()
          .catch(() => ''),
      ]);
    let actions = 0;
    for (const e of EXPERIMENTS) {
      await openExperiment(page, e.title);
      const walk = page.locator('section.walkthrough');
      for (const [k, w] of e.walkthrough.entries()) {
        if (w.action) {
          const before = await state();
          await walk.locator('button.primary-sm').click();
          await expect(walk.locator('button.primary-sm')).toBeEnabled({ timeout: 90_000 });
          await expect.poll(state, { timeout: 30_000, message: `${e.id} step ${k + 1}` }).not.toEqual(before);
          actions++;
        }
        if (k + 1 < e.walkthrough.length) await walk.getByRole('button', { name: 'Next ▶' }).click();
      }
    }
    // The audited count (docs/CONTROL-AUDIT.md). Counting the registry here would compare the loop with
    // itself and could never fail (ADR-054); a fixed number fails when an action is dropped or added.
    expect(actions).toBe(31);
  });

  test('export: high contrast, back to colour, refresh at the cursor and CSV change what is produced', async ({
    page,
  }) => {
    await scrubTo(page, 60);
    await page.locator('details.export summary').click();
    await expect(page.locator('.export-fig')).toHaveCount(5);
    const svgOf = async (): Promise<string> => {
      const [d] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('button', { name: 'Network architecture: download SVG' }).click(),
      ]);
      return readFileSync((await d.path())!, 'utf8');
    };
    const colour = await svgOf();
    await page.getByRole('radio', { name: 'High contrast' }).click();
    await expect(page.getByRole('button', { name: 'Preparing…' })).toHaveCount(0);
    expect(await svgOf()).not.toEqual(colour);
    await page.getByRole('radio', { name: 'Colour' }).click();
    await expect(page.getByRole('button', { name: 'Preparing…' })).toHaveCount(0);
    expect(await svgOf()).toEqual(colour);
    // CSV: the numbers behind a figure; refreshing at a later position changes them.
    const csvOf = async (): Promise<string> => {
      const [d] = await Promise.all([
        page.waitForEvent('download'),
        page
          .getByRole('button', { name: /Loss.*download CSV data/ })
          .first()
          .click(),
      ]);
      expect(d.suggestedFilename()).toMatch(/\.csv$/);
      return readFileSync((await d.path())!, 'utf8');
    };
    const early = await csvOf();
    await scrubTo(page, oracle('single-neuron').length - 1);
    await page.getByRole('button', { name: 'Refresh at current position' }).click();
    await expect(page.getByRole('button', { name: 'Preparing…' })).toHaveCount(0);
    const late = await csvOf();
    expect(late.split('\n').length).toBeGreaterThan(early.split('\n').length);
  });
});

test.describe('control audit: curriculum, mode and declared surface', () => {
  test.setTimeout(240_000);
  test.beforeEach(async ({ page }) => unlockAll(page));

  test('every curriculum button opens its experiment', async ({ page }) => {
    await page.goto('/?mode=expert');
    await ready(page);
    for (const e of EXPERIMENTS) {
      await page.getByRole('button', { name: new RegExp(`^${e.number}\\. `) }).click();
      await expect(page.locator('.intro')).toContainText(`${e.number}. ${e.title}.`, { timeout: 90_000 });
    }
  });

  test('switching mode keeps the position, in both directions', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /^6\. / }).click();
    await expect(page.locator('article.novice')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Next: / })).toBeEnabled({ timeout: 60_000 });
    // Each step lands before the next (the novice screen starts at phase steps); then the position is settled.
    const src = oracle('backpropagation');
    let at = -1;
    for (let k = 0; k < 3; k++) {
      await page.getByRole('button', { name: /^Next: / }).click();
      at = noviceStep('backpropagation', src, at, 'phase');
      await expectCursor(page, at);
    }
    await page.getByRole('button', { name: 'Expert mode', exact: true }).click();
    await expect(page.locator('.controls .position')).toBeVisible();
    expect(await cursor(page)).toBe(at);
    await page.getByRole('button', { name: 'Step ▶' }).click();
    await expect.poll(() => cursor(page)).toBeGreaterThan(at);
    const moved = await cursor(page);
    await page.getByRole('button', { name: 'Guided path' }).click();
    await expect(page.locator('article.novice')).toBeVisible();
    expect(await cursor(page)).toBe(moved);
    // The choice is remembered.
    await page.reload();
    await expect(page.locator('article.novice')).toBeVisible({ timeout: 60_000 });
  });

  test('no control renders that the experiment has not declared', async ({ page }) => {
    for (const mode of ['novice', 'expert'] as const) {
      await page.goto(`/?mode=${mode}`);
      for (const e of EXPERIMENTS) {
        await page.getByRole('button', { name: new RegExp(`^${e.number}\\. `) }).click();
        const novice = page.locator(`article.novice[data-screen="${e.id}"]`);
        if (mode === 'novice' && (await novice.count())) {
          // Purpose-built screen: no workbench controls at all.
          await expect(page.locator('.controls, .tryit, .structure .edit, details.export')).toHaveCount(0);
          const levels = page.locator('.stepbar [role="radio"]');
          for (const l of await levels.allTextContents())
            expect(
              e.surface.granularities.some((g) =>
                l.includes(
                  g === 'sample'
                    ? 'example'
                    : g === 'epoch'
                      ? 'full pass'
                      : g === 'operation'
                        ? 'calculation'
                        : g === 'phase'
                          ? 'forward'
                          : g,
                ),
              ),
              `${e.id}: ${l}`,
            ).toBe(true);
          continue;
        }
        await ready(page);
        const offered = offeredGranularities(e, mode);
        if (mode === 'novice') {
          // Breakpoints sit behind a disclosure on the novice path.
          // (The disclosure keeps its state from one experiment to the next.)
          const more = page.locator('details.more-controls');
          if ((await more.getAttribute('open')) === null) {
            await expect(page.locator('.breakpoints input').first()).toBeHidden();
            await more.locator('summary').click();
          }
          await expect(page.locator('.breakpoints input').first()).toBeVisible();
        }
        await expect(page.locator('.controls .granularity [role="radio"]')).toHaveCount(
          offered.length > 1 ? offered.length : 0,
        );
        await expect(page.locator('.tryit .try-row')).toHaveCount(e.editable.length);
        await expect(page.getByRole('button', { name: '+ add hidden layer' })).toHaveCount(
          e.surface.architectureEditor ? 1 : 0,
        );
        await expect(page.locator('details.export')).toHaveCount(mode === 'expert' ? 1 : 0);
        // A step size the screen does not offer cannot be chosen from the keyboard either:
        // after every other digit, a step still moves by the screen's own step size.
        if (offered.length < GRANULARITIES.length && e.id !== 'cnn-mnist') {
          await page.locator('.summary').click();
          for (const [k, g] of GRANULARITIES.entries())
            if (!offered.includes(g)) await page.keyboard.press(String(k + 1));
          await page.keyboard.press('ArrowRight');
          const g0 = startingGranularity(e, mode);
          await expectCursor(
            page,
            mode === 'novice' ? noviceStep(e.id, oracle(e.id), -1, g0) : stepForward(oracle(e.id), -1, g0),
          );
        }
      }
    }
  });
});

test.describe('control audit: novice screens', () => {
  test.setTimeout(240_000);
  const next = (page: Page) => page.getByRole('button', { name: /^Next: / });
  const back = (page: Page) => page.getByRole('button', { name: '◀ Back' });
  const deeper = async (page: Page, label: string | RegExp) => {
    const b = page.locator('.deeper-buttons').getByRole('button', { name: label });
    await b.click();
    await expect(b).toHaveAttribute('aria-expanded', 'true');
  };
  test.beforeEach(async ({ page }) => {
    await unlockAll(page);
    await page.goto('/?mode=novice');
  });

  test('novice steps narrate what they pass, and the list expands to every passed instruction (ADR-053)', async ({
    page,
  }) => {
    await expect(next(page)).toBeEnabled({ timeout: 60_000 });
    const src = oracle('single-neuron');
    await next(page).click();
    const m = semanticStep(src, -1, 'operation', 1);
    await expectCursor(page, m.cursor);
    expect(src.get(m.cursor).kind).toBe('MATMUL');
    const passed = page.locator('main details.passed');
    await expect(passed.locator('summary')).toContainText(
      'On the way: the weights and biases got their starting values',
    );
    await expect(passed.locator('li').first()).toBeHidden();
    await passed.locator('summary').click();
    await expect(passed.locator('li').first()).toBeVisible();
    await expect(passed.locator('li')).toHaveCount(m.passed![1] - m.passed![0] + 1);
    await expect(passed.locator('li').first()).toContainText('starting values');
    // A step inside one example passes nothing, so nothing is listed.
    await next(page).click();
    await expect(page.locator('main details.passed')).toHaveCount(0);
  });

  test('1 single neuron: step, sliders, prediction and reveal, learning, going deeper', async ({ page }) => {
    await expect(next(page)).toBeEnabled({ timeout: 60_000 });
    const src = oracle('single-neuron');
    let c = -1;
    for (let k = 0; k < 4; k++) {
      await next(page).click();
      c = noviceStep('single-neuron', src, c, 'operation');
      await expectCursor(page, c);
    }
    // On to the first weighted sum, each step one calculation.
    while (!((await page.locator('.narration').textContent()) ?? '').includes('Weighted sum')) {
      await next(page).click();
      c = noviceStep('single-neuron', src, c, 'operation');
      await expectCursor(page, c);
    }
    await back(page).click();
    await expectCursor(page, noviceStep('single-neuron', src, c, 'operation', -1));
    // Prediction, revised once, then the bias is raised: all four outputs go up.
    for (const o of [/stay the same/, /all go down/, /all go up/]) {
      await page.getByRole('button', { name: o }).click();
      await expect(page.getByRole('button', { name: o })).toHaveAttribute('aria-pressed', 'true');
    }
    await expect(page.getByRole('button', { name: /all go up/ })).toHaveAttribute('aria-pressed', 'true');
    const table = page.locator('table.outputs').first();
    const before = await table.textContent();
    await page.getByLabel('bias b', { exact: true }).fill('1');
    await expect(table).not.toHaveText(before!, { timeout: 30_000 });
    await expect(page.locator('.reveal')).toContainText('Your prediction held');
    // The weights change the outputs too.
    for (const w of ['weight w₁', 'weight w₂']) {
      const t0 = await table.textContent();
      await page.getByLabel(w, { exact: true }).fill('2');
      await expect(table).not.toHaveText(t0!, { timeout: 30_000 });
    }
    await page.getByRole('button', { name: 'Let it learn' }).click();
    await expect(page.getByText('After learning (outputs during its last pass)')).toBeVisible();
    await deeper(page, /Show the numbers/);
    await expect(page.getByText('Every value, with your settings')).toBeVisible();
    await deeper(page, /Show the maths/);
    await expect(page.locator('.deeper-body .katex').first()).toBeVisible();
    await deeper(page, /Add the decision line/);
    await expect(page.locator('svg.decision-svg line.boundary')).toBeVisible();
    await page.getByRole('button', { name: /Open the full workbench/ }).click();
    await expect(page.locator('.controls .position')).toBeVisible();
  });

  test('1 single neuron: reset experiment restores the sliders, the position and the prediction (defect 3)', async ({
    page,
  }) => {
    await expect(next(page)).toBeEnabled({ timeout: 60_000 });
    await page.getByRole('button', { name: /all go down/ }).click();
    await page.getByLabel('bias b', { exact: true }).fill('1');
    await next(page).click();
    await next(page).click();
    await page.locator('main [data-control="reset-experiment"]').click();
    await expect(page.getByLabel('bias b', { exact: true })).toHaveValue('0', { timeout: 30_000 });
    await expectCursor(page, -1);
    await expect(page.getByRole('button', { name: /all go down/ })).toHaveAttribute('aria-pressed', 'false');
  });

  test('5 gradient descent: step sizes, play, jump, learning rate and batch size with predictions, going deeper', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /^5\. / }).click();
    await expect(next(page)).toBeEnabled({ timeout: 60_000 });
    const src = oracle('gradient-descent');
    let c = -1;
    for (const g of ['sample', 'batch'] as const) {
      await page
        .locator('.stepbar')
        .getByRole('radio', { name: g === 'sample' ? 'one example' : 'one batch' })
        .click();
      await next(page).click();
      c = noviceStep('gradient-descent', src, c, g);
      await expectCursor(page, c);
      await back(page).click();
      c = noviceStep('gradient-descent', src, c, g, -1);
      await expectCursor(page, c);
      await next(page).click();
      c = noviceStep('gradient-descent', src, c, g);
      await expectCursor(page, c);
    }
    await page.getByRole('button', { name: '▶ Watch it walk' }).click();
    await expect.poll(() => cursor(page)).toBeGreaterThan(c);
    await page.getByRole('button', { name: '❚❚ Pause' }).click();
    const stopped = await cursor(page);
    await page.waitForTimeout(600);
    expect(await cursor(page)).toBe(stopped);
    await page.getByRole('button', { name: 'Jump to the end' }).click();
    await expectCursor(page, src.length - 1);
    // Learning rate 1.1: predict, then the run happens and the reveal says what it did.
    const loss = page.locator('.learn strong');
    const base = await loss.textContent();
    await page.getByRole('radio', { name: 'η = 1.1' }).click();
    await expect(page.locator('.predict legend')).toContainText('with η = 1.1');
    await expect(loss).toHaveText(base!);
    await page.getByRole('button', { name: /it blows up/ }).click();
    await expect(page.locator('.reveal')).toContainText('Your prediction held', { timeout: 30_000 });
    await expect(loss).not.toHaveText(base!);
    // Each learning rate runs once its prediction is made; this sequence meets all four outcomes.
    for (const [lr, outcome] of [
      ['0.3', 'lower'],
      ['0.02', 'higher'],
      ['0.9', 'lower'],
      ['0.3', 'about the same'],
    ] as const) {
      await page.getByRole('radio', { name: `η = ${lr}` }).click();
      await page.locator('.predict-options').getByRole('button', { name: outcome }).click();
      await expect(page.getByText(new RegExp(`with η = ${lr.replace('.', '\\.')}, B = 50`))).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.locator('.reveal')).toContainText('Your prediction held');
    }
    // The second control.
    await page.getByRole('button', { name: /A second control: the batch size/ }).click();
    for (const [b, steps] of [
      ['5', '10 steps'],
      ['10', '5 steps'],
      ['50', '1 step'],
    ] as const) {
      await page.getByRole('radio', { name: `B = ${b}`, exact: true }).click();
      await page
        .locator('.second-control')
        .getByRole('button', { name: steps, exact: false })
        .first()
        .click();
      await expect(page.getByText(new RegExp(`B = ${b}:`))).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('.second-control .reveal')).toContainText('Your prediction held');
    }
    await deeper(page, /Show the numbers/);
    await expect(page.getByText('Loss over all 50 points after each pass')).toBeVisible();
    await deeper(page, /Show the maths/);
    await expect(page.locator('.deeper-body .katex').first()).toBeVisible();
    await deeper(page, /Add the loss-per-pass chart/);
    await expect(page.locator('.deeper-body figure.chart').first()).toBeVisible();
  });

  test('6 back-propagation: three step sizes, following a weight, prediction and reveal, the chain rule, going deeper', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /^6\. / }).click();
    await expect(next(page)).toBeEnabled({ timeout: 60_000 });
    const src = oracle('backpropagation');
    let c = -1;
    for (const [g, label] of [
      ['phase', 'forward / backward / update'],
      ['layer', 'one layer'],
      ['operation', 'one calculation'],
    ] as const) {
      await page.locator('.stepbar').getByRole('radio', { name: label }).click();
      await next(page).click();
      c = noviceStep('backpropagation', src, c, g);
      await expectCursor(page, c);
      await back(page).click();
      c = noviceStep('backpropagation', src, c, g, -1);
      await expectCursor(page, c);
      await next(page).click();
      c = noviceStep('backpropagation', src, c, g);
      await expectCursor(page, c);
    }
    // Follow another weight, predict, and step on until the backward pass reaches it.
    await page
      .getByRole('button', { name: /Weight from Input unit 2 to Hidden 1 \(sigmoid\) unit 3/ })
      .click();
    await expect(page.locator('.novice-controls')).toContainText(
      'the weight from input 2 to hidden neuron 3',
    );
    await page.locator('.stepbar').getByRole('radio', { name: 'one calculation' }).click();
    const predict = page.locator('.predict-options button');
    if (!(await predict.count())) {
      // This example's gradient is already known: move on to the next example first.
      await page.locator('.stepbar').getByRole('radio', { name: 'forward / backward / update' }).click();
      while (!(await predict.count())) await next(page).click();
      await page.locator('.stepbar').getByRole('radio', { name: 'one calculation' }).click();
    }
    for (const k of [0, 2, 1]) {
      await predict.nth(k).click();
      await expect(predict.nth(k)).toHaveAttribute('aria-pressed', 'true');
    }
    while (!(await page.locator('.reveal').count())) await next(page).click();
    await expect(page.locator('.reveal')).toContainText(/Your prediction held|Not this time/);
    await expect(page.locator('.chain')).toContainText('✓ the same');
    await page.getByRole('button', { name: 'Predict again for another example or weight' }).click();
    await expect(page.locator('.reveal')).toHaveCount(0);
    await deeper(page, /Show the numbers/);
    await expect(page.locator('.deeper-body .inspector h2')).toContainText('W1[2,3]');
    await deeper(page, /Show the maths/);
    await expect(page.locator('.deeper-body .katex').first()).toBeVisible();
    await deeper(page, /Add the training charts/);
    await expect(page.locator('.deeper-body figure.chart').first()).toBeVisible();
    await deeper(page, /Try another activation/);
    await page.locator('.deeper-body select').selectOption('tanh');
    await expect(page.locator('svg.network-svg').first()).toContainText('Hidden 1 (tanh)', {
      timeout: 30_000,
    });
  });
});

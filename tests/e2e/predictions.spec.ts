/**
 * Invariant P: the prediction lifecycle (Fix Round 6, A5; ADR-080). For every prediction in every experiment:
 *  - it is never resolved before the action that settles it has occurred;
 *  - once answered, the screen always shows either its waiting state or its result, never neither.
 *
 * Each prediction is answered, then taken through the things that must NOT settle it (the new run finishing
 * generating; for experiment 1's bias, the training run), checked at each point, then through the action that
 * does settle it. `[data-prediction="<id>"][data-state="waiting|resolved"]` is what the screen shows.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { EXPERIMENTS } from '../../src/experiments/registry';
import { unlockAll } from './helpers';

type State = 'waiting' | 'resolved' | 'none';

/** What the screen shows for a prediction (id or id pattern): resolved anywhere wins, else waiting, else nothing. */
async function stateOf(page: Page, id: string | RegExp): Promise<State> {
  const count = async (st: string): Promise<number> => {
    const all = page.locator(`[data-prediction][data-state="${st}"]`);
    let n = 0;
    for (let k = 0; k < (await all.count()); k++) {
      const p = (await all.nth(k).getAttribute('data-prediction')) ?? '';
      if (typeof id === 'string' ? p === id : id.test(p)) n++;
    }
    return n;
  };
  if (await count('resolved')) return 'resolved';
  if (await count('waiting')) return 'waiting';
  return 'none';
}

/** Asserts the state, after letting the screen settle: an answered prediction is never "none". */
async function expectState(page: Page, id: string | RegExp, want: 'waiting' | 'resolved', when: string) {
  await page.waitForTimeout(600);
  await expect
    .poll(() => stateOf(page, id), { message: `${String(id)}: ${when}`, timeout: 60_000 })
    .toBe(want);
}

async function openNovice(page: Page, number: string, id: string): Promise<Locator> {
  await page.getByRole('button', { name: new RegExp(`^${number}\\. `) }).click();
  const screen = page.locator(`article.novice[data-screen="${id}"]`);
  await expect(screen).toBeVisible({ timeout: 120_000 });
  await expect(screen.locator('[data-control="step"]')).toBeEnabled({ timeout: 300_000 });
  return screen;
}

const typeBias = async (page: Page, v: string) => {
  const f = page.locator('[data-control="tryit:2"]');
  await f.fill(v);
  await f.press('Enter');
};

test.describe('P. prediction lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await unlockAll(page);
    await page.goto('/?mode=novice');
  });

  test('1, bias: waiting from the answer; not settled by training; settled by raising the bias', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const screen = await openNovice(page, '1', 'single-neuron');
    const q = screen.locator('fieldset.predict').filter({ hasText: 'make the bias b larger' });
    await q.getByRole('button', { name: /all go up/ }).click();
    await expectState(page, 'bias-up', 'waiting', 'right after the answer');
    await expect(q.locator('[data-state="waiting"]')).toContainText('Raise the bias to find out');
    // Training moves the bias the neuron uses; it must not settle (or strand) the prediction.
    await page.getByRole('button', { name: 'Let it learn' }).click();
    await expectState(page, 'bias-up', 'waiting', 'after the training run');
    await typeBias(page, '-1');
    await expectState(page, 'bias-up', 'waiting', 'after lowering the bias');
    await typeBias(page, '2');
    await expectState(page, 'bias-up', 'resolved', 'after raising the bias above where it was answered');
    // The result is at the question itself, where the learner is looking.
    await expect(q.locator('[data-state="resolved"]')).toContainText('all go up');
  });

  test('1, learning: waiting while stepping; settled at the end of the run', async ({ page }) => {
    test.setTimeout(180_000);
    const screen = await openNovice(page, '1', 'single-neuron');
    const q = screen.locator('fieldset.predict').filter({ hasText: 'Once it has learned' });
    await q.getByRole('button').first().click();
    await expectState(page, 'train-outcome', 'waiting', 'right after the answer');
    for (let k = 0; k < 5; k++) await screen.locator('[data-control="step"]').click();
    await expectState(page, 'train-outcome', 'waiting', 'after five steps');
    await page.getByRole('button', { name: 'Let it learn' }).click();
    await expectState(page, 'train-outcome', 'resolved', 'at the end of the run');
  });

  test('5, learning rate and batch size: waiting after the new run is generated; settled by watching it', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const screen = await openNovice(page, '5', 'gradient-descent');
    await screen.locator('[data-control="lr"][aria-checked="false"]').first().click();
    await screen.locator('.predict [data-control="predict:option"]').first().click();
    await expectState(page, /^lr-/, 'waiting', 'right after the answer');
    await expect(screen.locator('[data-control="lr"]').first()).toBeEnabled({ timeout: 120_000 });
    await expectState(page, /^lr-/, 'waiting', 'the new run generated, not yet watched');
    await screen.getByRole('button', { name: 'Jump to the end' }).click();
    await expectState(page, /^lr-/, 'resolved', 'at the end of the new run');
    // The batch size, offered once a learning-rate prediction is settled.
    await screen.locator('[data-control="batch-open"]').click();
    await screen.locator('[data-control="batch"][aria-checked="false"]').first().click();
    await screen.locator('.second-control .predict [data-control="predict:option"]').first().click();
    await expectState(page, /^batch-/, 'waiting', 'right after the answer');
    await expect(screen.locator('[data-control="batch"]').first()).toBeEnabled({ timeout: 120_000 });
    await expectState(page, /^batch-/, 'waiting', 'the new run generated, its first pass not yet watched');
    await screen.getByRole('button', { name: 'Jump to the end' }).click();
    await expectState(page, /^batch-/, 'resolved', 'after the first pass has been watched');
  });

  test('6, the push on a weight: waiting until the backward pass reaches it', async ({ page }) => {
    test.setTimeout(180_000);
    const screen = await openNovice(page, '6', 'backpropagation');
    await screen.locator('.predict [data-control="predict:option"]').first().click();
    await expectState(page, 'push', 'waiting', 'right after the answer');
    const next = screen.locator('[data-control="step"]');
    let state: State = 'waiting';
    for (let k = 0; k < 40 && state === 'waiting'; k++) {
      await next.click();
      await page.waitForTimeout(150);
      state = await stateOf(page, 'push');
      expect(state, `step ${k + 1}: an answered prediction shows waiting or a result`).not.toBe('none');
    }
    expect(state).toBe('resolved');
  });

  for (const id of [
    'activations',
    'forward-propagation',
    'loss',
    'xor-mlp',
    'cnn-mnist',
    'vanishing-gradients',
    'lr-pathology',
  ]) {
    const e = EXPERIMENTS.find((x) => x.id === id)!;
    test(`${e.number} ${e.title}: waiting after the new run is generated; settled at its end`, async ({
      page,
    }) => {
      test.setTimeout(id === 'cnn-mnist' ? 900_000 : 300_000);
      const screen = await openNovice(page, e.number, id);
      await screen.locator('[data-control="choice"][aria-checked="false"]').first().click();
      await screen.locator('.predict [data-control="predict:option"]').first().click();
      await expectState(page, /^choice-/, 'waiting', 'right after the answer');
      await expect(screen.locator('[data-control="choice"]').first()).toBeEnabled({ timeout: 240_000 });
      await expect(screen.locator('[data-control="step"]')).toBeEnabled({ timeout: 240_000 });
      await expectState(page, /^choice-/, 'waiting', 'the new run generated, not yet watched');
      await screen.getByRole('button', { name: 'Jump to the end' }).click();
      await expectState(page, /^choice-/, 'resolved', 'at the end of the new run');
    });
  }
});

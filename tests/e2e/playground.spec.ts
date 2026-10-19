/**
 * Condition C2 uses a pinned local copy of TensorFlow Playground (Fix Round 1,
 * C1). It must run with every external request blocked: training starts, the
 * task's settings are read from the URL, and the icon font is local.
 */
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sheet = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../src/study/config/playground-sheet.json'), 'utf8'),
) as { playground_sources: { local: string }; tasks: { id: string; params?: string }[] };

test('the vendored TensorFlow Playground runs offline with the task settings', async ({ page }) => {
  const external: string[] = [];
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
    external.push(url.href);
    return route.abort();
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const task = sheet.tasks.find((t) => t.id === 'pg7')!; // XOR, no hidden layer
  await page.goto(`/${sheet.playground_sources.local}#${task.params}`);
  await expect(page.locator('#iter-number')).toHaveText(/000,000/);
  // The task's URL settings were applied: XOR dataset selected, no hidden layers.
  await expect(page.locator('canvas[data-dataset="xor"].selected')).toHaveCount(1);
  await expect(page.locator('#num-layers')).toHaveText('0');
  // The icon font is the local copy, so the play button shows an icon, not the word "play_arrow".
  expect(await page.evaluate(() => document.fonts.check("24px 'Material Icons'"))).toBe(true);
  await page.locator('#play-pause-button').click();
  await expect(page.locator('#iter-number')).not.toHaveText(/^000,000$/, { timeout: 10_000 });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

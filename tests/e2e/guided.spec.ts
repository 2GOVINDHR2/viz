/**
 * The guided screens built on the shared template (Fix Round 5, Part 4; ADR-073), in the real app:
 *  - the banner is gone because the screen is real;
 *  - the opening question, the two named ways to run, Going deeper and the bridge are there;
 *  - choosing a different preset asks for a prediction first, runs, and reveals the outcome the two runs produced.
 * And experiment 5's prediction fires for every non-default learning-rate preset (Fix Round 5, 6.5).
 */
import { expect, test } from '@playwright/test';
import { EXPERIMENTS } from '../../src/experiments/registry';
import { unlockAll } from './helpers';

const GUIDED = [
  'activations',
  'forward-propagation',
  'loss',
  'xor-mlp',
  'cnn-mnist',
  'vanishing-gradients',
  'lr-pathology',
];

for (const id of GUIDED) {
  const e = EXPERIMENTS.find((x) => x.id === id)!;
  test(`${e.number} ${e.title}: guided screen, predict, run, reveal`, async ({ page }) => {
    test.setTimeout(id === 'cnn-mnist' ? 600_000 : 180_000);
    await unlockAll(page);
    await page.goto('/?mode=novice');
    await page.getByRole('button', { name: new RegExp(`^${e.number}\\. `) }).click();
    const screen = page.locator(`article.novice[data-screen="${id}"]`);
    await expect(screen).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText('still being built')).toHaveCount(0);
    await expect(screen.locator('h2.novice-question')).toContainText('?');
    await expect(screen.getByRole('button', { name: /Watch it|Pause/ })).toBeVisible();
    await expect(screen.getByRole('button', { name: 'Jump to the end' })).toBeVisible();
    await expect(screen.getByRole('region', { name: 'Going deeper' })).toBeVisible();
    await expect(screen.locator('.handoff')).toContainText('Next question.');
    // Wait for the first run to finish (its results decide the prediction).
    await expect(screen.locator('[data-control="choice"]').first()).toBeEnabled({ timeout: 300_000 });
    const other = screen.locator('[data-control="choice"][aria-checked="false"]').first();
    await other.click();
    const options = screen.locator('.predict [data-control="predict:option"]');
    await expect(options.first()).toBeVisible();
    await options.first().click();
    // Settled by watching the new run to its end (Fix Round 6, A4), not by its being generated.
    await expect(screen.locator('[data-state="waiting"]')).toBeVisible();
    await expect(screen.locator('[data-control="step"]')).toBeEnabled({
      timeout: id === 'cnn-mnist' ? 500_000 : 120_000,
    });
    await screen.getByRole('button', { name: 'Jump to the end' }).click();
    await expect(screen.locator('.reveal')).toBeVisible({ timeout: id === 'cnn-mnist' ? 500_000 : 120_000 });
    await expect(screen.locator('.reveal')).toContainText(/Your prediction held|Not this time/);
    await expect(screen.locator('.reveal')).toContainText('what happened');
    // The outcome is recorded (it counts towards the learner's record and can no longer be changed).
    await expect(screen.locator('.reveal')).toHaveAttribute('data-recorded', 'true');
  });
}

test('5 Gradient descent: the prediction fires for every non-default learning-rate preset', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await unlockAll(page);
  await page.goto('/?mode=novice');
  await page.getByRole('button', { name: /^5\. / }).click();
  const screen = page.locator('article.novice[data-screen="gradient-descent"]');
  await expect(screen).toBeVisible({ timeout: 120_000 });
  const presets = screen.locator('[data-control="lr"]');
  const n = await presets.count();
  let fired = 0;
  for (let k = 0; k < n; k++) {
    const b = presets.nth(k);
    await expect(b).toBeEnabled({ timeout: 60_000 });
    if ((await b.getAttribute('aria-checked')) === 'true') continue;
    await b.click();
    await screen.locator('.predict [data-control="predict:option"]').first().click();
    await expect(b).toBeEnabled({ timeout: 60_000 });
    await screen.getByRole('button', { name: 'Jump to the end' }).click();
    await expect(screen.locator('.reveal')).toContainText(/Your prediction held|Not this time/, {
      timeout: 60_000,
    });
    fired++;
  }
  // The current value moves with each run, so every preset, including the default, ends up exercised.
  expect(fired).toBeGreaterThanOrEqual(n - 1);
});

test('5.1 hovering a neuron lights what it reads and feeds, and labels it at the neuron', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await unlockAll(page);
  await page.goto('/?mode=expert');
  await page.getByRole('button', { name: /^3\. / }).click();
  await expect(page.locator('.position[data-cursor="-1"]')).toBeVisible({ timeout: 120_000 });
  const svg = page.locator('.network-svg');
  const nodes = svg.locator('.node');
  // Hidden layer: 3 neurons, fed by 2 inputs, feeding 1 output (experiment 3's network).
  const hidden = nodes.nth(2);
  await hidden.hover();
  await expect(svg).toHaveClass(/hovering/);
  await expect(svg.locator('.node.involved')).toHaveCount(4);
  await expect(svg.locator('.edge.involved')).toHaveCount(3);
  await expect(svg.locator('[data-hover-tip]')).toContainText('neuron 1');
  await page.mouse.move(0, 0);
  await expect(svg).not.toHaveClass(/hovering/);
  await expect(svg.locator('[data-hover-tip]')).toHaveCount(0);
});

test('the CNN trace view reads only the rows in view: the page heap stays bounded mid-run', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await unlockAll(page);
  await page.goto('/?mode=expert');
  await page.getByRole('button', { name: /^8\. / }).click();
  await expect(page.locator('.position[data-cursor="-1"]')).toBeVisible({ timeout: 120_000 });
  const scrub = page.getByLabel('Position', { exact: true });
  await scrub.fill(String(Math.floor(Number(await scrub.getAttribute('max')) / 2)));
  await page.waitForTimeout(15_000);
  // Reading the whole CNN trace took the heap past 1.5 GB (Fix Round 5 finding); the rows in view need far less.
  const heapMB = await page.evaluate(
    () => (performance as unknown as { memory: { usedJSHeapSize: number } }).memory.usedJSHeapSize / 1e6,
  );
  expect(heapMB).toBeLessThan(600);
  await expect(page.locator('[data-trace-partial]')).toBeVisible();
  await expect(page.locator('.trace-row.current .trace-meaning')).not.toHaveText('…', { timeout: 30_000 });
});

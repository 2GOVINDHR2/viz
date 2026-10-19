import { expect, test } from '@playwright/test';
import { detailed, openExperiment, unlockAll } from './helpers';

test.describe('vertical slice', () => {
  test('loads, steps forward and back, explains, and runs to a breakpoint', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await unlockAll(page);
    await page.goto('/?mode=expert');
    await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
    await detailed(page);

    await page.getByRole('button', { name: /Step ▶/ }).click();
    await expect(page.locator('.explanation .kind code')).toHaveText('INIT_PARAM');
    await expect(page.locator('.mode-indicator')).toContainText('CONTROL');

    // Layer granularity: run to the first forward layer.
    await page.getByRole('radio', { name: 'Layer', exact: true }).click();
    for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
    await expect(page.locator('.mode-indicator')).toContainText('FORWARD');
    await expect(page.locator('.explanation .sentence')).not.toBeEmpty();
    await expect(page.locator('.explanation .katex').first()).toBeVisible();

    // Breakpoint at the start of back-propagation.
    await page.getByLabel(/back-propagation starts/).check();
    await page.getByRole('button', { name: /To breakpoint/ }).click();
    await expect(page.locator('.explanation .kind code')).toHaveText('GRAD_INIT');
    await expect(page.locator('.mode-indicator')).toContainText('BACKWARD');
    await expect(page.getByRole('alert')).toContainText('Paused');

    // Step back restores the forward-pass state.
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.mode-indicator')).not.toContainText('BACKWARD');
    expect(errors).toEqual([]);
  });

  test('both experiments run end to end to the last instruction', async ({ page }) => {
    for (const title of ['A single neuron', 'XOR needs a hidden layer']) {
      await unlockAll(page);
      await page.goto('/?mode=expert');
      await openExperiment(page, title);
      await detailed(page);
      await page.getByRole('radio', { name: 'Epoch', exact: true }).click();
      const scrub = page.getByLabel('Position', { exact: true });
      const max = Number(await scrub.getAttribute('max'));
      await scrub.fill(String(max));
      await expect(page.locator('.explanation .kind code')).toHaveText('EPOCH_END');
      await expect(page.locator('.summary')).toContainText('accuracy 100%');
    }
  });

  test('neurons are keyboard-focusable and focus changes the explanation', async ({ page }) => {
    await unlockAll(page);
    await page.goto('/?mode=expert');
    await openExperiment(page, 'XOR needs a hidden layer');
    await page.getByRole('radio', { name: 'Layer', exact: true }).click();
    for (let k = 0; k < 5; k++) await page.keyboard.press('ArrowRight');
    const node = page.getByRole('button', { name: /Hidden 1 \(tanh\), unit 3/ });
    await node.focus();
    await page.keyboard.press('Enter');
    await expect(node).toHaveAttribute('aria-pressed', 'true');
  });
});

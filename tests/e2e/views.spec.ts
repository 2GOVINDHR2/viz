import { expect, test } from '@playwright/test';

test.describe('three synchronised views (P5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Experiment').selectOption({ label: 'XOR needs a hidden layer' });
    await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
  });

  test('training view follows the cursor and its charts move the cursor', async ({ page }) => {
    await expect(page.getByText('0 of 150 epochs complete')).toBeVisible();
    await page.getByRole('radio', { name: 'Epoch' }).click();
    for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
    await expect(page.getByText('3 of 150 epochs complete')).toBeVisible();
    await expect(page.getByText(/Decision boundary after epoch 3/)).toBeVisible();
    // Click near the right end of the loss chart: the cursor jumps to the end of a late epoch.
    const chart = page.locator('figure.chart', { hasText: 'Loss per epoch' }).locator('svg').first();
    const box = (await chart.boundingBox())!;
    await chart.click({ position: { x: box.width * 0.9, y: box.height / 2 } });
    await expect(page.locator('.explanation .kind code')).toHaveText('EPOCH_END');
    await expect(page.getByText(/1[23]\d of 150 epochs complete/)).toBeVisible();
  });

  test('inspector shows a weight’s numbers and the structure view highlights the active layer', async ({
    page,
  }) => {
    await page.getByRole('radio', { name: 'Layer' }).click();
    for (let k = 0; k < 6; k++) await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: /Weight from Input unit 1 to Hidden 1 \(tanh\) unit 1/ }).click();
    await expect(page.locator('.inspector h2')).toHaveText('Weight W1[1,1]');
    await expect(page.locator('.inspector')).toContainText('contribution');
    await expect(page.locator('.layer-card.active')).toContainText('L1');
  });

  test('what-changed lists the step’s effects', async ({ page }) => {
    await page.getByRole('radio', { name: 'Phase' }).click();
    for (let k = 0; k < 13; k++) await page.keyboard.press('ArrowRight');
    await expect(page.locator('.changes')).toBeVisible();
    await expect(page.locator('.changes li').first()).toContainText('executed');
  });

  test('editing the architecture regenerates the run and resets the cursor', async ({ page }) => {
    await page.getByRole('button', { name: /Step ▶/ }).click();
    await page.getByLabel('Units in hidden layer 1').fill('2');
    await page.getByRole('button', { name: 'Apply and restart' }).click();
    await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
    await expect(page.locator('.layer-card').first()).toContainText('[2]');
    await expect(page.getByRole('button', { name: /Hidden 1 \(tanh\), unit 3/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'restore defaults' }).click();
    await expect(page.locator('.layer-card').first()).toContainText('[4]');
  });
});

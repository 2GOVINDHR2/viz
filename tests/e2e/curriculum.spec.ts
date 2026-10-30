import { expect, test } from '@playwright/test';
import { detailed } from './helpers';

test.describe('curriculum (P6)', () => {
  test('prerequisites lock later experiments until the self-check is passed', async ({ page }) => {
    await page.goto('/?mode=expert');
    await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
    const second = page.getByRole('button', { name: /^2\. Activation functions/ });
    await expect(second).toBeDisabled();
    await expect(second).toHaveAccessibleName(/complete “A single neuron” first/);
    // Answer the single-neuron self-check: a wrong answer gives feedback, the right ones complete it.
    await page.getByLabel('1', { exact: true }).check();
    await expect(page.locator('.feedback.wrong')).toBeVisible();
    await page.getByLabel('0', { exact: true }).check();
    await page.getByLabel('increases').check();
    await expect(page.getByText(/Experiment complete/)).toBeVisible();
    await expect(second).toBeEnabled();
    await second.click();
    await expect(page.getByText(/Activation function: sigmoid/)).toBeVisible();
  });

  test('the walkthrough performs its steps and resumes after a reload', async ({ page }) => {
    await page.goto('/?mode=expert');
    await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
    await expect(page.getByText('Walkthrough · 1 of 5')).toBeVisible();
    await detailed(page);
    await page.getByRole('button', { name: 'Load the first example' }).click();
    await expect(page.locator('.explanation .kind code')).toHaveText('LOAD_INPUT');
    await page.getByRole('button', { name: 'Next ▶' }).click();
    await page.getByRole('button', { name: 'Step once' }).click();
    await expect(page.locator('.explanation .kind code')).toHaveText('MATMUL');
    await page.getByRole('button', { name: 'Next ▶' }).click();
    await page.reload();
    await expect(page.getByText('Walkthrough · 3 of 5')).toBeVisible();
    await page.getByRole('button', { name: 'Hide' }).click();
    await expect(page.getByRole('button', { name: /Show the guided walkthrough \(3 of 5\)/ })).toBeVisible();
  });

  test('a typed starting weight restarts the run with exactly that value', async ({ page }) => {
    await page.goto('/?mode=expert');
    await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
    const field = page.getByLabel('starting weight w₁', { exact: true });
    await field.fill('1.137');
    await field.press('Enter');
    await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
    await page.getByRole('button', { name: /Step ▶/ }).click();
    await page.getByRole('button', { name: "Show this step's numbers" }).click();
    await expect(page.locator('.explanation')).toContainText('1.137');
    // An entry training cannot run is refused with a message, and the field says so to assistive technology.
    await field.fill('1..2');
    await field.press('Enter');
    await expect(page.getByRole('alert').filter({ hasText: 'Enter a number' })).toBeVisible();
    await expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  test('a dragged starting weight restarts the run with that value', async ({ page }) => {
    await page.goto('/?mode=expert');
    await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
    // The slider (drag) and the typed field show the same state (Fix Round 3, A3).
    const slider = page.getByLabel('starting weight w₁ (drag)');
    await slider.focus();
    for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowRight');
    await page.keyboard.up('ArrowRight');
    await expect(page.getByLabel('starting weight w₁', { exact: true })).toHaveValue('1.5');
    // The run restarts once the slider has been still for a moment.
    await page.waitForTimeout(600);
    await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
    await page.getByRole('button', { name: /Step ▶/ }).click();
    await page.getByRole('button', { name: "Show this step's numbers" }).click();
    await expect(page.locator('.explanation')).toContainText('1.5');
  });
});

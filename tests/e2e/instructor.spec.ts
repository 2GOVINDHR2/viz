/**
 * Fix Round 6, C (ADR-083): on a browser that has never run the curriculum, an instructor can open every experiment
 * for a demonstration, see that it is on, and return to the learner's own locks; nothing is marked complete.
 */
import { expect, test } from '@playwright/test';

const chip = (page: import('@playwright/test').Page, n: string) =>
  page.getByRole('button', { name: new RegExp(`^${n}\\. `) });

test('C. the instructor view opens experiment 8 and D2 on a fresh browser, and is reversible', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.goto('/?mode=novice');
  await expect(chip(page, '8')).toBeDisabled();
  await expect(chip(page, 'D2')).toBeDisabled();
  // Not on the learner's path: inside a closed "For instructors" disclosure.
  const open = page.locator('[data-control="instructor:open"]');
  await expect(open).toBeHidden();
  await page.getByText('For instructors').click();
  await expect(page.locator('details.instructor')).toContainText('does not mark anything complete');
  await open.click();
  await expect(page.locator('.instructor-banner')).toContainText('Instructor view');
  await expect(chip(page, '8')).toBeEnabled();
  await expect(chip(page, 'D2')).toBeEnabled();
  await chip(page, '8').click();
  await expect(page.locator('article.novice[data-screen="cnn-mnist"]')).toBeVisible({ timeout: 120_000 });
  const progress = await page.evaluate(() => localStorage.getItem('dl-vizlab.progress.v1'));
  expect(progress === null || JSON.parse(progress).completed.length === 0).toBe(true);
  // It survives a reload (a demonstration may span several), and is turned off in one click.
  await page.reload();
  await expect(page.locator('.instructor-banner')).toBeVisible();
  await page.locator('[data-control="instructor:close"]').click();
  await expect(page.locator('.instructor-banner')).toHaveCount(0);
  await expect(chip(page, '8')).toBeDisabled();
  await expect(page.locator('article.novice[data-screen="single-neuron"]')).toBeVisible({ timeout: 60_000 });
});

test('C. a link with ?instructor=open opens the view directly', async ({ page }) => {
  await page.goto('/?mode=novice&instructor=open');
  await expect(page.locator('.instructor-banner')).toBeVisible();
  await expect(chip(page, 'D1')).toBeEnabled();
});

/**
 * WCAG 2.1 A/AA automated audit (axe-core) of every experiment's main screen,
 * the export panel, and every Study Mode screen. Findings are written to
 * reports/a11y.json; the test fails on any violation.
 */
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openExperiment, unlockAll } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const results: Record<
  string,
  { violations: { id: string; impact: string | null; nodes: number; help: string }[]; passes: number }
> = {};

async function audit(page: Page, name: string): Promise<void> {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  results[name] = {
    passes: r.passes.length,
    violations: r.violations.map((v) => ({
      id: v.id,
      impact: v.impact ?? null,
      nodes: v.nodes.length,
      help: v.help,
    })),
  };
  expect(
    r.violations.map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes
          .map((n) => n.target.join(' '))
          .slice(0, 3)
          .join(' | ')})`,
    ),
    name,
  ).toEqual([]);
}

test.describe('accessibility (WCAG 2.1 AA, automated)', () => {
  test.setTimeout(180_000);
  test.afterAll(() => {
    writeFileSync(
      resolve(import.meta.dirname, '../../reports/a11y.json'),
      JSON.stringify(results, null, 2) + '\n',
    );
  });

  const titles = [
    'A single neuron',
    'Activation functions',
    'Forward propagation',
    'Loss functions',
    'Gradient descent',
    'Back-propagation',
    'XOR needs a hidden layer',
    'A CNN on handwritten digits',
    'Vanishing gradients',
    'Learning-rate pathology',
  ];

  test('every experiment, mid-run, with the export panel open', async ({ page }) => {
    await unlockAll(page);
    await page.goto('/?mode=expert');
    for (const t of titles) {
      await openExperiment(page, t);
      await page.getByRole('button', { name: 'Step ▶' }).click();
      await page.keyboard.press('ArrowRight');
      await audit(page, `experiment: ${t}`);
    }
    await page.locator('details.export summary').click();
    await expect(page.locator('.export-fig').first()).toBeVisible();
    await audit(page, 'export panel');
  });

  test('every novice screen (Fix Round 2): first view, after a prediction and a step, every "going deeper" open, both themes', async ({
    page,
  }) => {
    await unlockAll(page);
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      for (const t of titles) {
        await page.getByRole('button', { name: new RegExp(`^\\S+\\. ${t}`) }).click();
        const screen = page.locator('article.novice');
        if (!(await screen.count())) {
          // Not yet rebuilt: the workbench filtered by the experiment's declared surface.
          await expect(page.getByText(/Instruction 0 \//)).toBeVisible({ timeout: 90_000 });
          await audit(page, `novice workbench (${scheme}): ${t}`);
          continue;
        }
        await expect(page.getByRole('button', { name: /^Next: / })).toBeEnabled({ timeout: 60_000 });
        await audit(page, `novice (${scheme}): ${t}`);
        const option = page.locator('.predict-options button').first();
        if (await option.count()) await option.click();
        await page.getByRole('button', { name: /^Next: / }).click();
        const closed = page.locator('.deeper-buttons button[aria-expanded="false"]');
        while (await closed.count()) await closed.first().click();
        await audit(page, `novice (${scheme}), predicted, stepped, deeper open: ${t}`);
      }
    }
  });

  test('every Study Mode screen', async ({ page }) => {
    page.on('dialog', (d) => void d.accept());
    await page.goto('/#study');
    await audit(page, 'study: researcher');
    await page
      .getByLabel(/Load the ethics-approved consent file/)
      .setInputFiles(resolve(import.meta.dirname, 'fixtures/consent-filled.json'));
    await page.locator('#limit-intervention').fill('0.05');
    await page.getByLabel('Condition for the next participant').selectOption('C2');
    await page.getByRole('button', { name: 'Start a participant session' }).click();
    await audit(page, 'study: consent');
    for (const box of await page.getByRole('checkbox').all()) await box.check();
    await page.getByRole('button', { name: /I agree to all/ }).click();
    await audit(page, 'study: demographics');
    for (const n of ['year_of_study', 'prior_ml_course', 'programming_years', 'familiarity'])
      await page.locator(`input[name="${n}"]`).first().check();
    await page.getByRole('button', { name: 'Continue' }).click();
    await audit(page, 'study: test item');
    for (let k = 0; k < 20; k++) await page.getByRole('button', { name: 'Skip this question' }).click();
    await audit(page, 'study: intervention C2');
    await expect(page.getByText('Question 1 of 24.')).toBeVisible({ timeout: 20_000 });
    for (let k = 0; k < 24; k++) await page.getByRole('button', { name: 'Skip this question' }).click();
    await audit(page, 'study: questionnaires');
    for (let k = 0; k < 10; k++) await page.locator(`input[name="sus-${k}"]`).nth(2).check();
    // A rating left at the starting value still counts once the participant has touched the slider (keys here).
    for (const s of ['mental', 'physical', 'temporal', 'performance', 'effort', 'frustration']) {
      await page.locator(`#tlx-${s}`).focus();
      await page.keyboard.press('Home');
      await page.keyboard.press('End');
    }
    await page.getByRole('button', { name: 'Continue' }).click();
    await audit(page, 'study: feedback');
    await page.getByRole('button', { name: 'Finish' }).click();
    await audit(page, 'study: debrief');
  });
});

import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const consentFile = resolve(import.meta.dirname, 'fixtures/consent-filled.json');

async function setup(page: Page): Promise<void> {
  page.on('dialog', (d) => void d.accept());
  await page.goto('/#study');
  await expect(page.getByText(/still contains placeholders/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start a participant session' })).toBeDisabled();
  await page.getByLabel(/Load the ethics-approved consent file/).setInputFiles(consentFile);
  await expect(page.getByText(/still contains placeholders/)).toHaveCount(0);
  await page.locator('#limit-pre').fill('2');
  await page.locator('#limit-intervention').fill('0.2');
  await page.locator('#limit-post').fill('2');
}

async function consentAndDemographics(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Start a participant session' }).click();
  await expect(page.getByRole('heading', { name: 'Participant information sheet' })).toBeVisible();
  const agree = page.getByRole('button', { name: /I agree to all/ });
  await expect(agree).toBeDisabled();
  for (const box of await page.getByRole('checkbox').all()) await box.check();
  await agree.click();
  await page.locator('input[name="year_of_study"]').nth(1).check();
  await page.locator('input[name="prior_ml_course"]').nth(1).check();
  await page.locator('input[name="programming_years"]').nth(2).check();
  await page.locator('input[name="familiarity"]').nth(1).check();
  await page.getByRole('button', { name: 'Continue' }).click();
}

async function answerAll(page: Page, n: number): Promise<void> {
  for (let k = 1; k <= n; k++) {
    await expect(page.getByText(`Question ${k} of ${n}.`)).toBeVisible();
    if (k === 3) await page.getByRole('button', { name: 'Skip this question' }).click();
    else {
      await page
        .locator('.check.option')
        .nth(k % 4)
        .click();
      await page.getByRole('button', { name: 'Next' }).click();
    }
  }
}

async function runCondition(page: Page, c: 'C1' | 'C2' | 'C3'): Promise<void> {
  // C3 needs time to generate its first trace under parallel test load; the others only need to show their material.
  await page.locator('#limit-intervention').fill(c === 'C3' ? '0.5' : '0.1');
  await page.getByLabel('Condition for the next participant').selectOption(c);
  await consentAndDemographics(page);
  await answerAll(page, 20);
  await expect(page.getByRole('timer')).toBeVisible();
  if (c === 'C1') {
    await expect(page.getByRole('heading', { name: '1. A single neuron', exact: true })).toBeVisible();
    await expect(page.locator('.slide-images img').first()).toBeVisible();
  } else if (c === 'C2') {
    await expect(
      page.getByRole('link', { name: /Open this task in TensorFlow Playground/ }).first(),
    ).toHaveAttribute('href', /playground\.tensorflow\.org\/#.*dataset=gauss/);
  } else {
    await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
    await page.locator('section.network').click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await page.getByRole('radio', { name: 'Detailed' }).click();
  }
  // The intervention ends on its own when the time is up.
  await expect(page.getByText('Question 1 of 25.')).toBeVisible({ timeout: 45_000 });
  await answerAll(page, 25);
  if (c !== 'C1') {
    for (let k = 0; k < 10; k++)
      await page
        .locator(`input[name="sus-${k}"]`)
        .nth(k % 5)
        .check();
    for (const [k, s] of ['mental', 'physical', 'temporal', 'performance', 'effort', 'frustration'].entries())
      await page.locator(`#tlx-${s}`).fill(String(k * 15));
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await page
    .getByLabel('What helped you understand the material?')
    .fill(`Condition ${c}, with "quotes", commas`);
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText(/Your participant code:/)).toBeVisible();
  await page.getByRole('button', { name: 'Researcher: end this session' }).click();
}

test.describe('Study Mode (P8)', () => {
  test.setTimeout(240_000);

  test('runs the full protocol for all three conditions, a withdrawal and a refusal, and exports analysable CSVs', async ({
    page,
  }) => {
    await setup(page);
    for (const c of ['C1', 'C2', 'C3'] as const) await runCondition(page, c);

    // Withdrawal during the pre-test deletes the participant's data.
    await consentAndDemographics(page);
    await expect(page.getByText('Question 1 of 20.')).toBeVisible();
    await page.getByRole('button', { name: 'Withdraw from the study' }).click();
    await expect(page.getByText(/You have withdrawn/)).toBeVisible();
    await page.getByRole('button', { name: 'Researcher: end this session' }).click();

    // Declining consent.
    await page.getByRole('button', { name: 'Start a participant session' }).click();
    await page.getByRole('button', { name: 'I do not wish to take part' }).click();
    await page.getByRole('button', { name: 'Researcher: end this session' }).click();

    const flow = page.locator('.researcher table tbody tr td');
    await expect(flow.first()).toHaveText('5');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: /Export data/ }).click(),
    ]);
    const dir = mkdtempSync(resolve(tmpdir(), 'study-e2e-'));
    const zipPath = resolve(dir, download.suggestedFilename());
    await download.saveAs(zipPath);
    const summary = JSON.parse(
      execFileSync('python3', [
        '-c',
        `import sys, zipfile, io, json, pandas as pd
z = zipfile.ZipFile(sys.argv[1])
t = {n[:-4]: pd.read_csv(io.BytesIO(z.read(n))) for n in z.namelist()}
p = t['participants']
print(json.dumps({
  'files': sorted(t),
  'n': len(p), 'completed': int(p.completed.sum()), 'withdrawn': int(p.withdrawn.sum()), 'declined': int((p.consented == 0).sum()),
  'conditions': sorted(p[p.completed == 1].condition.tolist()),
  'responses': len(t['responses_long']), 'sus': len(t['sus']), 'tlx': len(t['tlx']),
  'telemetry': t['telemetry'].iloc[0][['steps_total', 'back_steps', 'explanation_opens']].astype(int).tolist() if len(t['telemetry']) else None,
  'feedback': t['feedback'].text.dropna().tolist(),
  'skipped': int(t['responses_long'].chosen.isna().sum()),
}))`,
        zipPath,
      ]).toString(),
    );
    expect(summary.files).toEqual([
      'feedback',
      'participants',
      'responses_long',
      'sus',
      'telemetry',
      'telemetry_events',
      'tlx',
    ]);
    expect(summary).toMatchObject({
      n: 5,
      completed: 3,
      withdrawn: 1,
      declined: 1,
      conditions: ['C1', 'C2', 'C3'],
      responses: 3 * 45,
      sus: 2,
      tlx: 2,
      skipped: 6,
    });
    expect(summary.telemetry[0]).toBeGreaterThanOrEqual(3);
    expect(summary.telemetry[1]).toBe(1);
    expect(summary.telemetry[2]).toBeGreaterThanOrEqual(1);
    expect(summary.feedback).toContain('Condition C3, with "quotes", commas');
  });
});

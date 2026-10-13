import { expect, test } from '@playwright/test';
import { unlockAll } from './helpers';

test('CNN experiment: trains in the worker, shows kernels, sliding window and feature maps from the trace', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await unlockAll(page);
  await page.goto('/');
  await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
  await page.getByRole('button', { name: /^8\. A CNN on handwritten digits/ }).click();
  await expect(page.getByText(/Instruction 0 \//)).toBeVisible({ timeout: 90_000 });
  // Generation time, frame rate and memory for this experiment are measured in perf-cnn.spec.ts.

  await page.getByRole('button', { name: 'Load a digit' }).click();
  await page.getByRole('button', { name: 'Next ▶' }).click();
  await page.getByRole('button', { name: 'Run the convolution' }).click();
  await expect(page.locator('.explanation .kind code')).toHaveText('CONV2D');
  await expect(page.locator('.conv .maps canvas')).toHaveCount(4);
  await expect(page.locator('.conv .kernels .kernel')).toHaveCount(4);
  // Place the window on a feature-map cell; the window computation must equal the trace value.
  const map = page.getByRole('button', { name: /^Channel 2:/ });
  const box = (await map.boundingBox())!;
  await map.click({ position: { x: box.width * 0.5, y: box.height * 0.5 } });
  const text = (await page.locator('.conv .computation').textContent()) ?? '';
  const m = /u = .* = (\S+?)(?:; z|\s).*\(trace: (\S+?)\)/.exec(text);
  expect(m, text).not.toBeNull();
  expect(Number(m![1].replace('−', '-'))).toBeCloseTo(Number(m![2].replace('−', '-')), 3);
  await expect(page.locator('.explanation .sentence')).toContainText('Kernel 2');
  // The same choice by keyboard: arrow keys move the window one cell.
  const before = /Window at \((\d+), (\d+)\)/.exec(
    (await page.locator('.conv .computation').textContent()) ?? '',
  )!;
  await map.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.conv .computation')).toContainText(
    `Window at (${before[1]}, ${Number(before[2]) + 1})`,
  );

  for (let k = 0; k < 3; k++) await page.getByRole('button', { name: 'Next ▶' }).click();
  await page.getByRole('button', { name: 'Run to the kernel gradient' }).click();
  await expect(page.locator('.explanation .kind code')).toHaveText('GRAD_CONV2D');
  const scrub = page.getByLabel('Position', { exact: true });
  await scrub.fill(String(await scrub.getAttribute('max')));
  await expect(page.getByText(/3 of 3 epochs complete/)).toBeVisible();
  await expect(page.locator('figure.chart', { hasText: 'Accuracy per epoch' })).toContainText(
    'held-out test',
  );
  expect(errors).toEqual([]);
});

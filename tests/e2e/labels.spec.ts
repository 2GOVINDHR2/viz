/**
 * Fix Round 6, B (ADR-082): experiment 1's diagram labels cannot collide at the longest value the formatter
 * produces. The diagram is on the guided path, whose formatter's longest output is "−more than a thousand trillion"
 * (a value of −10¹⁵ or below). That, and other long forms ("−123,457", "−0.00099"), are typed into all three
 * settings: no two labels on the diagram may overlap, nor run past its edge.
 */
import { expect, test, type Page } from '@playwright/test';
import { unlockAll } from './helpers';

async function labelProblems(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const svg = document.querySelector('svg.neuron-svg')!;
    const edge = svg.getBoundingClientRect();
    const texts = [...svg.querySelectorAll('text')].filter((t) => (t.textContent ?? '').trim() !== '');
    const boxes = texts.map((t) => t.getBoundingClientRect());
    const out: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      if (boxes[i].right > edge.right + 1 || boxes[i].left < edge.left - 1)
        out.push(`"${texts[i].textContent}" runs past the diagram's edge`);
      for (let j = i + 1; j < texts.length; j++) {
        const w = Math.min(boxes[i].right, boxes[j].right) - Math.max(boxes[i].left, boxes[j].left);
        const h = Math.min(boxes[i].bottom, boxes[j].bottom) - Math.max(boxes[i].top, boxes[j].top);
        if (w > 1 && h > 1) out.push(`"${texts[i].textContent}" overlaps "${texts[j].textContent}"`);
      }
    }
    return out;
  });
}

for (const [mode, value] of [
  ['novice', '-1e16'],
  ['novice', '-6.925'],
  ['novice', '-123456.789'],
  ['novice', '-0.000987654'],
] as const)
  test(`1, the diagram's labels at ${value} (${mode}): none overlap, none run off the diagram`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await unlockAll(page);
    await page.goto(`/?mode=${mode}`);
    await page.getByRole('button', { name: /^1\. / }).click();
    await expect(page.locator('[data-control="step"]').first()).toBeEnabled({ timeout: 60_000 });
    for (const k of [0, 1, 2]) {
      const f = page.locator(`[data-control="tryit:${k}"]`);
      if (!(await f.count())) continue;
      await f.fill(value);
      await f.press('Enter');
      await expect(page.locator('[data-control="step"]').first()).toBeEnabled({ timeout: 60_000 });
    }
    if (mode === 'novice') await page.getByRole('button', { name: 'Let it learn' }).click();
    await page.waitForTimeout(800);
    await expect(page.locator('svg.neuron-svg [data-label="w1-product"]')).toHaveCount(1);
    expect(await labelProblems(page)).toEqual([]);
  });

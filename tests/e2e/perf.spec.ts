/**
 * Browser performance measurements for docs/VALIDATION-REPORT.md: frame rate
 * while the app auto-runs at maximum speed, step latency, and JS heap.
 * Writes reports/perf-browser-<browser>.json.
 */
import { expect, test } from '@playwright/test';
import { openExperiment, unlockAll } from './helpers';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('frame rate and step latency during continuous stepping', async ({ page, browserName }) => {
  await unlockAll(page);
  await page.goto('/?mode=expert');
  await openExperiment(page, 'XOR needs a hidden layer');
  const generation = await page.evaluate(() => performance.now());
  const speed = page.getByLabel('Speed');
  await speed.fill(String(1000)); // fastest: one step every 20 ms
  const results: Record<string, unknown> = {
    browser: browserName,
    userAgent: await page.evaluate(() => navigator.userAgent),
    viewport: '1280x720',
  };

  for (const g of ['Operation', 'Layer', 'Example']) {
    await page.getByRole('radio', { name: g, exact: true }).click();
    const reset = page.getByRole('button', { name: /Reset/ });
    if (await reset.isEnabled()) await reset.click();
    await page.getByRole('button', { name: /Run/ }).click();
    const m = await page.evaluate(
      () =>
        new Promise<{ fps: number; worstFrameMs: number; stepsPerSecond: number }>((done) => {
          const read = (): number =>
            Number(
              /Instruction ([\d,]+)/
                .exec(document.querySelector('.position')?.textContent ?? '')?.[1]
                .replace(/,/g, '') ?? 0,
            );
          const start = performance.now();
          const startPos = read();
          let frames = 0;
          let last = start;
          let worst = 0;
          let changes = 0;
          let prev = startPos;
          const tick = (now: number): void => {
            frames++;
            worst = Math.max(worst, now - last);
            last = now;
            const p = read();
            if (p !== prev) changes++;
            prev = p;
            if (now - start < 3000) requestAnimationFrame(tick);
            else
              done({
                fps: (frames * 1000) / (now - start),
                worstFrameMs: worst,
                stepsPerSecond: (changes * 1000) / (now - start),
              });
          };
          requestAnimationFrame(tick);
        }),
    );
    await page.getByRole('button', { name: /Pause/ }).click();
    results[`run_${g.toLowerCase()}`] = m;
  }
  results.jsHeapMB = await page.evaluate(() => {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    return mem ? Math.round((mem.usedJSHeapSize / 1048576) * 10) / 10 : null;
  });
  results.timeToInteractiveMs = Math.round(generation);
  mkdirSync(resolve(import.meta.dirname, '../../reports'), { recursive: true });
  const name = test.info().project.name;
  writeFileSync(
    resolve(import.meta.dirname, `../../reports/perf-browser-${name}.json`),
    JSON.stringify(results, null, 2) + '\n',
  );
  expect((results.run_operation as { fps: number }).fps).toBeGreaterThan(30);
});

/**
 * Screenshots of every experiment's novice-path screen at several positions, for the cold-reviewer pass
 * (Fix Round 2b). The reviewer sees only these and docs/NOVICE-DESIGN.md.
 *
 * Usage: npm run build && npx tsx scripts/cold-review-shots.ts [port]
 * Writes docs/screenshots/cold-review/<number>-<id>-<k>.jpg and index.json (the step count at each shot).
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { EXPERIMENTS } from '../src/experiments/registry';

const port = Number(process.argv[2] ?? 4198);
const OUT = 'docs/screenshots/cold-review';
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
  stdio: 'ignore',
  detached: true,
});
const base = `http://localhost:${port}/`;
for (let k = 0; k < 100; k++) {
  try {
    if ((await fetch(base)).ok) break;
  } catch {
    // not up yet
  }
  await new Promise((r) => setTimeout(r, 200));
}

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await page.addInitScript(
  (completed) => {
    localStorage.setItem(
      'dl-vizlab.progress.v1',
      JSON.stringify({ completed, walkthrough: {}, answers: {} }),
    );
  },
  EXPERIMENTS.map((e) => e.id),
);
await page.goto(`${base}?mode=novice`);

const main = page.locator('main');
const settle = async (): Promise<void> => {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 120000 });
  await page.waitForTimeout(300);
};
const index: Record<string, { file: string; steps: number; note: string }[]> = {};

// Steps taken before each shot; back-propagation gets more, to reach the middle of the backward pass.
const PLAN: Record<string, number[]> = { backpropagation: [0, 1, 3, 6, 9, 14], default: [0, 1, 4, 12] };

for (const e of EXPERIMENTS) {
  await page.getByRole('button', { name: new RegExp(`^${e.number}\\. `) }).click();
  await page.waitForSelector('main [data-control="reset-experiment"]', { timeout: 120000 });
  await settle();
  index[e.id] = [];
  let steps = 0;
  let k = 0;
  for (const target of PLAN[e.id] ?? PLAN.default) {
    while (steps < target) {
      // A prediction asked before the step: commit to the first option, as a learner would have to.
      const opt = main.locator('[data-control="predict:option"]:enabled').first();
      if (await opt.count()) await opt.click();
      const step = main.locator('[data-control="step"]').first();
      if (!(await step.count()) || !(await step.isEnabled())) break;
      await step.click();
      await settle();
      steps++;
    }
    const file = `${e.number.toLowerCase()}-${e.id}-${k++}.jpg`;
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: true, type: 'jpeg', quality: 70 });
    index[e.id].push({
      file,
      steps,
      note: steps === 0 ? 'as opened' : `after ${steps} press(es) of the step button`,
    });
  }
}
writeFileSync(`${OUT}/index.json`, JSON.stringify(index, null, 2) + '\n');
await browser.close();
process.kill(-server.pid!);

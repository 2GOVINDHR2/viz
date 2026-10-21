/**
 * Generates the images for the C1 (static material) condition of Study Mode
 * from the running app. For every experiment and walkthrough step it performs
 * the step's "Show me" action and captures the main view, the explanation and
 * any experiment panel. The slide text is taken from the experiment
 * definitions at run time, so C1 and C3 present the same content and only the
 * medium differs (docs/STUDY-PROTOCOL.md §2).
 *
 * Usage: npm run build && npx tsx scripts/gen-slides.ts [port]
 * Writes public/study/slides/*.jpg and src/study/slides.json.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { EXPERIMENTS } from '../src/experiments/registry';

const port = Number(process.argv[2] ?? 4199);
const OUT = 'public/study/slides';
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
const ids = EXPERIMENTS.map((e) => e.id);
await page.addInitScript((completed) => {
  localStorage.setItem('dl-vizlab.progress.v1', JSON.stringify({ completed, walkthrough: {}, answers: {} }));
}, ids);
await page.goto(`${base}?mode=expert`); // C1 and the palette sheet capture the expert workbench
await page.getByText(/Instruction 0 \//).waitFor({ timeout: 60000 });

const settle = async (): Promise<void> => {
  await page.waitForFunction(
    () => !document.querySelector('[aria-busy="true"], section.walkthrough button.primary-sm[disabled]'),
    null,
    { timeout: 120000 },
  );
  await page.waitForTimeout(500);
};
const shot = async (sel: string, name: string): Promise<string | null> => {
  const el = page.locator(sel).first();
  if (!(await el.count())) return null;
  await el.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 70 });
  return `study/slides/${name}.jpg`;
};

const manifest: Record<string, { images: { src: string; alt: string }[] }[]> = {};
for (const e of EXPERIMENTS) {
  await page.getByRole('button', { name: new RegExp(`^${e.number}\\. `) }).click();
  await page.getByText(/Instruction 0 \//).waitFor({ timeout: 120000 });
  await settle();
  manifest[e.id] = [];
  for (let k = 0; k < e.walkthrough.length; k++) {
    const walk = page.locator('section.walkthrough');
    if (e.walkthrough[k].action) {
      // A "Show me" action must change what the slide shows: a pixel-identical screen before and after means
      // the slide would claim a state it does not show (the D2 "watch the path" slide, ADR-054), so fail.
      const before = await page.locator('main').screenshot({ type: 'png', animations: 'disabled' });
      await walk.locator('button.primary-sm').click();
      await settle();
      const after = await page.locator('main').screenshot({ type: 'png', animations: 'disabled' });
      if (before.equals(after))
        throw new Error(`${e.id} step ${k + 1}: the "Show me" action changed nothing on screen`);
    }
    const tag = `${e.id}-${k + 1}`;
    const images = [
      {
        src: await shot('main .center section.network', `${tag}-view`),
        alt: `${e.title}, step ${k + 1}: main view`,
      },
      {
        src: await shot('section.explanation', `${tag}-explanation`),
        alt: `${e.title}, step ${k + 1}: explanation`,
      },
      {
        src: e.panels.length ? await shot('section.panels', `${tag}-panels`) : null,
        alt: `${e.title}, step ${k + 1}: panels`,
      },
    ].filter((x): x is { src: string; alt: string } => x.src !== null);
    manifest[e.id].push({ images });
    if (k + 1 < e.walkthrough.length) await walk.getByRole('button', { name: 'Next ▶' }).click();
  }
  console.log(`${e.id}: ${e.walkthrough.length} slides`);
}
await browser.close();
process.kill(-server.pid!);
writeFileSync('src/study/slides.json', JSON.stringify(manifest, null, 2) + '\n');

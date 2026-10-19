/**
 * Palette review sheet (Fix Round 1 Supplement, S4.4). Renders every
 * experiment's screen in the light and dark themes, in the forward and the
 * backward phase, and shows each capture as normal vision and as simulated
 * protanopia and deuteranopia. The simulation uses the same Machado, Oliveira &
 * Fernandes (2009) matrices at severity 1.0 in linear RGB as
 * tests/unit/cvd.test.ts, applied per pixel. The point is a human look at the
 * result; the measured margins are in reports/cvd.json.
 *
 * Usage: npm run build && npx tsx scripts/gen-palette-sheet.ts [port]
 * Writes figures/palette-sheet.pdf.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import { EXPERIMENTS } from '../src/experiments/registry';

const port = Number(process.argv[2] ?? 4198);
const OUT = 'figures/palette-sheet.pdf';
mkdirSync('figures', { recursive: true });

const MACHADO = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
};

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

const settle = async (page: Page): Promise<void> => {
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 120000 });
  await page.waitForTimeout(400);
};

type Shot = { experiment: string; theme: 'light' | 'dark'; phase: 'forward' | 'backward'; png: string };
const shots: Shot[] = [];
for (const theme of ['light', 'dark'] as const) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
    colorScheme: theme,
  });
  await page.addInitScript(
    (completed) =>
      localStorage.setItem(
        'dl-vizlab.progress.v1',
        JSON.stringify({ completed, walkthrough: {}, answers: {} }),
      ),
    EXPERIMENTS.map((e) => e.id),
  );
  await page.goto(`${base}?mode=expert`); // C1 and the palette sheet capture the expert workbench
  await page.getByText(/Instruction 0 \//).waitFor({ timeout: 60000 });
  const bp = page.getByLabel('back-propagation starts (each example)');
  for (const e of EXPERIMENTS) {
    await page.getByRole('button', { name: new RegExp(`^${e.number}\\. `) }).click();
    await page.getByText(/Instruction 0 \//).waitFor({ timeout: 120000 });
    await settle(page);
    const shoot = async (phase: Shot['phase']) =>
      shots.push({
        experiment: `${e.number}. ${e.title}`,
        theme,
        phase,
        png: (await page.locator('main .center').screenshot({ type: 'png' })).toString('base64'),
      });
    // From halfway through training (so the charts carry their series), run to
    // the next start of back-propagation: one layer back is the end of the
    // forward pass, one layer on is inside the backward pass.
    await page.getByRole('slider', { name: 'Position' }).evaluate((el: HTMLInputElement) => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      set.call(el, String(Math.floor(Number(el.max) / 2)));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await settle(page);
    await page.getByRole('radio', { name: 'Layer', exact: true }).click();
    if (!(await bp.isChecked())) await bp.check();
    await page.getByTitle('Run until a breakpoint is hit').click();
    await settle(page);
    await page.getByTitle('Step back (←)').click();
    await settle(page);
    await shoot('forward');
    await page.getByTitle('Step forward (→)').click();
    await page.getByTitle('Step forward (→)').click();
    await settle(page);
    await shoot('backward');
    await bp.uncheck();
    console.log(`${theme} ${e.id}`);
  }
  await page.close();
}

const sheet = await browser.newPage();
await sheet.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A3 landscape; margin: 10mm; }
  body { margin: 0; font: 11pt system-ui, sans-serif; color: #111; background: #fff; }
  section { page-break-after: always; }
  h1 { font-size: 16pt; margin: 0 0 4mm; }
  h2 { font-size: 13pt; margin: 0 0 3mm; }
  .row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4mm; }
  figure { margin: 0; }
  figcaption { font-size: 9pt; margin-bottom: 1mm; color: #333; }
  img { width: 100%; max-height: 255mm; object-fit: contain; object-position: top left; border: 1px solid #999; display: block; }
  p { max-width: 60em; }
</style></head><body>
<section>
  <h1>DL-VizLab palette review sheet</h1>
  <p>Every experiment's central views (network or structure view, explanation, charts and panels) in the light and dark themes,
  captured from the first example after the halfway point of the run (so the loss and gradient charts carry their series): once at the
  last layer of its forward pass and once one layer into its backward pass. Tall screens are split across pages. Each capture is shown as rendered, and with protanopia and deuteranopia simulated by the
  Machado, Oliveira &amp; Fernandes (2009) matrices at severity 1.0 in linear RGB — the same simulation as <code>tests/unit/cvd.test.ts</code>.</p>
  <p>The measured margins (ΔE in OKLab × 100 ≥ 15 for every meaning-carrying pair) are in <code>reports/cvd.json</code>. This sheet is for a
  person to judge legibility: whether the forward (blue) and backward (wine; coral in dark mode) phases, the loss-curve series and the signed
  weight colours are easy to tell apart, and whether any text on a coloured background is hard to read.</p>
  <p>Generated by <code>scripts/gen-palette-sheet.ts</code> from the built app; regenerate after any palette change.</p>
</section>
</body></html>`);
// tsx's esbuild transform wraps named functions in __name(); define it in the page.
await sheet.evaluate('window.__name = (f) => f');
await sheet.evaluate(
  async ({ shots, M }) => {
    const lin = new Float32Array(256).map((_, i) => {
      const c = i / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const enc = (v: number) => {
      const c = Math.min(1, Math.max(0, v));
      return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055));
    };
    // Tall captures are cut into slices of at most twice their width, one page each.
    const toJpeg = async (png: string, m: number[] | null, slice: number) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      const w = img.width;
      const h = Math.min(2 * w, img.height - slice * 2 * w);
      const cv = document.createElement('canvas');
      [cv.width, cv.height] = [w, h];
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, -slice * 2 * w);
      if (m) {
        const d = ctx.getImageData(0, 0, w, h);
        const p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const [r, g, b] = [lin[p[i]], lin[p[i + 1]], lin[p[i + 2]]];
          p[i] = enc(m[0] * r + m[1] * g + m[2] * b);
          p[i + 1] = enc(m[3] * r + m[4] * g + m[5] * b);
          p[i + 2] = enc(m[6] * r + m[7] * g + m[8] * b);
        }
        ctx.putImageData(d, 0, 0);
      }
      return cv.toDataURL('image/jpeg', 0.5);
    };
    for (const s of shots) {
      const probe = new Image();
      probe.src = `data:image/png;base64,${s.png}`;
      await probe.decode();
      const slices = Math.ceil(probe.height / (2 * probe.width));
      for (let k = 0; k < slices; k++) {
        const sec = document.createElement('section');
        const part = slices > 1 ? ` (part ${k + 1} of ${slices})` : '';
        sec.innerHTML = `<h2>${s.experiment} — ${s.theme} theme, ${s.phase} phase${part}</h2><div class="row"></div>`;
        const row = sec.querySelector('.row')!;
        for (const [label, m] of [
          ['As rendered', null],
          ['Simulated protanopia', M.protan],
          ['Simulated deuteranopia', M.deutan],
        ] as const) {
          const f = document.createElement('figure');
          f.innerHTML = `<figcaption>${label}</figcaption><img alt="${s.experiment}, ${s.theme}, ${s.phase}, ${label}" src="${await toJpeg(s.png, m as number[] | null, k)}">`;
          row.append(f);
        }
        document.body.append(sec);
      }
    }
  },
  { shots, M: MACHADO },
);
await sheet.pdf({ path: OUT, format: 'A3', landscape: true, printBackground: true });
await browser.close();
process.kill(-server.pid!);
console.log(`${OUT}: ${shots.length} captures × 3 versions, ${(statSync(OUT).size / 1e6).toFixed(1)} MB`);

/**
 * Palette summary (Fix Round 2, 7.1): the two-page, humanly reviewable
 * companion to figures/palette-sheet.pdf. Page 1: every meaning-carrying
 * colour as a labelled swatch in both themes, and every checked pair with its
 * measured ΔE (reports/cvd.json). Page 2: one representative capture per view
 * in light and dark, each as rendered and with deuteranopia simulated by the
 * same Machado et al. (2009) matrix as tests/unit/cvd.test.ts.
 *
 * Usage: npm run build && npx tsx scripts/gen-palette-summary.ts [port]
 * Writes figures/palette-summary.pdf.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, statSync } from 'node:fs';
import { chromium, type Page } from '@playwright/test';
import { EXPERIMENTS } from '../src/experiments/registry';

const port = Number(process.argv[2] ?? 4197);
const OUT = 'figures/palette-summary.pdf';
mkdirSync('figures', { recursive: true });
const DEUTAN = [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881];

// Meaning-carrying tokens, read from the stylesheet so the summary cannot drift from it.
const css = readFileSync('src/ui/styles.css', 'utf8');
const block = (start: string): string => css.slice(css.indexOf(start), css.indexOf('}', css.indexOf(start)));
const LIGHT = block(':root {');
const DARK = block(":root[data-theme='dark'] {");
const TOKENS: [string, string][] = [
  ['--fwd', 'forward mode'],
  ['--bwd', 'backward mode'],
  ['--upd', 'update mode'],
  ['--pos', 'positive weight / value'],
  ['--neg', 'negative weight / value'],
  ['--series-1', 'chart series 1'],
  ['--series-2', 'chart series 2'],
  ['--series-3', 'chart series 3'],
  ['--focus', 'focus and illumination'],
  ['--accent', 'controls'],
];
const tokenValue = (b: string, t: string): string | null =>
  new RegExp(`${t}:\\s*(#[0-9a-fA-F]{6})`).exec(b)?.[1] ?? null;
const pairs = JSON.parse(readFileSync('reports/cvd.json', 'utf8')) as {
  name: string;
  a: string;
  b: string;
  min: number;
  normal: number;
  protan: number;
  deutan: number;
}[];

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

type View = {
  name: string;
  mode: 'expert' | 'novice';
  experiment: string;
  selector: string;
  at: 'mid' | 'end';
};
const VIEWS: View[] = [
  {
    name: 'Network view (backward pass)',
    mode: 'expert',
    experiment: 'xor-mlp',
    selector: 'main .center section.network',
    at: 'mid',
  },
  { name: 'Structure view', mode: 'expert', experiment: 'xor-mlp', selector: 'section.structure', at: 'mid' },
  { name: 'Training view', mode: 'expert', experiment: 'xor-mlp', selector: 'section.training', at: 'end' },
  {
    name: 'Experiment panel (loss surface)',
    mode: 'expert',
    experiment: 'gradient-descent',
    selector: 'section.panels',
    at: 'end',
  },
  {
    name: 'CNN view (backward pass)',
    mode: 'expert',
    experiment: 'cnn-mnist',
    selector: 'section.conv',
    at: 'mid',
  },
  {
    name: 'Novice screen (back-propagation)',
    mode: 'novice',
    experiment: 'backpropagation',
    selector: 'article.novice .novice-grid',
    at: 'mid',
  },
];
const shots: Record<string, Record<'light' | 'dark', string>> = {};
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
  for (const v of VIEWS) {
    const e = EXPERIMENTS.find((x) => x.id === v.experiment)!;
    await page.goto(`${base}?mode=${v.mode}`);
    await page.getByRole('button', { name: new RegExp(`^${e.number}\\. `) }).click();
    await settle(page);
    if (v.mode === 'expert') {
      await page.getByText(/Instruction 0 \//).waitFor({ timeout: 120000 });
      await page.getByRole('slider', { name: 'Position' }).evaluate((el: HTMLInputElement, at) => {
        const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        set.call(el, String(at === 'end' ? Number(el.max) : Math.floor(Number(el.max) / 2)));
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, v.at);
      await settle(page);
      if (v.at === 'mid') {
        const bp = page.getByLabel('back-propagation starts (each example)');
        if (!(await bp.isChecked())) await bp.check();
        await page.getByTitle('Run until a breakpoint is hit').click();
        await settle(page);
        await page.getByRole('radio', { name: 'Layer', exact: true }).click();
        await page.getByTitle('Step forward (→)').click();
        await settle(page);
      }
    } else {
      // Into the first example's backward pass, with the chain rule partly filled in.
      await page.getByRole('button', { name: /^Next: / }).waitFor();
      for (let k = 0; k < 4; k++) await page.getByRole('button', { name: /^Next: / }).click();
      await page.locator('.stepbar').getByRole('radio', { name: 'one layer' }).click();
      await page.getByRole('button', { name: /^Next: / }).click();
      await settle(page);
    }
    (shots[v.name] ??= { light: '', dark: '' })[theme] = (
      await page.locator(v.selector).first().screenshot({ type: 'png' })
    ).toString('base64');
    console.log(`${theme}: ${v.name}`);
  }
  await page.close();
}

const swatchRows = TOKENS.map(([t, label]) => {
  const l = tokenValue(LIGHT, t);
  const d = tokenValue(DARK, t) ?? l;
  const sw = (c: string | null) =>
    c ? `<span class="sw" style="background:${c}"></span><code>${c}</code>` : '—';
  return `<tr><td><code>${t}</code></td><td>${label}</td><td>${sw(l)}</td><td>${sw(d)}</td></tr>`;
}).join('');
const pairRows = pairs
  .map(
    (p) =>
      `<tr><td>${p.name}</td><td><span class="sw" style="background:${p.a}"></span><span class="sw" style="background:${p.b}"></span></td><td>${p.normal}</td><td>${p.protan}</td><td>${p.deutan}</td><td>${Math.min(p.normal, p.protan, p.deutan) >= p.min ? '✓' : '✗'}</td></tr>`,
  )
  .join('');

const sheet = await browser.newPage();
await sheet.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
  @page { size: A3 landscape; margin: 10mm; }
  body { margin: 0; font: 10pt system-ui, sans-serif; color: #111; background: #fff; }
  section { page-break-after: always; }
  h1 { font-size: 16pt; margin: 0 0 3mm; } h2 { font-size: 12pt; margin: 4mm 0 2mm; }
  .cols { display: grid; grid-template-columns: 1fr 1.25fr; gap: 10mm; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border-bottom: 1px solid #ccc; padding: 1.2mm 2mm; text-align: left; vertical-align: middle; }
  .sw { display: inline-block; width: 9mm; height: 6mm; border: 1px solid #555; vertical-align: middle; margin-right: 2mm; }
  .grid { display: grid; grid-template-columns: 34mm repeat(4, 1fr); gap: 2mm 3mm; align-items: start; }
  .grid .h { font-weight: 600; } .grid img { width: 100%; max-height: 40mm; object-fit: contain; object-position: top left; border: 1px solid #999; }
  p { margin: 1mm 0 3mm; max-width: 75em; }
</style></head><body>
<section>
  <h1>DL-VizLab palette summary</h1>
  <p>Every colour that carries meaning, in both themes, and every pair that must stay distinguishable, with its measured distance (ΔE in OKLab × 100; target ≥ 15 under normal vision, protanopia and deuteranopia, from <code>reports/cvd.json</code>). Page 2 shows one representative capture per view. The exhaustive set — every experiment, both phases, protanopia too — is <code>figures/palette-sheet.pdf</code>.</p>
  <div class="cols">
    <div><h2>Colours</h2><table><tr><th>Token</th><th>Meaning</th><th>Light</th><th>Dark</th></tr>${swatchRows}</table></div>
    <div><h2>Pairs</h2><table><tr><th>Pair</th><th></th><th>normal</th><th>protan</th><th>deutan</th><th>≥ 15</th></tr>${pairRows}</table></div>
  </div>
  <p>Every pair also has a non-colour cue (dash pattern, label, icon or border pattern). Generated by <code>scripts/gen-palette-summary.ts</code>; regenerate after any palette change.</p>
</section>
<section>
  <h1>One capture per view</h1>
  <p>Deuteranopia simulated with the Machado, Oliveira &amp; Fernandes (2009) matrix at severity 1.0 in linear RGB.</p>
  <div class="grid" id="grid"><div></div><div class="h">Light, as rendered</div><div class="h">Light, deuteranopia</div><div class="h">Dark, as rendered</div><div class="h">Dark, deuteranopia</div></div>
</section></body></html>`);
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
    const toJpeg = async (png: string, sim: boolean) => {
      const img = new Image();
      img.src = `data:image/png;base64,${png}`;
      await img.decode();
      // A representative top slice, at most twice as tall as it is wide.
      const w = img.width;
      const h = Math.min(img.height, Math.round(w * 0.75));
      const cv = document.createElement('canvas');
      [cv.width, cv.height] = [w, h];
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      if (sim) {
        const d = ctx.getImageData(0, 0, w, h);
        const p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          const [r, g, b] = [lin[p[i]], lin[p[i + 1]], lin[p[i + 2]]];
          p[i] = enc(M[0] * r + M[1] * g + M[2] * b);
          p[i + 1] = enc(M[3] * r + M[4] * g + M[5] * b);
          p[i + 2] = enc(M[6] * r + M[7] * g + M[8] * b);
        }
        ctx.putImageData(d, 0, 0);
      }
      return cv.toDataURL('image/jpeg', 0.75);
    };
    const grid = document.getElementById('grid')!;
    for (const [name, t] of Object.entries(shots)) {
      const label = document.createElement('div');
      label.className = 'h';
      label.textContent = name;
      grid.append(label);
      for (const [theme, sim] of [
        ['light', false],
        ['light', true],
        ['dark', false],
        ['dark', true],
      ] as const) {
        const img = document.createElement('img');
        img.alt = `${name}, ${theme}${sim ? ', deuteranopia simulated' : ''}`;
        img.src = await toJpeg(t[theme], sim);
        grid.append(img);
      }
    }
  },
  { shots, M: DEUTAN },
);
await sheet.pdf({ path: OUT, format: 'A3', landscape: true, printBackground: true });
await browser.close();
process.kill(-server.pid!);
console.log(`${OUT}: ${(statSync(OUT).size / 1e6).toFixed(1)} MB`);

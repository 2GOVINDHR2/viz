/**
 * Batch figure export: the standard figure set from any trace.
 *
 *   npx tsx --tsconfig tsconfig.tsx.json scripts/export-figures.ts <trace.json | --experiment ID> <out-dir>
 *       [--mode colour|greyscale|highContrast|all] [--captions captions.json]
 *
 * Writes <id>.svg, <id>.pdf (vector, fonts embedded by Chromium's PDF
 * printer) and <id>.csv (the numbers drawn) for every applicable figure.
 * captions.json maps figure ids to replacement captions.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerAsset, resolveDataset } from '../src/core/engine/host';
import { deserializeTrace, memorySource, storeSource, TraceStore, type TraceSource } from '../src/core/npm';
import { loadMnist } from '../src/experiments/data/mnist';
import { experimentById } from '../src/experiments/registry';
import { figureSet, type Figure, type FigureOptions } from '../src/export/figures';
import { PRINT_MODES, type PrintMode } from '../src/export/ink';

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const k = args.indexOf(name);
  return k >= 0 ? args.splice(k, 2)[1] : undefined;
};
const experiment = flag('--experiment');
const modeArg = flag('--mode') ?? 'colour';
const captions = flag('--captions');
const [input, outArg] = experiment ? [null, args[0]] : args;
if (!outArg || (!experiment && !input)) {
  console.error(
    'usage: export-figures.ts <trace.json | --experiment ID> <out-dir> [--mode …] [--captions file]',
  );
  process.exit(2);
}

registerAsset('mnist-012', loadMnist);
let src: TraceSource;
if (experiment) {
  const e = experimentById(experiment);
  src = storeSource(TraceStore.generate(e.config, resolveDataset(e.dataset)).store);
} else src = memorySource(deserializeTrace(readFileSync(input!, 'utf8')));

const modes: PrintMode[] = modeArg === 'all' ? PRINT_MODES.map((m) => m.id) : [modeArg as PrintMode];
const out = resolve(outArg);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await browser.newPage();
async function pdf(f: Figure, path: string): Promise<void> {
  const [, w, h] = f.svg.match(/width="([\d.]+)" height="([\d.]+)"/)!.map(Number);
  await page.setContent(`<html><body style="margin:0">${f.svg}</body></html>`);
  await page.pdf({ path, width: `${w}px`, height: `${h}px`, printBackground: true, pageRanges: '1' });
}

for (const mode of modes) {
  const o: FigureOptions = {
    mode,
    captions: captions ? JSON.parse(readFileSync(captions, 'utf8')) : undefined,
  };
  const suffix = modes.length > 1 ? `-${mode}` : '';
  for (const f of figureSet(src, o)) {
    writeFileSync(resolve(out, `${f.id}${suffix}.svg`), f.svg + '\n');
    writeFileSync(resolve(out, `${f.id}.csv`), f.csv);
    await pdf(f, resolve(out, `${f.id}${suffix}.pdf`));
    console.log(`${f.id}${suffix}`);
  }
}
await browser.close();

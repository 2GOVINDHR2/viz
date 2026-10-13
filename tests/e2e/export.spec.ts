import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

test('figure export: the standard set at the cursor as SVG, CSV and a ZIP, in every print mode', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText(/Instruction 0 \//)).toBeVisible();
  await page.getByLabel('Position', { exact: true }).fill('60');
  await page.locator('details.export summary').click();
  // At a cursor the set has one network snapshot (the state shown), plus the charts of the epochs completed so far.
  await expect(page.locator('.export-fig')).toHaveCount(5);
  const dir = mkdtempSync(resolve(tmpdir(), 'fig-e2e-'));

  const [svg] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Network architecture: download SVG' }).click(),
  ]);
  const svgPath = resolve(dir, svg.suggestedFilename());
  await svg.saveAs(svgPath);
  expect(readFileSync(svgPath, 'utf8')).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg"/);

  // Greyscale, then the whole set as one ZIP.
  await page.getByRole('radio', { name: 'Greyscale' }).click();
  await expect(page.getByRole('button', { name: 'Preparing…' })).toHaveCount(0);
  const cap = page.getByLabel('Caption').first();
  await cap.fill('Figure 1. Custom caption.');
  await cap.blur();
  await expect(page.getByRole('button', { name: 'Preparing…' })).toHaveCount(0);
  const [z] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'All figures (.zip)' }).click(),
  ]);
  const zipPath = resolve(dir, z.suggestedFilename());
  await z.saveAs(zipPath);
  const listing = JSON.parse(
    execFileSync('python3', [
      '-c',
      'import sys,zipfile,json,re; z=zipfile.ZipFile(sys.argv[1]); svgs=[n for n in z.namelist() if n.endswith(".svg")]; hue=[n for n in svgs if any(len(set((c[0:2],c[2:4],c[4:6])))>1 for c in re.findall(r"#([0-9a-fA-F]{6})\\b", z.read(n).decode()))]; print(json.dumps({"names": sorted(z.namelist()), "hue": hue, "caption": any(b"Figure 1. Custom caption." in z.read(n) for n in svgs)}))',
      zipPath,
    ]).toString(),
  );
  expect(listing.names.filter((n: string) => n.endsWith('.csv')).length).toBe(
    listing.names.filter((n: string) => n.endsWith('.svg')).length,
  );
  expect(listing.names).toContain('dlvizlab-single-neuron-architecture-greyscale.svg');
  expect(listing.hue).toEqual([]);
  expect(listing.caption).toBe(true);

  // PDF opens a figure-only page for the browser's print-to-PDF.
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: /Network architecture: save as PDF/ }).click(),
  ]);
  await expect(popup.locator('svg title')).toHaveText('Network architecture');
});

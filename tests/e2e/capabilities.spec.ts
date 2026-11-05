/**
 * The capability inventory (Fix Round 5, Part 0; ADR-068).
 *
 * Every screen (experiment × mode), in two states (as opened, and part-way through the run), with every
 * disclosure open, is read for what a learner can see and do:
 *  - **panel:** each labelled region (`section[aria-label]`);
 *  - **control:** each declared control, by its `data-control` id and accessible name;
 *  - **disclosure:** each `<details>` summary and each "Going deeper" item;
 *  - **information:** each heading, figure caption, table caption and legend.
 * Numbers are replaced by "#" so a capability is the same capability whatever values the run holds.
 *
 * With CAPTURE=1 the result is written as the baseline: reports/capability-inventory.json and
 * docs/CAPABILITY-INVENTORY.md. Without it, the test fails if any baseline capability is missing, unless it is
 * listed in reports/capability-removed.json with the ADR that removed it. A feature that disappears silently
 * therefore fails a test (Part 0.4).
 */
import { expect, test, type Page } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXPERIMENTS } from '../../src/experiments/registry';
import { unlockAll } from './helpers';

type Kind = 'panel' | 'control' | 'disclosure' | 'information';
export interface Capability {
  screen: string;
  kind: Kind;
  text: string;
}

const ROOT = resolve(import.meta.dirname, '../..');
const BASELINE = resolve(ROOT, 'reports/capability-inventory.json');
const REMOVED = resolve(ROOT, 'reports/capability-removed.json');

async function openAll(page: Page): Promise<void> {
  const closed = page.locator('.deeper-buttons button[aria-expanded="false"]');
  for (let k = 0; k < 12 && (await closed.count()); k++) await closed.first().click();
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => d.setAttribute('open', '')));
  await page.waitForTimeout(300);
}

async function read(page: Page): Promise<{ kind: Kind; text: string }[]> {
  return page.evaluate(() => {
    const norm = (s: string | null | undefined): string =>
      (s ?? '')
        .replace(/[−-]?\d[\d,]*(\.\d+)?(×10[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)?(e[-+]?\d+)?/g, '#')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
    const out: { kind: 'panel' | 'control' | 'disclosure' | 'information'; text: string }[] = [];
    const main = document.querySelector('main') ?? document.body;
    for (const s of main.querySelectorAll('section[aria-label]'))
      out.push({ kind: 'panel', text: norm(s.getAttribute('aria-label')) });
    for (const e of main.querySelectorAll('[data-control]')) {
      const id = e.getAttribute('data-control')!;
      const el = e as HTMLElement;
      const label =
        e.getAttribute('aria-label') ??
        (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent : null) ??
        e.closest('label')?.textContent ??
        e.textContent;
      const kind = (e.getAttribute('type') ?? e.tagName).toLowerCase();
      out.push({ kind: 'control', text: `${id} (${kind}): ${norm(label)}` });
    }
    for (const s of main.querySelectorAll('details > summary'))
      out.push({ kind: 'disclosure', text: norm(s.textContent) });
    for (const b of main.querySelectorAll('.deeper-buttons button'))
      out.push({ kind: 'disclosure', text: `going deeper: ${norm(b.textContent).replace(/^[▸▾⧉] ?/, '')}` });
    for (const h of main.querySelectorAll('h2, h3, h4, figcaption, caption, .legend, legend'))
      out.push({ kind: 'information', text: `${h.tagName.toLowerCase()}: ${norm(h.textContent)}` });
    return out;
  });
}

async function screen(
  page: Page,
  mode: 'novice' | 'expert',
  id: string,
  number: string,
): Promise<Capability[]> {
  await page.getByRole('button', { name: new RegExp(`^${number}\\. `) }).click();
  await expect(
    page.locator(`.position[data-cursor="-1"], article.novice[data-screen="${id}"]`).first(),
  ).toBeVisible({ timeout: 120_000 });
  await page.waitForTimeout(600);
  const name = `${id} (${mode})`;
  const caps: Capability[] = [];
  await openAll(page);
  for (const c of await read(page)) caps.push({ screen: name, ...c });
  // Part-way through the run: the workbench's position slider, or the guided screen's Next button.
  const scrub = page.getByLabel('Position', { exact: true });
  if (await scrub.count()) {
    const max = Number(await scrub.getAttribute('max'));
    await scrub.fill(String(Math.floor(max / 2)));
  } else {
    const next = page.getByRole('button', { name: /^Next: / });
    for (let k = 0; k < 4 && (await next.count()) && (await next.isEnabled()); k++) await next.click();
  }
  await page.waitForTimeout(500);
  await openAll(page);
  for (const c of await read(page)) caps.push({ screen: name, ...c });
  return caps;
}

const key = (c: Capability): string => `${c.screen}|${c.kind}|${c.text}`;

test('capability inventory: nothing in the baseline disappears without an ADR', async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await unlockAll(page);
  const all: Capability[] = [];
  for (const mode of ['novice', 'expert'] as const) {
    await page.goto(`/?mode=${mode}`);
    for (const e of EXPERIMENTS) all.push(...(await screen(page, mode, e.id, e.number)));
  }
  const unique = [...new Map(all.map((c) => [key(c), c])).values()].sort((a, b) =>
    key(a).localeCompare(key(b)),
  );

  if (process.env.CAPTURE === '1') {
    writeFileSync(BASELINE, JSON.stringify(unique, null, 2) + '\n');
    writeFileSync(resolve(ROOT, 'docs/CAPABILITY-INVENTORY.md'), markdown(unique));
    return;
  }
  const baseline: Capability[] = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const removed: { key: string; adr: string }[] = existsSync(REMOVED)
    ? JSON.parse(readFileSync(REMOVED, 'utf8'))
    : [];
  const allowed = new Set(removed.map((r) => r.key));
  const now = new Set(unique.map(key));
  const lost = baseline.map(key).filter((k) => !now.has(k) && !allowed.has(k));
  writeFileSync(resolve(ROOT, '.tmp/capabilities-now.json'), JSON.stringify(unique, null, 2) + '\n');
  expect(lost).toEqual([]);
});

function markdown(caps: Capability[]): string {
  const screens = [...new Set(caps.map((c) => c.screen))];
  const out: string[] = [
    '# Capability Inventory',
    '',
    '**What this is (Fix Round 5, Part 0).** Every capability of every screen, read from the running build by `tests/e2e/capabilities.spec.ts`:',
    '- every experiment, in both modes;',
    '- in two states, as opened and part-way through the run;',
    '- with every disclosure section open.',
    '',
    'Numbers are shown as `#`, so an entry means the same capability whatever values the run holds.',
    '',
    '**It is generated, not written by hand.** Regenerate it with `CAPTURE=1 npx playwright test tests/e2e/capabilities.spec.ts`, which also writes the JSON baseline (`reports/capability-inventory.json`).',
    '',
    '**How it protects the baseline.** Without `CAPTURE`, the same test fails if any baseline capability is missing from the current build, unless `reports/capability-removed.json` lists it with the ADR that removed it. A capability can be removed deliberately; it cannot disappear silently.',
    '',
    `**Totals:** ${caps.length} capabilities over ${screens.length} screens.`,
    '',
    '**What it does not cover.** States that appear only after a particular interaction (a revealed prediction, a pinned comparison) are not captured here. They are covered by the e2e tests named in PROGRESS, Fix Round 5.',
    '',
  ];
  const KIND: Record<Kind, string> = {
    panel: 'Panels',
    control: 'Controls (data-control id, element, accessible name)',
    disclosure: 'Disclosure sections',
    information: 'Information shown (headings, captions, legends)',
  };
  for (const s of screens) {
    out.push(`## ${s}`, '');
    for (const k of ['panel', 'control', 'disclosure', 'information'] as Kind[]) {
      const rows = caps.filter((c) => c.screen === s && c.kind === k);
      if (!rows.length) continue;
      out.push(`**${KIND[k]}** (${rows.length})`, '');
      for (const r of rows) out.push(`- ${r.text.replace(/\|/g, '/')}`);
      out.push('');
    }
  }
  return out.join('\n');
}

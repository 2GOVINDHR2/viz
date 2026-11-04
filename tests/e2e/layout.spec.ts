/**
 * Invariant I (Fix Round 4, A3): at 1280×720, no element's box extends beyond its parent's box, on every screen in
 * both modes, with every disclosure section open.
 *
 * - "Parent" is the nearest ancestor that has a box of its own (`display: contents` wrappers have none).
 * - Not violations (each is not visible overflow):
 *   - content of a closed <details> (Chromium lays it out without showing it);
 *   - an element inside an ancestor that clips or scrolls (overflow other than visible), where the overflow is
 *     contained by design;
 *   - screen-reader-only text;
 *   - the shapes inside an SVG (the SVG element itself is checked).
 * - Tolerance: 1 px, for subpixel rounding.
 *
 * Every violation is written to reports/layout.json. The test fails on any violation in experiment 1 or in a shared
 * component, and on any violation elsewhere that is not listed in tests/e2e/layout-deferred.json (Fix Round 4 defers
 * experiments 2–10 to the next round; KNOWN-GAPS records them).
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXPERIMENTS } from '../../src/experiments/registry';
import { unlockAll } from './helpers';

export interface Violation {
  screen: string;
  element: string;
  parent: string;
  overflowPx: number;
}

/** Runs in the page: every element whose box escapes its nearest boxed ancestor. */
async function overflows(page: Page, screen: string): Promise<Violation[]> {
  const found = await page.evaluate(() => {
    const describe = (e: Element): string => {
      const id = e.getAttribute('data-control');
      const cls = (e.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      return `${e.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${id ? `[data-control="${id}"]` : ''}`;
    };
    const clips = (e: Element): boolean => {
      const s = getComputedStyle(e);
      return s.overflowX !== 'visible' || s.overflowY !== 'visible';
    };
    const srOnly = (e: Element): boolean => {
      for (let a: Element | null = e; a; a = a.parentElement) if (a.classList.contains('sr-only')) return true;
      return false;
    };
    const out: { element: string; parent: string; overflowPx: number }[] = [];
    const root = document.querySelector('main') ?? document.body;
    for (const e of root.querySelectorAll('*')) {
      if (srOnly(e)) continue;
      // Chromium lays out a closed <details>'s content without showing it: not on screen, so not a violation.
      const shut = e.closest('details:not([open])');
      if (shut && !e.closest('summary')) continue;
      if (e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (getComputedStyle(e).display === 'contents') continue;
      let p = e.parentElement;
      let contained = false;
      while (p && getComputedStyle(p).display === 'contents') p = p.parentElement;
      if (!p) continue;
      for (let a: Element | null = p; a && a !== document.body; a = a.parentElement) if (clips(a)) contained = true;
      if (contained) continue;
      const q = p.getBoundingClientRect();
      const over = Math.max(q.left - r.left, r.right - q.right, q.top - r.top, r.bottom - q.bottom);
      if (over > 1) out.push({ element: describe(e), parent: describe(p), overflowPx: Math.round(over) });
    }
    return out;
  });
  // One entry per (element, parent) pair per screen: a table of identical rows is one defect, not twenty.
  const seen = new Map<string, Violation>();
  for (const f of found) {
    const k = `${f.element} in ${f.parent}`;
    const v = seen.get(k);
    if (!v || v.overflowPx < f.overflowPx) seen.set(k, { screen, ...f });
  }
  return [...seen.values()];
}

/** Opens every disclosure: details, "Going deeper" sections, "More settings". */
async function openAll(page: Page): Promise<void> {
  // Sections first: opening one mounts new content, including more <details>.
  const closed = page.locator('.deeper-buttons button[aria-expanded="false"]');
  for (let k = 0; k < 12 && (await closed.count()); k++) await closed.first().click();
  await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => d.setAttribute('open', '')));
  await page.waitForTimeout(300);
}

const SHARED = /\b(param-field|param-inputs|param-number|param-error|stepbar|controls|tryit|structure|inspector|explanation|walkthrough|selfcheck|export|deeper)\b/;

test('I. no element escapes its parent, every screen, both modes, every disclosure open', async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1280, height: 720 });
  await unlockAll(page);
  const all: Violation[] = [];
  for (const mode of ['novice', 'expert'] as const) {
    await page.goto(`/?mode=${mode}`);
    for (const e of EXPERIMENTS) {
      await page.getByRole('button', { name: new RegExp(`^${e.number}\\. `) }).click();
      await expect(
        page.locator(`.position[data-cursor="-1"], article.novice[data-screen="${e.id}"]`).first(),
      ).toBeVisible({ timeout: 120_000 });
      await page.waitForTimeout(500);
      await openAll(page);
      all.push(...(await overflows(page, `${e.id} (${mode})`)));
    }
  }
  mkdirSync(resolve(import.meta.dirname, '../../reports'), { recursive: true });
  writeFileSync(resolve(import.meta.dirname, '../../reports/layout.json'), JSON.stringify(all, null, 2) + '\n');
  const deferred: Violation[] = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'layout-deferred.json'), 'utf8'),
  );
  const key = (v: Violation): string => `${v.screen}|${v.element}|${v.parent}`;
  const allowed = new Set(deferred.map(key));
  const blocking = all.filter(
    (v) => v.screen.startsWith('single-neuron') || SHARED.test(v.element) || !allowed.has(key(v)),
  );
  expect(blocking.map((v) => `${v.screen}: ${v.element} escapes ${v.parent} by ${v.overflowPx}px`)).toEqual([]);
});

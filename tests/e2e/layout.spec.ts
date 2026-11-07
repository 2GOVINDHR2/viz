/**
 * Invariant I (Fix Round 4, A3; extended in Fix Round 5, 2.1). On every screen in both modes, at four widths
 * (1440, 1280, 1024 and 768 px), with disclosures collapsed and expanded and with the inspector closed and open:
 *  - **escape:** no element's box extends beyond its parent's box;
 *  - **clip:** no element hides its own content: `scrollWidth > clientWidth` where overflow is hidden or clipped and
 *    no scrollbar is offered, or a text field whose value is wider than the field;
 *  - **drop:** no control or labelled panel that is present at one width is absent at another, in the same state.
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
  /** escape (Fix Round 4), clip or drop (Fix Round 5, 2.1). Absent means escape, for older entries. */
  kind?: 'escape' | 'clip' | 'drop' | 'overlap';
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
      for (let a: Element | null = e; a; a = a.parentElement)
        if (a.classList.contains('sr-only')) return true;
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
      for (let a: Element | null = p; a && a !== document.body; a = a.parentElement)
        if (clips(a)) contained = true;
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
    if (!v || v.overflowPx < f.overflowPx) seen.set(k, { screen, kind: 'escape', ...f });
  }
  return [...seen.values()];
}

/** Runs in the page: elements that cut off their own content without a way to scroll to it. */
/**
 * Runs in the page (Fix Round 6, B): pairs of text labels on a diagram canvas whose boxes intersect. A canvas is a
 * network or neuron diagram (charts have their own axes and are not in scope). Two labels overlapping by more than
 * one pixel each way is a collision.
 */
async function overlapping(page: Page, screen: string): Promise<Violation[]> {
  const found = await page.evaluate(() => {
    const out: { element: string; parent: string; overflowPx: number }[] = [];
    const name = (t: Element): string =>
      `text"${(t.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[−-]?\d[\d.,]*/g, '#')
        .replace(/[⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, '#')
        .slice(0, 30)}"`;
    for (const svg of document.querySelectorAll(
      'main svg.neuron-svg, main svg.network-svg, main .conv svg',
    )) {
      // The hover label is transient, drawn on top with a halo while the pointer rests on an element: it is meant
      // to sit over its neighbours, so it is not a collision (Fix Round 6, B).
      const texts = [...svg.querySelectorAll('text:not([data-hover-tip])')].filter((t) => {
        const r = t.getBoundingClientRect();
        return (
          r.width > 0 &&
          r.height > 0 &&
          (t.textContent ?? '').trim() !== '' &&
          getComputedStyle(t).visibility !== 'hidden'
        );
      });
      const boxes = texts.map((t) => t.getBoundingClientRect());
      for (let i = 0; i < texts.length; i++)
        for (let j = i + 1; j < texts.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 1 && h > 1)
            out.push({
              element: name(texts[i]),
              parent: name(texts[j]),
              overflowPx: Math.round(Math.min(w, h)),
            });
        }
    }
    return out;
  });
  const seen = new Map<string, Violation>();
  for (const f of found) seen.set(`${f.element}|${f.parent}`, { screen, kind: 'overlap', ...f });
  return [...seen.values()];
}

async function clipped(page: Page, screen: string): Promise<Violation[]> {
  const found = await page.evaluate(() => {
    const describe = (e: Element): string => {
      const id = e.getAttribute('data-control');
      const cls = (e.getAttribute('class') ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
      return `${e.tagName.toLowerCase()}${cls ? `.${cls}` : ''}${id ? `[data-control="${id}"]` : ''}`;
    };
    const out: { element: string; parent: string; overflowPx: number }[] = [];
    const root = document.querySelector('main') ?? document.body;
    for (const e of root.querySelectorAll<HTMLElement>('*')) {
      // KaTeX's MathML copy is hidden on purpose, for screen readers (like .sr-only), so it is not a clip.
      if (e.closest('.sr-only, .katex-mathml') || e.closest('details:not([open])') || e.closest('svg'))
        continue;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const tag = e.tagName.toLowerCase();
      if (tag === 'input' && ['text', 'search', 'number', ''].includes((e as HTMLInputElement).type)) {
        // A text field whose value is wider than the field shows only part of it (the field is not focused).
        const over = e.scrollWidth - e.clientWidth;
        if (over > 1 && document.activeElement !== e)
          out.push({ element: describe(e), parent: 'its own value', overflowPx: over });
        continue;
      }
      if (tag === 'select' || tag === 'textarea') continue;
      const st = getComputedStyle(e);
      const hidesX = st.overflowX === 'hidden' || st.overflowX === 'clip';
      const hidesY = st.overflowY === 'hidden' || st.overflowY === 'clip';
      const overX = e.scrollWidth - e.clientWidth;
      const overY = e.scrollHeight - e.clientHeight;
      // An ellipsis is a deliberate, visible truncation with the full text in a title; not a silent clip.
      if (st.textOverflow === 'ellipsis' && e.title) continue;
      if (hidesX && overX > 1)
        out.push({ element: describe(e), parent: 'itself (horizontal)', overflowPx: overX });
      else if (hidesY && overY > 1)
        out.push({ element: describe(e), parent: 'itself (vertical)', overflowPx: overY });
    }
    return out;
  });
  const seen = new Map<string, Violation>();
  for (const f of found) seen.set(`${f.element}|${f.parent}`, { screen, kind: 'clip', ...f });
  return [...seen.values()];
}

/** What a learner can find on the screen: controls and labelled panels, for the drop check. */
async function present(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const main = document.querySelector('main') ?? document.body;
    const visible = (e: Element): boolean => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
    };
    const out = new Set<string>();
    for (const e of main.querySelectorAll('[data-control]'))
      if (visible(e) && !e.closest('details:not([open])'))
        out.add(`control ${e.getAttribute('data-control')}`);
    for (const e of main.querySelectorAll('section[aria-label]'))
      if (visible(e)) out.add(`panel ${e.getAttribute('aria-label')}`);
    return [...out].sort();
  });
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

const SHARED =
  /\b(param-field|param-inputs|param-number|param-error|stepbar|controls|tryit|structure|inspector|explanation|walkthrough|selfcheck|export|deeper)\b/;

const WIDTHS = [1440, 1280, 1024, 768] as const;
type State = 'collapsed' | 'expanded' | 'inspector' | 'end';

/** Opens the inspector on the first selectable element, if the screen has one. */
async function openInspector(page: Page): Promise<boolean> {
  const target = page.locator('[data-control="select:unit"], [data-control="select:edge"]').first();
  if (!(await target.count())) return false;
  await target.click({ force: true });
  await page.waitForTimeout(300);
  return true;
}

test('I. no element escapes, clips or drops, every screen, both modes, four widths, three states', async ({
  page,
}) => {
  test.setTimeout(3_600_000);
  await unlockAll(page);
  const all: Violation[] = [];
  /** screen|state → width → what is present. */
  const presence = new Map<string, Map<number, string[]>>();
  for (const mode of ['novice', 'expert'] as const) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`/?mode=${mode}`);
      for (const e of EXPERIMENTS) {
        await page.getByRole('button', { name: new RegExp(`^${e.number}\\. `) }).click();
        await expect(
          page.locator(`.position[data-cursor="-1"], article.novice[data-screen="${e.id}"]`).first(),
        ).toBeVisible({ timeout: 120_000 });
        // The run is ready (a long run, D1's, can still be generating when its screen first appears).
        await expect(page.locator('[data-control="step"]').first()).toBeEnabled({ timeout: 180_000 });
        await page.waitForTimeout(400);
        const screen = `${e.id} (${mode})`;
        const record = async (state: State): Promise<void> => {
          const tag = `${screen} @${width} ${state}`;
          all.push(
            ...(await overflows(page, tag)),
            ...(await clipped(page, tag)),
            ...(await overlapping(page, tag)),
          );
          const k = `${screen}|${state}`;
          if (!presence.has(k)) presence.set(k, new Map());
          presence.get(k)!.set(width, await present(page));
        };
        await record('collapsed');
        await openAll(page);
        await record('expanded');
        if (await openInspector(page)) await record('inspector');
        // At the end of the run (Fix Round 6, B): trained values are the long ones that made labels collide.
        const end = page.getByRole('button', { name: /^(Let it learn|Jump to the end)$/ }).first();
        const scrub = page.getByLabel('Position', { exact: true });
        if (await end.count()) await end.click();
        else if (await scrub.count()) await scrub.fill(String(await scrub.getAttribute('max')));
        await page.waitForTimeout(800);
        await record('end');
      }
    }
  }
  // Drop: present at one width, absent at another, same screen and state.
  for (const [k, byWidth] of presence) {
    const [screen, state] = k.split('|');
    const union = new Set([...byWidth.values()].flat());
    for (const [width, items] of byWidth) {
      const have = new Set(items);
      for (const item of union)
        if (!have.has(item))
          all.push({
            screen: `${screen} @${width} ${state}`,
            kind: 'drop',
            element: item,
            parent: 'the screen',
            overflowPx: 0,
          });
    }
  }
  mkdirSync(resolve(import.meta.dirname, '../../reports'), { recursive: true });
  writeFileSync(
    resolve(import.meta.dirname, '../../reports/layout.json'),
    JSON.stringify(all, null, 2) + '\n',
  );
  const deferred: Violation[] = JSON.parse(
    readFileSync(resolve(import.meta.dirname, 'layout-deferred.json'), 'utf8'),
  );
  // A deferral names the screen without width and state, so one entry covers a defect wherever it appears.
  const base = (v: Violation): string =>
    `${v.kind ?? 'escape'}|${v.screen.replace(/ @.*$/, '')}|${v.element}|${v.parent}`;
  const allowed = new Set(deferred.map(base));
  const blocking = all.filter(
    (v) => v.screen.startsWith('single-neuron') || SHARED.test(v.element) || !allowed.has(base(v)),
  );
  expect(
    blocking.map(
      (v) =>
        `${v.kind} ${v.screen}: ${v.element} ${v.kind === 'drop' ? 'missing' : v.kind === 'overlap' ? `overlaps ${v.parent} by ${v.overflowPx}px` : `beyond ${v.parent} by ${v.overflowPx}px`}`,
    ),
  ).toEqual([]);
});

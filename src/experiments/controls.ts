/**
 * The declared control surface of every experiment screen (Fix Round 2b,
 * invariant A). Every interactive control inside an experiment screen carries
 * `data-control="<id>"`; the invariant is
 *
 *   always ⊆ rendered ⊆ always ∪ conditional
 *
 * at every state, where `always` must render whenever a run is loaded and
 * `conditional` may appear depending on the state (a selection, an open
 * disclosure, a staged prediction). Reset is required on every screen.
 *
 * Workbench screens derive their declaration from the experiment's surface
 * (step sizes, *Try it* parameters, structure and parameter editors, panels)
 * and its *current* configuration, so the declaration follows architecture
 * edits. Purpose-built novice screens declare their own list in the registry.
 */
import type { TrainConfig } from '../core/engine/session';
import { trainableParams } from './architecture';
import { offeredGranularities, type Mode } from './surface';
import type { BreakpointKey, Experiment } from './types';

const BREAKPOINT_KEYS: BreakpointKey[] = [
  'nonFinite',
  'vanishing',
  'exploding',
  'deadRelu',
  'lossIncrease',
  'lossPlateau',
  'gradInit',
];

export interface DeclaredControls {
  always: string[];
  conditional: string[];
}

/** Controls every experiment screen must offer. */
export const REQUIRED_CONTROLS = ['reset-experiment'] as const;

export function declaredControls(
  exp: Experiment,
  mode: Mode,
  config: TrainConfig,
  /** True when the purpose-built novice screen is shown rather than the workbench. */
  noviceScreen: boolean,
): DeclaredControls {
  const selfCheck = exp.selfCheck.map((q) => `selfcheck:${q.id}`);
  if (noviceScreen) {
    const n = exp.surface.noviceControls;
    if (!n) throw new Error(`${exp.id} shows a novice screen but declares no novice controls`);
    return { always: [...REQUIRED_CONTROLS, ...n.always, ...selfCheck], conditional: n.conditional };
  }
  const conv = config.model.layers.some((l) => l.type === 'conv2d');
  const offered = offeredGranularities(exp, mode);
  const always = [
    ...REQUIRED_CONTROLS,
    'rewind',
    'back',
    'step',
    'play',
    'to-breakpoint',
    'speed',
    'scrub',
    ...(offered.length > 1 ? offered.map((g) => `step-size:${g}`) : []),
    ...BREAKPOINT_KEYS.map((k) => `breakpoint:${k}`),
    ...(mode === 'novice' ? ['more-controls'] : []),
    ...exp.editable.map((_, k) => `tryit:${k}`),
    'structure:expand',
    ...(exp.surface.architectureEditor
      ? ['arch:add', 'arch:lr', 'arch:epochs', 'arch:apply', 'arch:restore']
      : []),
    ...(exp.surface.parameterEditor
      ? ['params', ...trainableParams(config).map((p) => `param:${p.name}`)]
      : []),
    ...(conv ? [] : ['select:unit', 'select:edge']),
    'explain:novice',
    'explain:detailed',
    ...selfCheck,
    ...(mode === 'expert' ? ['export:open'] : []),
  ];
  const conditional = [
    ...(exp.surface.architectureEditor ? ['arch:width', 'arch:activation', 'arch:remove'] : []),
    ...(exp.surface.parameterEditor ? ['param-value'] : []),
    ...(conv ? ['select:cell'] : []),
    'walkthrough:hide',
    'walkthrough:show',
    'walkthrough:prev',
    'walkthrough:next',
    'walkthrough:show-me',
    'explain:maths',
    'explain:numbers',
    'chart:pick',
    'chart:heatmap',
    'chart:table',
    'inspector:clear',
    ...(mode === 'expert'
      ? [
          'export:mode',
          'export:refresh',
          'export:zip',
          'export:svg',
          'export:pdf',
          'export:csv',
          'export:caption',
        ]
      : []),
  ];
  return { always, conditional };
}

/** The data-control values inside an experiment screen's markup (its `<main>` element). */
export function renderedControls(html: string): Set<string> {
  const main = html.slice(html.indexOf('<main'), html.lastIndexOf('</main>'));
  return new Set([...main.matchAll(/data-control="([^"]+)"/g)].map((m) => m[1]));
}

/** Violations of always ⊆ rendered ⊆ always ∪ conditional. */
export function surfaceViolations(declared: DeclaredControls, rendered: Set<string>): string[] {
  const allowed = new Set([...declared.always, ...declared.conditional]);
  return [
    ...declared.always.filter((c) => !rendered.has(c)).map((c) => `declared but not rendered: ${c}`),
    ...[...rendered].filter((c) => !allowed.has(c)).map((c) => `rendered but not declared: ${c}`),
  ];
}

/**
 * The declared controls of a guided screen built on the shared template (src/ui/novice/Guided.tsx; Fix Round 5,
 * Part 4; ADR-073). The template renders the same skeleton on every experiment, so its declaration is generated:
 * the primary choice, the step bar, the two ways to run, Going deeper, and whatever the experiment adds.
 */
import type { EditableParam } from './types';

export interface GuidedDeclaration {
  /** Index of the primary parameter in the experiment's `editable` list. */
  primary: number;
  editable: EditableParam[];
  /** Step sizes offered on the step bar (more than one renders a selector). */
  levels: string[];
  /** Going-deeper items beyond the shared "numbers" and "settings". */
  deeper: string[];
  /** Controls the experiment's own observation panel may render. */
  observe?: string[];
  /** The settings section includes the starting-value editor. */
  parameterEditor?: boolean;
}

const numericChoice = (p: EditableParam): boolean =>
  p.kind !== 'activation' && p.kind !== 'loss' && p.kind !== 'seed';

export { numericChoice };

export function guidedControls(d: GuidedDeclaration): { always: string[]; conditional: string[] } {
  const p = d.editable[d.primary];
  // The settings section offers every other parameter; a named choice (an activation, a loss) is offered there
  // too, as a select, beside its buttons above.
  const others = d.editable.map((q, k) => ({ q, k })).filter(({ k }) => k !== d.primary || !numericChoice(p));
  return {
    always: [
      'choice',
      ...(numericChoice(p) ? ['choice-typed'] : []),
      ...(d.levels.length > 1 ? d.levels.map((l) => `step-size:${l}`) : []),
      'back',
      'step',
      'play',
      'jump-end',
      'deeper:numbers',
      'deeper:settings',
      ...d.deeper.map((x) => `deeper:${x}`),
      'deeper:expert',
    ],
    conditional: [
      'predict:option',
      // The settings section: every other parameter, typed (and dragged where it has a slider).
      ...others.map(({ k }) => `tryit:${k}`),
      ...others
        .filter(({ q }) => q.kind === 'initialValue' || (q.kind === 'probe' && q.min !== undefined))
        .map(({ k }) => `tryit:${k}:slider`),
      // Charts and the canvas, where an observation or a deeper item shows them.
      'chart:pick',
      'chart:heatmap',
      'chart:table',
      'select:unit',
      'select:edge',
      'select:cell',
      'inspector:clear',
      ...(d.parameterEditor ? ['params', 'param-value'] : []),
      ...(d.observe ?? []),
    ],
  };
}

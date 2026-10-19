/**
 * Builds the export files exactly as docs/DATA-DICTIONARY.md defines them.
 * Withdrawn participants keep only their flow row; their responses,
 * questionnaires, telemetry and feedback are never written.
 */
import { itemById } from './instruments';
import { toCsv, type Cell } from '../export/csv';
import { summarise } from './telemetry';
import type { Participant } from './types';
import { FEEDBACK_PROMPTS, TLX_SCALES } from './types';

export const COLUMNS = {
  participants: [
    'participant_id',
    'study_id',
    'design',
    'condition',
    'assignment',
    'stratum',
    'consented',
    'withdrawn',
    'completed',
    'year_of_study',
    'prior_ml_course',
    'programming_years',
    'familiarity',
    'pre_duration_s',
    'intervention_duration_s',
    'post_duration_s',
  ],
  responses_long: [
    'participant_id',
    'phase',
    'item_id',
    'position',
    'chosen',
    'correct',
    'latency_ms',
    'concept',
    'bloom',
    'transfer',
  ],
  sus: ['participant_id', ...Array.from({ length: 10 }, (_, k) => `sus${String(k + 1).padStart(2, '0')}`)],
  tlx: ['participant_id', ...TLX_SCALES],
  telemetry: [
    'participant_id',
    'steps_total',
    'steps_operation',
    'steps_layer',
    'steps_phase',
    'steps_sample',
    'steps_batch',
    'steps_epoch',
    'back_steps',
    'jumps',
    'view_switches',
    'param_edits',
    'breakpoints_set',
    'explanation_opens',
    'explanation_detailed_share',
    'experiments_started',
    'experiments_completed',
    'walkthrough_steps',
    'active_time_s',
    'idle_gaps',
    'mode_switches',
    'deeper_opens',
    'predictions_made',
    'predictions_revised',
    'predictions_resolved',
    'predictions_correct',
    'prediction_accuracy_early',
    'prediction_accuracy_late',
    'granularities_offered',
    'granularities_used',
  ],
  telemetry_events: ['participant_id', 't_ms', 'event', 'detail'],
  feedback: ['participant_id', 'prompt', 'text'],
} as const;

export type ExportName = keyof typeof COLUMNS;

const round = (x: number | null, d = 1): number | null =>
  x === null ? null : Math.round(x * 10 ** d) / 10 ** d;

export function exportTables(ps: readonly Participant[]): Record<ExportName, Record<string, Cell>[]> {
  const kept = ps.filter((p) => p.withdrawn === 0);
  const t: Record<ExportName, Record<string, Cell>[]> = {
    participants: ps.map((p) => {
      const d = p.withdrawn ? null : p.demographics;
      return {
        participant_id: p.participant_id,
        study_id: p.study_id,
        design: p.design,
        condition: p.condition,
        assignment: p.assignment ?? (p.condition ? 'stratified_random' : null),
        stratum: p.stratum,
        consented: p.consented,
        withdrawn: p.withdrawn,
        completed: p.completed,
        year_of_study: d?.year_of_study,
        prior_ml_course: d?.prior_ml_course,
        programming_years: d?.programming_years,
        familiarity: d?.familiarity,
        pre_duration_s: p.withdrawn ? null : round(p.durations.pre),
        intervention_duration_s: p.withdrawn ? null : round(p.durations.intervention),
        post_duration_s: p.withdrawn ? null : round(p.durations.post),
      };
    }),
    responses_long: kept.flatMap((p) =>
      (['pre', 'post'] as const).flatMap((phase) =>
        p.responses[phase].map((r) => {
          const it = itemById(r.item_id);
          return {
            participant_id: p.participant_id,
            phase,
            item_id: r.item_id,
            position: r.position,
            chosen: r.chosen,
            correct: r.correct,
            latency_ms: r.latency_ms,
            concept: it.concept,
            bloom: it.bloom,
            transfer: it.transfer ? 1 : 0,
          };
        }),
      ),
    ),
    sus: kept
      .filter((p) => p.sus)
      .map((p) =>
        Object.fromEntries([
          ['participant_id', p.participant_id],
          ...p.sus!.map((v, k) => [COLUMNS.sus[k + 1], v]),
        ]),
      ),
    tlx: kept.filter((p) => p.tlx).map((p) => ({ participant_id: p.participant_id, ...p.tlx! })),
    telemetry: kept
      .filter((p) => p.condition === 'C3' && p.durations.intervention !== null)
      .map((p) => {
        const s = summarise(p.events);
        return {
          participant_id: p.participant_id,
          ...s,
          explanation_detailed_share: round(s.explanation_detailed_share, 3),
          prediction_accuracy_early: round(s.prediction_accuracy_early, 3),
          prediction_accuracy_late: round(s.prediction_accuracy_late, 3),
        };
      }),
    telemetry_events: kept
      .filter((p) => p.condition === 'C3')
      .flatMap((p) =>
        p.events.map((e) => ({
          participant_id: p.participant_id,
          t_ms: e.t_ms,
          event: e.event,
          detail: JSON.stringify(e.detail),
        })),
      ),
    feedback: kept
      .filter((p) => p.feedback)
      .flatMap((p) =>
        FEEDBACK_PROMPTS.map((prompt) => ({
          participant_id: p.participant_id,
          prompt,
          text: p.feedback![prompt],
        })),
      ),
  };
  return t;
}

export function exportFiles(ps: readonly Participant[]): { name: string; text: string }[] {
  const t = exportTables(ps);
  return (Object.keys(COLUMNS) as ExportName[]).map((k) => ({
    name: `${k}.csv`,
    text: toCsv(COLUMNS[k], t[k]),
  }));
}

/**
 * Interaction telemetry for the DL-VizLab condition. The recorder is a no-op
 * unless a study session switches it on, so the tool outside Study Mode
 * records nothing. Event details carry only enumerated values and numbers,
 * never text a participant typed.
 */
import type { TelemetryEvent } from './types';

type Sink = (e: TelemetryEvent) => void;
let sink: Sink | null = null;
let t0 = 0;

export function startRecording(onEvent: Sink, startedAt: number): void {
  sink = onEvent;
  t0 = startedAt;
}

export function stopRecording(): void {
  sink = null;
}

export const recording = (): boolean => sink !== null;

export function track(event: string, detail: TelemetryEvent['detail'] = {}): void {
  if (!sink) return;
  sink({ t_ms: Math.max(0, Math.round(Date.now() - t0)), event, detail });
}

export const GRANULARITIES = ['operation', 'layer', 'phase', 'sample', 'batch', 'epoch'] as const;

export interface TelemetrySummary {
  steps_total: number;
  steps_operation: number;
  steps_layer: number;
  steps_phase: number;
  steps_sample: number;
  steps_batch: number;
  steps_epoch: number;
  back_steps: number;
  jumps: number;
  view_switches: number;
  param_edits: number;
  breakpoints_set: number;
  explanation_opens: number;
  explanation_detailed_share: number | null;
  experiments_started: number;
  experiments_completed: number;
  walkthrough_steps: number;
  active_time_s: number;
  idle_gaps: number;
}

/** Window for active time and threshold for an idle gap (docs/DATA-DICTIONARY.md). */
export const ACTIVE_WINDOW_MS = 30_000;
export const IDLE_GAP_MS = 60_000;

export function summarise(events: readonly TelemetryEvent[]): TelemetrySummary {
  const n = (f: (e: TelemetryEvent) => boolean) => events.filter(f).length;
  const steps = events.filter((e) => e.event === 'step');
  const by = (g: string) => steps.filter((e) => e.detail.granularity === g).length;
  const navigations = events.filter((e) => e.event === 'step' || e.event === 'jump');
  const windows = new Set(events.map((e) => Math.floor(e.t_ms / ACTIVE_WINDOW_MS)));
  let gaps = 0;
  const ts = events.map((e) => e.t_ms).sort((a, b) => a - b);
  for (let k = 1; k < ts.length; k++) if (ts[k] - ts[k - 1] >= IDLE_GAP_MS) gaps++;
  return {
    steps_total: steps.length,
    steps_operation: by('operation'),
    steps_layer: by('layer'),
    steps_phase: by('phase'),
    steps_sample: by('sample'),
    steps_batch: by('batch'),
    steps_epoch: by('epoch'),
    back_steps: steps.filter((e) => e.detail.direction === -1).length,
    jumps: n((e) => e.event === 'jump'),
    view_switches: n((e) => e.event === 'view'),
    param_edits: n((e) => e.event === 'param_edit'),
    breakpoints_set: n((e) => e.event === 'breakpoint' && e.detail.on === true),
    explanation_opens: n((e) => e.event === 'explain_open'),
    explanation_detailed_share: navigations.length
      ? navigations.filter((e) => e.detail.verbosity === 'detailed').length / navigations.length
      : null,
    experiments_started: n((e) => e.event === 'experiment_start'),
    experiments_completed: n((e) => e.event === 'experiment_complete'),
    walkthrough_steps: n((e) => e.event === 'walkthrough_step'),
    active_time_s: (windows.size * ACTIVE_WINDOW_MS) / 1000,
    idle_gaps: gaps,
  };
}

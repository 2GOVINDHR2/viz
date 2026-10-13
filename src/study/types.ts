/**
 * Study Mode data model. Field names follow docs/DATA-DICTIONARY.md, which
 * defines the export; nothing here identifies a participant.
 */
export type Condition = 'C1' | 'C2' | 'C3';
export type Design = 'three_condition' | 'two_condition';
export type Stratum = 'low' | 'high';
export type Stage =
  | 'consent'
  | 'demographics'
  | 'pre'
  | 'intervention'
  | 'post'
  | 'questionnaires'
  | 'feedback'
  | 'debrief'
  | 'declined'
  | 'withdrawn';

export interface StudyConfig {
  studyId: string;
  design: Design;
  /** Stage time limits in seconds. The intervention lasts exactly this long. */
  limits: { pre: number; intervention: number; post: number };
  /** Condition for the next participant only, for technical recovery; recorded as manual_override. */
  override: Condition | null;
}

export const DEFAULT_CONFIG: StudyConfig = {
  studyId: 'dlvizlab-pilot',
  design: 'three_condition',
  limits: { pre: 15 * 60, intervention: 30 * 60, post: 20 * 60 },
  override: null,
};

export interface Demographics {
  year_of_study: number;
  prior_ml_course: 0 | 1;
  programming_years: 'none' | 'lt1' | '1to3' | 'gt3';
  familiarity: 1 | 2 | 3 | 4 | 5;
}

export interface ItemResponse {
  item_id: string;
  position: number;
  /** Canonical option index, or null if skipped or timed out. */
  chosen: number | null;
  correct: 0 | 1;
  /** Null for items never shown because time ran out. */
  latency_ms: number | null;
}

export interface TelemetryEvent {
  t_ms: number;
  event: string;
  detail: Record<string, string | number | boolean>;
}

export interface Participant {
  participant_id: string;
  study_id: string;
  design: Design;
  condition: Condition | null;
  assignment: 'stratified_random' | 'manual_override' | null;
  stratum: Stratum | null;
  consented: 0 | 1;
  withdrawn: 0 | 1;
  completed: 0 | 1;
  stage: Stage;
  /** Wall-clock start of the current stage (ms since epoch), for timers that survive a reload. */
  stageStartedAt: number;
  demographics: Demographics | null;
  durations: { pre: number | null; intervention: number | null; post: number | null };
  /** Presentation order for each test: item ids, and per item the option permutation (display → canonical). */
  forms: { pre: TestForm | null; post: TestForm | null };
  responses: { pre: ItemResponse[]; post: ItemResponse[] };
  sus: number[] | null;
  tlx: Record<TlxScale, number> | null;
  feedback: Record<FeedbackPrompt, string> | null;
  events: TelemetryEvent[];
}

export interface TestForm {
  items: string[];
  options: Record<string, number[]>;
}

export type TlxScale = 'mental' | 'physical' | 'temporal' | 'performance' | 'effort' | 'frustration';
export const TLX_SCALES: TlxScale[] = [
  'mental',
  'physical',
  'temporal',
  'performance',
  'effort',
  'frustration',
];
export type FeedbackPrompt = 'helped' | 'confusing' | 'suggestions';
export const FEEDBACK_PROMPTS: FeedbackPrompt[] = ['helped', 'confusing', 'suggestions'];

export const conditionsFor = (d: Design): Condition[] =>
  d === 'two_condition' ? ['C1', 'C3'] : ['C1', 'C2', 'C3'];
/** SUS and NASA-TLX are given to the conditions that use an interactive tool. */
export const hasQuestionnaires = (c: Condition | null): boolean => c === 'C2' || c === 'C3';

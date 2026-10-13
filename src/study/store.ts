/**
 * Study Mode state: configuration, allocation and every participant record,
 * kept in localStorage on the study machine (local-first, no server) and
 * written out only by the explicit export.
 */
import { create } from 'zustand';
import { Rng } from '../core/rng/rng';
import { DRAFT_CONSENT, type ConsentDoc } from './consent';
import { newParticipantId, newSeed } from './ids';
import { itemById, makeForm } from './instruments';
import { allocate, emptyAllocation, stratumOf, type Allocation } from './randomise';
import type {
  Demographics,
  FeedbackPrompt,
  Participant,
  Stage,
  StudyConfig,
  TelemetryEvent,
  TlxScale,
} from './types';
import { DEFAULT_CONFIG, hasQuestionnaires } from './types';

const KEY = 'dl-vizlab.study.v1';

interface Persisted {
  config: StudyConfig;
  allocation: Allocation;
  participants: Participant[];
  activeId: string | null;
  consent: ConsentDoc | null;
}

export interface StudyState extends Persisted {
  /** When the current test item was shown (ms since epoch); not persisted. */
  itemShownAt: number;
  setConfig(c: Partial<StudyConfig>): void;
  setConsent(doc: ConsentDoc | null): void;
  start(): string;
  consentDecision(agree: boolean): void;
  submitDemographics(d: Demographics): void;
  showItem(): void;
  answer(phase: 'pre' | 'post', chosen: number | null): void;
  timeUp(phase: 'pre' | 'post'): void;
  finishIntervention(): void;
  submitQuestionnaires(sus: number[], tlx: Record<TlxScale, number>): void;
  submitFeedback(f: Record<FeedbackPrompt, string>): void;
  withdraw(): void;
  close(): void;
  addEvent(e: TelemetryEvent): void;
  clearAll(): void;
}

function load(): Persisted {
  const fresh: Persisted = {
    config: DEFAULT_CONFIG,
    allocation: emptyAllocation(),
    participants: [],
    activeId: null,
    consent: null,
  };
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return fresh;
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...fresh,
      ...p,
      config: { ...DEFAULT_CONFIG, ...p.config, limits: { ...DEFAULT_CONFIG.limits, ...p.config?.limits } },
    };
  } catch {
    return fresh;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
export function flushStudy(): void {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const s = useStudy.getState();
  const p: Persisted = {
    config: s.config,
    allocation: s.allocation,
    participants: s.participants,
    activeId: s.activeId,
    consent: s.consent,
  };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage full or blocked: the session continues in memory; the researcher view warns (see StudyApp).
  }
}
const saveSoon = (): void => {
  if (saveTimer === undefined) saveTimer = setTimeout(flushStudy, 500);
};

export const consentDoc = (s: Pick<StudyState, 'consent'>): ConsentDoc => s.consent ?? DRAFT_CONSENT;
export const activeParticipant = (s: Pick<StudyState, 'participants' | 'activeId'>): Participant | null =>
  s.participants.find((p) => p.participant_id === s.activeId) ?? null;

const elapsed = (p: Participant, limit: number): number =>
  Math.min((Date.now() - p.stageStartedAt) / 1000, limit);

export const useStudy = create<StudyState>((set, get) => {
  /** Applies `f` to the active participant and persists immediately (stage changes) or soon (events). */
  const update = (f: (p: Participant) => Participant, immediate = true): void => {
    const s = get();
    set({ participants: s.participants.map((p) => (p.participant_id === s.activeId ? f(p) : p)) });
    if (immediate) flushStudy();
    else saveSoon();
  };
  const goto = (p: Participant, stage: Stage): Participant => ({ ...p, stage, stageStartedAt: Date.now() });
  const rng = (): Rng => new Rng(newSeed());

  /** Enters a test stage with a freshly randomised form. */
  const enterTest = (p: Participant, phase: 'pre' | 'post'): Participant => {
    set({ itemShownAt: Date.now() });
    return { ...goto(p, phase), forms: { ...p.forms, [phase]: makeForm(phase, rng()) } };
  };

  const finishTest = (p: Participant, phase: 'pre' | 'post'): Participant => {
    const durations = { ...p.durations, [phase]: elapsed(p, get().config.limits[phase]) };
    const next = { ...p, durations };
    return phase === 'pre'
      ? goto(next, 'intervention')
      : goto(next, hasQuestionnaires(p.condition) ? 'questionnaires' : 'feedback');
  };

  return {
    ...load(),
    itemShownAt: Date.now(),

    setConfig(c) {
      set({ config: { ...get().config, ...c } });
      flushStudy();
    },
    setConsent(doc) {
      set({ consent: doc });
      flushStudy();
    },

    start() {
      const { config } = get();
      const p: Participant = {
        participant_id: newParticipantId(),
        study_id: config.studyId,
        design: config.design,
        condition: null,
        assignment: null,
        stratum: null,
        consented: 0,
        withdrawn: 0,
        completed: 0,
        stage: 'consent',
        stageStartedAt: Date.now(),
        demographics: null,
        durations: { pre: null, intervention: null, post: null },
        forms: { pre: null, post: null },
        responses: { pre: [], post: [] },
        sus: null,
        tlx: null,
        feedback: null,
        events: [],
      };
      set({ participants: [...get().participants, p], activeId: p.participant_id });
      flushStudy();
      return p.participant_id;
    },

    consentDecision(agree) {
      update((p) =>
        agree ? goto({ ...p, consented: 1 }, 'demographics') : goto({ ...p, consented: 0 }, 'declined'),
      );
    },

    submitDemographics(d) {
      const s = get();
      const stratum = stratumOf(d.familiarity);
      let condition,
        allocation = s.allocation,
        assignment: Participant['assignment'];
      if (s.config.override) {
        condition = s.config.override;
        assignment = 'manual_override';
      } else {
        ({ condition, state: allocation } = allocate(s.allocation, stratum, s.config.design, rng()));
        assignment = 'stratified_random';
      }
      // The override applies to one participant only.
      set({ allocation, config: { ...s.config, override: null } });
      update((p) => enterTest({ ...p, demographics: d, stratum, condition, assignment }, 'pre'));
    },

    showItem() {
      set({ itemShownAt: Date.now() });
    },

    answer(phase, chosen) {
      const latency = Math.max(0, Math.round(Date.now() - get().itemShownAt));
      update((p) => {
        const form = p.forms[phase]!;
        const k = p.responses[phase].length;
        const id = form.items[k];
        const r = {
          item_id: id,
          position: k + 1,
          chosen,
          correct: (chosen === itemById(id).answer ? 1 : 0) as 0 | 1,
          latency_ms: latency,
        };
        const next = { ...p, responses: { ...p.responses, [phase]: [...p.responses[phase], r] } };
        return k + 1 === form.items.length ? finishTest(next, phase) : next;
      });
      set({ itemShownAt: Date.now() });
    },

    timeUp(phase) {
      update((p) => {
        if (p.stage !== phase) return p;
        const form = p.forms[phase]!;
        const done = p.responses[phase].length;
        // Items never shown are recorded as unanswered so every participant has the full set of rows.
        const rest = form.items.slice(done).map((id, j) => ({
          item_id: id,
          position: done + j + 1,
          chosen: null,
          correct: 0 as const,
          latency_ms: j === 0 ? Math.round(Date.now() - get().itemShownAt) : null,
        }));
        return finishTest(
          { ...p, responses: { ...p.responses, [phase]: [...p.responses[phase], ...rest] } },
          phase,
        );
      });
    },

    finishIntervention() {
      update((p) =>
        enterTest(
          { ...p, durations: { ...p.durations, intervention: elapsed(p, get().config.limits.intervention) } },
          'post',
        ),
      );
    },

    submitQuestionnaires(sus, tlx) {
      update((p) => goto({ ...p, sus, tlx }, 'feedback'));
    },

    submitFeedback(feedback) {
      update((p) => goto({ ...p, feedback, completed: 1 }, 'debrief'));
    },

    withdraw() {
      // Everything recorded about the participant is deleted; only the flow row (and allocation) remains.
      update((p) => ({
        ...p,
        withdrawn: 1,
        completed: 0,
        stage: 'withdrawn',
        demographics: null,
        durations: { pre: null, intervention: null, post: null },
        forms: { pre: null, post: null },
        responses: { pre: [], post: [] },
        sus: null,
        tlx: null,
        feedback: null,
        events: [],
      }));
    },

    close() {
      set({ activeId: null });
      flushStudy();
    },

    addEvent(e) {
      update((p) => (p.stage === 'intervention' ? { ...p, events: [...p.events, e] } : p), false);
    },

    clearAll() {
      set({ participants: [], allocation: emptyAllocation(), activeId: null });
      flushStudy();
    },
  };
});

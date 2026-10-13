/**
 * Application state (Zustand). The store holds only what the engine worker
 * reported — the trace header, the cursor, the reconstructed state at the
 * cursor and the operand values of the current instruction — plus UI choices.
 */
import { create } from 'zustand';
import type { BreakHit, Breakpoint } from '../core/npm/breakpoints';
import type { TraceHeader } from '../core/npm/ir';
import type { Granularity } from '../core/npm/stats';
import type { ExecState } from '../core/npm/state';
import type { Tensor } from '../core/tensor/tensor';
import type { EpochSummary, Reply } from '../core/engine/protocol';
import type { Verbosity } from '../explain/registry';
import { EXPERIMENTS, experimentById } from '../experiments/registry';
import { isComplete, loadProgress, saveProgress, type Progress } from '../experiments/progress';
import type { Request } from '../core/engine/protocol';
import type { TrainConfig } from '../core/engine/session';
import { createEngineClient, type EngineClient } from './engineClient';

export interface BreakpointToggles {
  nonFinite: boolean;
  vanishing: boolean;
  exploding: boolean;
  lossPlateau: boolean;
  gradInit: boolean;
}

import type { Focus } from '../views/focus';
export type { Focus };

interface LabState {
  experimentId: string;
  header: TraceHeader | null;
  length: number;
  generationMs: number;
  generating: boolean;
  error: string | null;
  cursor: number;
  exec: ExecState | null;
  /** State before the most recent move, for "what changed". */
  prevExec: ExecState | null;
  /** The configuration currently trained; starts as the experiment's and changes with architectural edits. */
  config: TrainConfig;
  operands: Record<string, Tensor>;
  hit: BreakHit | null;
  epochs: EpochSummary[];
  granularity: Granularity;
  playing: boolean;
  speedMs: number;
  verbosity: Verbosity;
  focus: Focus | null;
  breakpoints: BreakpointToggles;
  load(id: string): Promise<void>;
  /** Re-generates the run with an edited configuration; the cursor resets to the start. */
  reconfigure(config: TrainConfig): Promise<void>;
  step(direction: 1 | -1): Promise<void>;
  jump(id: number): Promise<void>;
  reset(): Promise<void>;
  runToBreakpoint(): Promise<void>;
  setPlaying(p: boolean): void;
  setGranularity(g: Granularity): void;
  setSpeed(ms: number): void;
  setVerbosity(v: Verbosity): void;
  setFocus(f: Focus | null): void;
  toggleBreakpoint(k: keyof BreakpointToggles): void;
  progress: Progress;
  answer(experimentId: string, questionId: string, option: number): void;
  setWalkthrough(experimentId: string, step: number, dismissed: boolean): void;
}

let client: EngineClient | null = null;
const engine = (): EngineClient => (client ??= createEngineClient());
let busy = false;
/** Steps requested while the engine was busy; replayed in order so no key press is lost. */
const queuedSteps: (1 | -1)[] = [];

/** Engine access for panels that need data beyond the cursor state (trajectories, comparison runs). */
export function engineRequest<R extends Reply['op']>(req: Request): Promise<Extract<Reply, { op: R }>> {
  return engine().request<R>(req);
}

export function activeBreakpoints(t: BreakpointToggles): Breakpoint[] {
  const out: Breakpoint[] = [];
  if (t.nonFinite) out.push({ type: 'nonFinite' });
  if (t.vanishing) out.push({ type: 'gradBelow', threshold: 1e-4 });
  if (t.exploding) out.push({ type: 'gradAbove', threshold: 10 });
  if (t.lossPlateau) out.push({ type: 'lossPlateau', minImprovement: 1e-4 });
  if (t.gradInit) out.push({ type: 'kind', kinds: ['GRAD_INIT'] });
  return out;
}

export const useLab = create<LabState>((set, get) => {
  const applyMove = (r: {
    cursor: number;
    state: ExecState;
    hit: BreakHit | null;
    operands: Record<string, Tensor>;
  }): void =>
    set({
      prevExec: get().exec,
      cursor: r.cursor,
      exec: r.state,
      hit: r.hit,
      operands: r.operands,
      ...(r.hit ? { playing: false } : {}),
    });

  const generate = async (config: TrainConfig): Promise<void> => {
    const exp = experimentById(get().experimentId);
    set({
      config,
      generating: true,
      error: null,
      header: null,
      playing: false,
      hit: null,
      focus: null,
      exec: null,
      prevExec: null,
      cursor: -1,
    });
    try {
      const g = await engine().request<'generate'>({ op: 'generate', config, dataset: exp.dataset });
      const s = await engine().request<'epochSummaries'>({ op: 'epochSummaries' });
      set({
        header: g.header,
        length: g.length,
        generationMs: g.generationMs,
        epochs: s.summaries,
        generating: false,
      });
      applyMove(await engine().request<'move'>({ op: 'jump', cursor: -1 }));
      set({ prevExec: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), generating: false });
    }
  };

  /** Serialises engine calls: a request issued while another is in flight is dropped (key repeat, double clicks). */
  const guarded = async (fn: () => Promise<void>): Promise<void> => {
    if (busy || !get().header) return;
    busy = true;
    try {
      await fn();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), playing: false });
    } finally {
      busy = false;
    }
  };

  return {
    experimentId: EXPERIMENTS[0].id,
    header: null,
    length: 0,
    generationMs: 0,
    generating: false,
    error: null,
    cursor: -1,
    exec: null,
    prevExec: null,
    config: EXPERIMENTS[0].config,
    operands: {},
    hit: null,
    epochs: [],
    granularity: 'operation',
    playing: false,
    speedMs: 250,
    verbosity: 'novice',
    focus: null,
    breakpoints: { nonFinite: true, vanishing: false, exploding: false, lossPlateau: false, gradInit: false },
    progress: loadProgress(),

    async load(id) {
      const e = experimentById(id);
      const breakpoints: BreakpointToggles = {
        nonFinite: true,
        vanishing: false,
        exploding: false,
        lossPlateau: false,
        gradInit: false,
      };
      for (const k of e.suggestedBreakpoints) breakpoints[k] = true;
      set({ experimentId: id, granularity: e.defaultGranularity, breakpoints });
      await generate(e.config);
    },

    answer(experimentId, questionId, option) {
      const p = get().progress;
      const answers = {
        ...p.answers,
        [experimentId]: { ...(p.answers[experimentId] ?? {}), [questionId]: option },
      };
      let next: Progress = { ...p, answers };
      if (isComplete(experimentId, next) && !next.completed.includes(experimentId))
        next = { ...next, completed: [...next.completed, experimentId] };
      saveProgress(next);
      set({ progress: next });
    },

    setWalkthrough(experimentId, step, dismissed) {
      const p = get().progress;
      const next = { ...p, walkthrough: { ...p.walkthrough, [experimentId]: { step, dismissed } } };
      saveProgress(next);
      set({ progress: next });
    },

    reconfigure: (config) => generate(config),

    step: async (direction) => {
      if (busy) {
        if (queuedSteps.length < 20 && !get().playing) queuedSteps.push(direction);
        return;
      }
      await guarded(async () => {
        let dir: 1 | -1 | undefined = direction;
        while (dir !== undefined) {
          const { cursor, granularity, breakpoints } = get();
          const r: Extract<Reply, { op: 'move' }> = await engine().request<'move'>({
            op: 'advance',
            cursor,
            granularity,
            direction: dir,
            breakpoints: activeBreakpoints(breakpoints),
          });
          applyMove(r);
          if (dir > 0 && r.cursor === cursor) set({ playing: false });
          dir = r.hit ? undefined : queuedSteps.shift();
        }
        queuedSteps.length = 0;
      });
    },

    jump: (id) => guarded(async () => applyMove(await engine().request<'move'>({ op: 'jump', cursor: id }))),

    reset: async () => {
      set({ playing: false });
      await get().jump(-1);
    },

    runToBreakpoint: () =>
      guarded(async () => {
        const { cursor, breakpoints } = get();
        applyMove(
          await engine().request<'move'>({
            op: 'runToBreakpoint',
            cursor,
            breakpoints: activeBreakpoints(breakpoints),
          }),
        );
      }),

    setPlaying: (p) => set({ playing: p, hit: p ? null : get().hit }),
    setGranularity: (g) => set({ granularity: g }),
    setSpeed: (ms) => set({ speedMs: ms }),
    setVerbosity: (v) => set({ verbosity: v }),
    setFocus: (f) => set({ focus: f }),
    toggleBreakpoint: (k) => set({ breakpoints: { ...get().breakpoints, [k]: !get().breakpoints[k] } }),
  };
});

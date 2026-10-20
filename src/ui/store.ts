/**
 * Application state (Zustand). The store holds only what the engine worker
 * reported — the trace header, the cursor, the reconstructed state at the
 * cursor and the operand values of the current instruction — plus UI choices.
 */
import { create } from 'zustand';
import type { BreakHit, Breakpoint } from '../core/npm/breakpoints';
import { PATHOLOGIES } from '../core/npm/pathologies';
import type { TraceHeader } from '../core/npm/ir';
import type { Granularity } from '../core/npm/stats';
import type { ExecState } from '../core/npm/state';
import type { Tensor } from '../core/tensor/tensor';
import type { EpochSummary, Reply } from '../core/engine/protocol';
import type { Verbosity } from '../explain/registry';
import { EXPERIMENTS, experimentById } from '../experiments/registry';
import { offeredGranularities, startingGranularity, type Mode } from '../experiments/surface';
import { isComplete, loadProgress, saveProgress, type Progress } from '../experiments/progress';
import type { Request } from '../core/engine/protocol';
import type { TrainConfig } from '../core/engine/session';
import { createEngineClient, type EngineClient } from './engineClient';
import { predictionApis, usePredictions } from './novice/state';

export interface BreakpointToggles {
  nonFinite: boolean;
  vanishing: boolean;
  exploding: boolean;
  deadRelu: boolean;
  lossIncrease: boolean;
  lossPlateau: boolean;
  gradInit: boolean;
}

const NO_BREAKPOINTS: BreakpointToggles = {
  nonFinite: true,
  vanishing: false,
  exploding: false,
  deadRelu: false,
  lossIncrease: false,
  lossPlateau: false,
  gradInit: false,
};

import type { Focus } from '../views/focus';
export type { Focus };

const MODE_KEY = 'dl-vizlab.mode.v1';

/** The starting mode: `?mode=expert|novice` in the URL, else the learner's last choice, else novice. */
export function initialMode(): Mode {
  try {
    const q = new URLSearchParams(globalThis.location?.search ?? '').get('mode');
    if (q === 'expert' || q === 'novice') return q;
    return globalThis.localStorage?.getItem(MODE_KEY) === 'expert' ? 'expert' : 'novice';
  } catch {
    return 'novice';
  }
}

export interface LabState {
  experimentId: string;
  /** Novice path (the default) or the full three-view workbench (Fix Round 2, §2.1). */
  mode: Mode;
  /** Incremented by every experiment reset; screens are keyed on it so their local state starts afresh. */
  resets: number;
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
  /**
   * Returns the experiment to its initial state (Fix Round 2b, defect 3): its own configuration and seed (the
   * run is regenerated if anything was edited), the cursor before the first instruction, the starting step size
   * and breakpoints, no selection, the walkthrough at step 1, and its predictions cleared. Self-check answers
   * are learner progress and are kept, so no experiment is locked again.
   */
  resetExperiment(): Promise<void>;
  step(direction: 1 | -1): Promise<void>;
  jump(id: number): Promise<void>;
  reset(): Promise<void>;
  runToBreakpoint(): Promise<void>;
  setPlaying(p: boolean): void;
  setGranularity(g: Granularity): void;
  setSpeed(ms: number): void;
  setVerbosity(v: Verbosity): void;
  /** Switches path; the trace and the cursor are kept, so the position is preserved in both directions. */
  setMode(m: Mode, remember?: boolean): void;
  setFocus(f: Focus | null): void;
  toggleBreakpoint(k: keyof BreakpointToggles): void;
  progress: Progress;
  answer(experimentId: string, questionId: string, option: number): void;
  setWalkthrough(experimentId: string, step: number, dismissed: boolean): void;
}

let client: EngineClient | null = null;
const engine = (): EngineClient => (client ??= createEngineClient());

/** Replaces the engine client (tests and tools run the engine in-process instead of in a worker). */
export function setEngineClient(c: EngineClient): void {
  client = c;
}
let busy = false;
/** Steps requested while the engine was busy; replayed in order so no key press is lost. */
const queuedSteps: (1 | -1)[] = [];

/** Engine access for panels that need data beyond the cursor state (trajectories, comparison runs). */
export function engineRequest<R extends Reply['op']>(req: Request): Promise<Extract<Reply, { op: R }>> {
  return engine().request<R>(req);
}

export function activeBreakpoints(t: BreakpointToggles): Breakpoint[] {
  const out: Breakpoint[] = PATHOLOGIES.filter((p) => t[p.id]).map((p) => p.breakpoint);
  if (t.lossPlateau) out.push({ type: 'lossPlateau', minImprovement: 1e-4 });
  if (t.gradInit) out.push({ type: 'kind', kinds: ['GRAD_INIT'] });
  return out;
}

/**
 * Server rendering (static figures, tests) reads a zustand store's initial state as its snapshot. Calling
 * this makes it read the current state instead, so a static render shows the screen as it is now.
 */
export function renderCurrentState(): void {
  for (const api of [...snapshotApis, ...predictionApis]) api.getInitialState = api.getState;
}
export const snapshotApis: { getInitialState: () => unknown; getState: () => unknown }[] = [];

export const useLab = create<LabState>((set, get, api) => {
  snapshotApis.push(api);
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
    mode: initialMode(),
    resets: 0,
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
    breakpoints: NO_BREAKPOINTS,
    progress: loadProgress(),

    async load(id) {
      const e = experimentById(id);
      const breakpoints: BreakpointToggles = { ...NO_BREAKPOINTS };
      for (const k of e.suggestedBreakpoints) breakpoints[k] = true;
      set({ experimentId: id, granularity: startingGranularity(e, get().mode), breakpoints });
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

    async resetExperiment() {
      const e = experimentById(get().experimentId);
      const breakpoints: BreakpointToggles = { ...NO_BREAKPOINTS };
      for (const k of e.suggestedBreakpoints) breakpoints[k] = true;
      usePredictions.getState().clearExperiment(e.id);
      const walk = get().progress.walkthrough[e.id];
      if (walk && walk.step !== 0) get().setWalkthrough(e.id, 0, walk.dismissed);
      set({
        playing: false,
        focus: null,
        hit: null,
        granularity: startingGranularity(e, get().mode),
        breakpoints,
        resets: get().resets + 1,
      });
      if (!get().header || JSON.stringify(get().config) !== JSON.stringify(e.config))
        await generate(e.config);
      else {
        await get().jump(-1);
        set({ prevExec: null });
      }
    },

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
    setMode: (m, remember = true) => {
      const e = experimentById(get().experimentId);
      // A step size the novice path does not offer falls back to the experiment's starting one; the cursor stays.
      const g = offeredGranularities(e, m).includes(get().granularity)
        ? get().granularity
        : startingGranularity(e, m);
      set({ mode: m, granularity: g, playing: false });
      if (remember)
        try {
          globalThis.localStorage?.setItem(MODE_KEY, m);
        } catch {
          // Storage unavailable (private window): the choice lasts for this page only.
        }
    },
    setFocus: (f) => set({ focus: f }),
    toggleBreakpoint: (k) => set({ breakpoints: { ...get().breakpoints, [k]: !get().breakpoints[k] } }),
  };
});

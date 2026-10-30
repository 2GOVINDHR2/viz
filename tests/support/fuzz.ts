/**
 * Invariant E (Fix Round 2b): seeded random sequences of UI actions on the real store, with invariants A–D
 * checked after every action. Actions are recorded as data, so a failing sequence can be kept as a
 * regression case (tests/fuzz/regressions.json) and replayed exactly.
 */
import type { Activation } from '../../src/core/layers/model';
import type { Granularity } from '../../src/core/npm/stats';
import {
  addHiddenLayer,
  MAX_HIDDEN,
  removeHiddenLayer,
  setHiddenActivation,
  setHiddenWidth,
  setStartingValue,
  trainableParams,
} from '../../src/experiments/architecture';
import { experimentById } from '../../src/experiments/registry';
import { offeredGranularities, type Mode } from '../../src/experiments/surface';
import { NOVICE_SCREENS } from '../../src/ui/App';
import { startingValues } from '../../src/views/structure/ParamEditor';
import { paramValue, validateParam } from '../../src/experiments/params';
import { alternative, divergent, extreme, invalid } from './params';
import { allFocuses, checkA, checkB, checkC, checkD } from './invariants';
import { currentSource, lab } from './lab';

export type Action =
  | { op: 'add' }
  | { op: 'remove'; k: number }
  | { op: 'width'; k: number; units: number }
  | { op: 'activation'; k: number; activation: Activation }
  | { op: 'param'; name: string; index: number; value: number }
  | { op: 'granularity'; g: Granularity }
  | { op: 'step'; dir: 1 | -1; times: number }
  | { op: 'scrub'; at: number }
  | { op: 'select'; pick: number }
  | { op: 'mode'; mode: Mode }
  /** A typed entry in the field of declared parameter k (Fix Round 3): valid, divergent, extreme or invalid. */
  | { op: 'type'; k: number; raw: string }
  | { op: 'reset' };

export interface Sequence {
  experiment: string;
  seed: number;
  mode: Mode;
  actions: Action[];
}

export interface Failure extends Sequence {
  /** Index of the action after which an invariant first failed. */
  at: number;
  violations: string[];
}

/** mulberry32: a small seeded PRNG (the project never uses Math.random). */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACTIVATIONS: Activation[] = ['tanh', 'relu', 'sigmoid'];
const hidden = (): number => lab().config.model.layers.length - 1;
const onWorkbench = (): boolean => !(lab().mode === 'novice' && NOVICE_SCREENS[lab().experimentId]);

/** A random action that the current screen offers (an action whose control is not on the surface is not drawn). */
export function drawAction(rand: () => number): Action {
  const s = lab();
  const exp = experimentById(s.experimentId);
  const int = (n: number): number => Math.floor(rand() * n);
  const arch = exp.surface.architectureEditor && onWorkbench();
  const params = exp.surface.parameterEditor && onWorkbench();
  const menu: (() => Action | null)[] = [
    () => (arch && hidden() < MAX_HIDDEN ? { op: 'add' } : null),
    () => (arch && hidden() > 1 ? { op: 'remove', k: int(hidden()) } : null),
    () => (arch && hidden() > 0 ? { op: 'width', k: int(hidden()), units: 1 + int(8) } : null),
    () =>
      arch && hidden() > 0 ? { op: 'activation', k: int(hidden()), activation: ACTIVATIONS[int(3)] } : null,
    () => {
      if (!params) return null;
      const ps = trainableParams(s.config);
      const p = ps[int(ps.length)];
      const n = p.shape.reduce((a, b) => a * b, 1);
      return { op: 'param', name: p.name, index: int(n), value: Math.round((rand() * 4 - 2) * 100) / 100 };
    },
    () => {
      const g = offeredGranularities(exp, s.mode);
      return { op: 'granularity', g: g[int(g.length)] };
    },
    () => ({ op: 'step', dir: 1, times: 1 + int(5) }),
    () => ({ op: 'step', dir: -1, times: 1 + int(3) }),
    () => ({ op: 'scrub', at: rand() }),
    () => ({ op: 'select', pick: rand() }),
    () => ({ op: 'select', pick: rand() }),
    () => ({ op: 'mode', mode: s.mode === 'novice' ? 'expert' : 'novice' }),
    () => {
      if (!exp.editable.length) return null;
      const k = int(exp.editable.length);
      const p = exp.editable[k];
      const setting = { config: s.config, dataset: s.dataset, probes: s.probes };
      let alt: string | null;
      try {
        alt = String(alternative(setting, p, s.length / s.config.epochs));
      } catch {
        alt = null;
      }
      const pool = [alt, divergent(p), extreme(p), ...invalid(setting, p)].filter(
        (x): x is string => x !== null,
      );
      return { op: 'type', k, raw: pool[int(pool.length)] };
    },
    () => ({ op: 'reset' }),
  ];
  for (;;) {
    const a = menu[int(menu.length)]();
    if (a) return a;
  }
}

/** Applies one action through the store, as the corresponding control does. False when it no longer applies. */
export async function apply(a: Action): Promise<boolean> {
  const s = lab();
  const c = s.config;
  switch (a.op) {
    case 'add':
      if (hidden() >= MAX_HIDDEN) return false;
      await s.reconfigure(addHiddenLayer(c));
      return true;
    case 'remove':
      if (a.k >= hidden() || hidden() <= 1) return false;
      await s.reconfigure(removeHiddenLayer(c, a.k));
      return true;
    case 'width':
      if (a.k >= hidden()) return false;
      await s.reconfigure(setHiddenWidth(c, a.k, a.units));
      return true;
    case 'activation':
      if (a.k >= hidden()) return false;
      await s.reconfigure(setHiddenActivation(c, a.k, a.activation));
      return true;
    case 'param': {
      const n = s.header!.model.params.length;
      const current = startingValues(currentSource().range(0, n) as never)[a.name];
      if (!current || a.index >= current.length) return false;
      await s.reconfigure(setStartingValue(c, a.name, current, a.index, a.value));
      return true;
    }
    case 'granularity':
      if (!offeredGranularities(experimentById(s.experimentId), s.mode).includes(a.g)) return false;
      s.setGranularity(a.g);
      return true;
    case 'step':
      for (let i = 0; i < a.times; i++) await lab().step(a.dir);
      return true;
    case 'scrub':
      await s.jump(Math.min(s.length - 1, Math.floor(a.at * s.length)));
      return true;
    case 'select': {
      const all = allFocuses(s.header!);
      s.setFocus(all[Math.floor(a.pick * all.length)]);
      return true;
    }
    case 'mode':
      s.setMode(a.mode, false);
      return true;
    case 'reset':
      return true; // performed by checkD, which resets and then checks D
    case 'type':
      return typed(a);
  }
}

/** Violations found by the last typed entry (invariants G and H inside the fuzz). */
let typedViolations: string[] = [];

async function typed(a: Extract<Action, { op: 'type' }>): Promise<boolean> {
  const s = lab();
  const p = experimentById(s.experimentId).editable[a.k];
  if (!p) return false;
  const setting = { config: s.config, dataset: s.dataset, probes: s.probes };
  const before = JSON.stringify(setting);
  const r = validateParam(setting, p, a.raw, s.length / s.config.epochs);
  typedViolations = [];
  if (!r.ok) {
    // H: refused with a message naming what is valid, and nothing changes.
    if (!/\d|one of/.test(r.message)) typedViolations.push(`H: "${a.raw}" refused without a valid range`);
    if (JSON.stringify({ config: lab().config, dataset: lab().dataset, probes: lab().probes }) !== before)
      typedViolations.push(`H: refusing "${a.raw}" changed the setting`);
    return true;
  }
  await s.applySetting(p, r.value);
  // G: the store now holds exactly the typed value (the unit invariant reads it back from the trace).
  const now = paramValue({ config: lab().config, dataset: lab().dataset, probes: lab().probes }, p);
  if (
    String(now) !== String(r.value) &&
    Math.abs(Number(now) - Number(r.value)) > 1e-9 * Math.abs(Number(r.value))
  )
    typedViolations.push(`G: typed ${a.raw}, the setting holds ${now}`);
  return true;
}

const archOrParam = (a: Action): boolean => ['add', 'remove', 'width', 'activation', 'param'].includes(a.op);

/** Performs one action and checks A–D after it; null when the action no longer applies (on replay). */
/** Counts of actions performed and invariant checks made, for the report. */
export const stats = { actions: {} as Record<string, number>, A: 0, B: 0, C: 0, D: 0 };

async function act(a: Action, initialHash: string): Promise<string[] | null> {
  const v: string[] = [];
  stats.actions[a.op] = (stats.actions[a.op] ?? 0) + 1;
  if (a.op === 'reset') {
    v.push(...(await checkD(initialHash)));
    stats.D++;
  } else if (!(await apply(a))) return null;
  if (a.op === 'type') v.push(...typedViolations);
  if (lab().error) v.push(`error: ${lab().error}`);
  v.push(...checkA());
  stats.A++;
  const f = lab().focus;
  if (f && lab().exec) {
    v.push(...checkC([f]));
    stats.C++;
  }
  // B for the edited parameter or, after a structural change, the last hidden layer's weights.
  if (archOrParam(a)) {
    v.push(...checkB((names) => [a.op === 'param' ? a.name : (names.at(-4) ?? names[0])]));
    stats.B++;
  }
  return v;
}

async function begin(mode: Mode): Promise<void> {
  await lab().resetExperiment();
  lab().setMode(mode, false);
}

/** Replays a recorded sequence from the experiment's reset state; returns the first failure, or null. */
export async function runSequence(seq: Sequence, initialHash: string): Promise<Failure | null> {
  await begin(seq.mode);
  for (let i = 0; i < seq.actions.length; i++) {
    const v = await act(seq.actions[i], initialHash);
    if (v?.length) return { ...seq, at: i, violations: v };
  }
  return null;
}

/** Draws and runs a sequence of `length` actions against the live state, recording them as drawn. */
export async function fuzzOnce(
  experiment: string,
  seed: number,
  length: number,
  initialHash: string,
): Promise<Failure | null> {
  const rand = prng(seed);
  const seq: Sequence = { experiment, seed, mode: rand() < 0.5 ? 'novice' : 'expert', actions: [] };
  await begin(seq.mode);
  for (let i = 0; i < length; i++) {
    const a = drawAction(rand);
    seq.actions.push(a);
    const v = await act(a, initialHash);
    if (v?.length) return { ...seq, at: i, violations: v };
  }
  return null;
}

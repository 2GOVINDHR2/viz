/**
 * Learner progress (completed experiments, walkthrough position, self-check
 * answers), kept in localStorage. Storage can be unavailable (private
 * windows, blocked site data), so every access is guarded and the app works
 * without it — progress then lasts for the session only.
 */
import { EXPERIMENTS } from './registry';

export interface Progress {
  completed: string[];
  walkthrough: Record<string, { step: number; dismissed: boolean }>;
  /** Experiment id → question id → chosen option index. */
  answers: Record<string, Record<string, number>>;
}

const KEY = 'dl-vizlab.progress.v1';
export const emptyProgress = (): Progress => ({ completed: [], walkthrough: {}, answers: {} });

export function loadProgress(): Progress {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return emptyProgress();
    const p = JSON.parse(raw) as Partial<Progress>;
    return { completed: p.completed ?? [], walkthrough: p.walkthrough ?? {}, answers: p.answers ?? {} };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage unavailable: progress stays in memory for this session.
  }
}

/** An experiment is unlocked when it has no prerequisite or its prerequisite is completed. */
export function isUnlocked(id: string, p: Progress): boolean {
  const e = EXPERIMENTS.find((x) => x.id === id);
  if (!e || e.status !== 'available') return false;
  return e.prerequisite === null || p.completed.includes(e.prerequisite);
}

/** Completed = every self-check question answered correctly. */
export function isComplete(id: string, p: Progress): boolean {
  const e = EXPERIMENTS.find((x) => x.id === id);
  if (!e || e.selfCheck.length === 0) return false;
  const a = p.answers[id] ?? {};
  return e.selfCheck.every((q) => {
    const k = a[q.id];
    return k !== undefined && q.options[k]?.correct === true;
  });
}

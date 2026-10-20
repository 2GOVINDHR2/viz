/**
 * Predict–observe–explain state (Fix Round 2, §2.4). A prediction is one
 * click and may be revised until the outcome is observed; then it is
 * resolved and kept. Every prediction, revision and resolution goes to
 * telemetry (a no-op outside Study Mode). Predictions are never items of the
 * concept inventory.
 */
import { create } from 'zustand';
import { track } from '../../study/telemetry';

export interface PredictionRecord {
  choice: number;
  revisions: number;
  /** Set once the run has shown the outcome. */
  correct?: boolean;
  /** Index of the option that happened. */
  outcome?: number;
}

interface PredictState {
  records: Record<string, PredictionRecord>;
  choose(experiment: string, prediction: string, choice: number): void;
  resolve(experiment: string, prediction: string, outcome: number): void;
  /** Clears one prediction so it can be made again (e.g. for a new learning rate). */
  clear(experiment: string, prediction: string): void;
  /** Clears every prediction of one experiment (experiment reset). */
  clearExperiment(experiment: string): void;
}

/** Lets static renders read this store's current state (see renderCurrentState in ../store). */
export const predictionApis: { getInitialState: () => unknown; getState: () => unknown }[] = [];
const registerSnapshot = (api: { getInitialState: () => unknown; getState: () => unknown }): object => {
  predictionApis.push(api);
  return {};
};

const key = (experiment: string, prediction: string): string => `${experiment}/${prediction}`;

export const usePredictions = create<PredictState>((set, get, api) => ({
  ...registerSnapshot(api),
  records: {},
  choose(experiment, prediction, choice) {
    const k = key(experiment, prediction);
    const prev = get().records[k];
    if (prev?.correct !== undefined) return;
    if (prev?.choice === choice) return;
    track('predict', { experiment, prediction, choice, revised: prev !== undefined });
    set({
      records: { ...get().records, [k]: { choice, revisions: prev ? prev.revisions + 1 : 0 } },
    });
  },
  resolve(experiment, prediction, outcome) {
    const k = key(experiment, prediction);
    const prev = get().records[k];
    if (!prev || prev.correct !== undefined) return;
    const correct = prev.choice === outcome;
    track('reveal', { experiment, prediction, correct });
    set({ records: { ...get().records, [k]: { ...prev, correct, outcome } } });
  },
  clear(experiment, prediction) {
    const records = { ...get().records };
    delete records[key(experiment, prediction)];
    set({ records });
  },
  clearExperiment(experiment) {
    set({
      records: Object.fromEntries(
        Object.entries(get().records).filter(([k]) => !k.startsWith(`${experiment}/`)),
      ),
    });
  },
}));

export const predictionOf = (
  records: Record<string, PredictionRecord>,
  experiment: string,
  prediction: string,
): PredictionRecord | undefined => records[key(experiment, prediction)];

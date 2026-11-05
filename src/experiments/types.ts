/**
 * Declarative experiment definitions (P6). An experiment is data: a training
 * configuration, a dataset, and the teaching material around them. The app
 * renders every experiment with the same views; experiment-specific visuals
 * are chosen from a fixed set of reusable panels.
 */
import type { DatasetSpec } from '../core/engine/protocol';
import type { TrainConfig } from '../core/engine/session';
import type { Activation } from '../core/layers/model';
import type { LossName } from '../core/losses/losses';
import type { Granularity } from '../core/npm/stats';

export type BreakpointKey =
  'nonFinite' | 'vanishing' | 'exploding' | 'deadRelu' | 'lossIncrease' | 'lossPlateau' | 'gradInit';

/**
 * Things a learner may change (Fix Round 3, Part A). Numeric parameters accept a typed exact value; `options`
 * are presets offered beside the field, never a limit. Parameters marked `more` sit behind the experiment's
 * "More settings" disclosure, so a first view shows only the parameters the experiment leads with.
 * Every edit except a panel probe regenerates the run from the start (src/experiments/params.ts).
 */
export type EditableParam = (
  | { kind: 'learningRate'; options: number[] }
  | { kind: 'activation'; layer: number; options: Activation[] }
  | { kind: 'loss'; options: LossName[] }
  | { kind: 'hiddenUnits'; layer: number; options: number[] }
  | { kind: 'batchSize'; options: number[] }
  | {
      kind: 'initialValue';
      param: string;
      index: number;
      label: string;
      min: number;
      max: number;
      step: number;
    }
  /** Training passes over the data. */
  | { kind: 'epochs'; options?: number[] }
  /** The seed of the parameter initialiser and the shuffle. */
  | { kind: 'seed' }
  /** Number of hidden layers; added or removed layers copy the first hidden layer. */
  | { kind: 'depth'; options?: number[] }
  /** Multiplies every randomly initialised starting value (1 is the initialiser's own scale). */
  | { kind: 'initScale'; options?: number[] }
  /** A field of a convolution layer. */
  | { kind: 'conv'; layer: number; field: 'filters' | 'kernel' | 'stride' | 'padding' }
  /** One feature of one training example (the dataset is replaced by an explicit copy with this value). */
  | { kind: 'input'; example: number; feature: number; label: string }
  /** The target of one training example. */
  | { kind: 'target'; example: number; label: string }
  /** A value read by a panel only, not by training: the loss calculator's ŷ and y, a compared learning rate. */
  | { kind: 'probe'; id: string; label: string; initial: number; min?: number; max?: number }
) & {
  /** Behind "More settings" on the workbench (closed in novice mode). */
  more?: boolean;
  /** The learner-facing label, where the default (paramLabel) uses a term the experiment has not taught yet. */
  label?: string;
};

/**
 * What the network canvas may write beside its nodes and edges (Fix Round 5, 1.4; ADR-071): a node's value, its
 * bias, its error signal (the gradient ∂ℓ/∂z or ∂ℓ/∂a), and the overlay showing how far each weight moved. An
 * experiment declares the ones its lesson needs; anything undeclared is not drawn (invariant A).
 */
export type CanvasAnnotation = 'value' | 'bias' | 'errorSignal' | 'weightChange';
export const ALL_ANNOTATIONS: readonly CanvasAnnotation[] = ['value', 'bias', 'errorSignal', 'weightChange'];

export type PanelId = 'activation' | 'lossCompare' | 'surface' | 'lrCompare';

/** Walkthrough actions the app can perform for the learner ("Show me"). */
export type WalkAction =
  | { type: 'granularity'; granularity: Granularity }
  | { type: 'jump'; to: 'start' | 'end' }
  | { type: 'runToKind'; kind: string }
  | { type: 'epochEnd'; epoch: number }
  | { type: 'step'; count: number }
  | { type: 'runToBreakpoint' }
  /** Applies edits from the experiment's `editable` list (by index) and regenerates the run. */
  | { type: 'edit'; edits: { param: number; value: number | string }[] };

export interface WalkStep {
  text: string;
  action?: WalkAction;
  /** Label of the "Show me" button; defaults to a description of the action. */
  actionLabel?: string;
}

export interface SelfCheck {
  id: string;
  question: string;
  /**
   * Answerable only after the learner has run the training to its end with the experiment's own settings
   * (Fix Round 4, B2). Until then the options are shown but disabled, with a note saying why.
   */
  afterRun?: boolean;
  options: { text: string; correct?: boolean; feedback: string }[];
}

export interface Experiment {
  id: string;
  /** Position in the curriculum, e.g. "1" or "D1". */
  number: string;
  track: 'core' | 'diagnostic';
  title: string;
  objective: string;
  /** The experiment that must be completed first, or null. */
  prerequisite: string | null;
  intro: string;
  config: TrainConfig;
  dataset: DatasetSpec;
  defaultGranularity: Granularity;
  /**
   * The declared surface (Fix Round 2, §2.2 principle 5): the step sizes and
   * structural controls this experiment offers. Anything not declared does not
   * render. Expert mode adds every step size; it never adds the architecture
   * editor to an experiment that does not declare it.
   */
  surface: {
    /** Step sizes offered on the novice path, in curriculum order (src/experiments/surface.ts). */
    granularities: Granularity[];
    /** Step size a novice screen starts with, if not the experiment's default. */
    start?: Granularity;
    /** The structure view's layer editor (add/remove hidden layers, widths, activations). */
    architectureEditor: boolean;
    /**
     * The starting-weights editor: every trainable parameter of the current model, including those of
     * layers the learner adds, is editable (Fix Round 2b, defect 1).
     */
    parameterEditor: boolean;
    /**
     * The expert trace view: the run's instructions as a list, with filter and search (Fix Round 4, D1–D2), and
     * landmarks on the position slider (D3). Declared for experiment 1 in this round.
     */
    traceView?: boolean;
    /**
     * The canvas annotations this experiment draws (default: all). Experiments 1–5 teach the forward pass, loss and
     * descent before backpropagation, so they draw no gradients (Fix Round 5, 1.4).
     */
    annotations?: readonly CanvasAnnotation[];
    /**
     * The guided screen built on the shared template (Fix Round 5, Part 4; ADR-073): the key parameter's index in
     * `editable`, its extra Going-deeper items, and controls its observation renders. Its controls are generated
     * from this (src/experiments/guided.ts).
     */
    guided?: { primary: number; deeper: string[]; observe: string[] };
    /** The controls of the purpose-built novice screen, if the experiment has one (src/experiments/controls.ts). */
    noviceControls?: { always: string[]; conditional: string[] };
  };
  suggestedBreakpoints: BreakpointKey[];
  editable: EditableParam[];
  panels: PanelId[];
  walkthrough: WalkStep[];
  selfCheck: SelfCheck[];
  /** 'planned' experiments are listed but cannot be opened yet. */
  status: 'available' | 'planned';
}

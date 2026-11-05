/**
 * The seven guided screens built on the shared template (Fix Round 5, Part 4; ADR-073): experiments 2, 3, 4, 7, 8,
 * D1 and D2. Each supplies only what differs: its question, its key parameter, its prediction and how the two runs
 * decide it, what to watch, and the bridge to the next experiment. Every outcome is computed from the finished runs'
 * own numbers; none is scripted.
 */
import type { Experiment } from '../../experiments/types';
import { num } from '../../explain/format';
import { ConvView } from '../../views/execution/ConvView';
import { NetworkView } from '../../views/execution/NetworkView';
import {
  ActivationCompare,
  ActivationThumb,
  activationDescription,
  LossCompareWithCalculator,
  slopeLesson,
  SurfacePanel,
} from '../../views/panels/Panels';
import { TrainingView } from '../../views/training/TrainingView';
import { chartItem, compareNumber, GuidedScreen, type GuidedSpec, type RunSummary } from './Guided';

const LOSS_NAME: Record<string, string> = { bce: 'cross-entropy', mse: 'squared error' };
const CHANGE = ['lower', 'about the same', 'higher'];
const RIGHT = ['more of them right', 'about the same', 'fewer of them right'];
const pct = (a: number | null): string => (a === null ? 'not measured' : `${num(a * 100)}%`);
/** Compares the share of examples wrong, so that "lower" (index 0) means more right. */
const compareRight = (b: RunSummary, a: RunSummary): number =>
  compareNumber(1 - (b.finalAccuracy ?? 0), 1 - (a.finalAccuracy ?? 0), false);

const levelsOf = (exp: Experiment) => exp.surface.granularities;

function network(): GuidedSpec['observe'] {
  return (s) => (
    <>
      <NetworkView
        header={s.header!}
        exec={s.exec}
        focus={s.focus}
        onFocus={s.setFocus}
        annotations={['value', 'bias']}
        modeIndicator={false}
      />
      <p className="small legend-note">
        Each circle is a neuron; its fill shows its response, blue for positive and orange for negative,
        stronger for larger. A dot (·) means it has not been worked out yet for this example. The circles on
        the left are the example’s inputs, top to bottom: feature 1, feature 2. The layer being worked on is
        outlined.
      </p>
    </>
  );
}

export const ACTIVATIONS_SPEC = (exp: Experiment): GuidedSpec => ({
  question:
    'A neuron adds up its inputs and then responds. How it responds is a choice: three common ones are drawn below. Does the choice change how well it learns?',
  primary: 0,
  primaryTitle: 'How the neuron responds',
  preset: (v) => ({
    label: (
      <>
        <ActivationThumb name={String(v)} /> {String(v)}
      </>
    ),
    description: activationDescription(String(v)),
  }),
  predict: {
    question: (from, to, n) =>
      `Compared with ${from}, after ${n} passes with ${to} the neuron’s overall error will be…`,
    options: CHANGE,
    outcome: (b, a) => compareNumber(b.finalLoss, a.finalLoss, false),
    why: (o, b, a) =>
      `With ${b.value} the error ended at ${num(b.finalLoss)}; with ${a.value} it ended at ${num(a.finalLoss)}. ` +
      (o === 2
        ? 'Where a curve is flat, the corrections that drive learning are multiplied by almost nothing, so learning stalls.'
        : o === 0
          ? 'Where a curve is steep, corrections pass through at full strength, so the weight keeps learning.'
          : 'Over this range of totals the two curves are steep enough for learning to reach the same place.'),
  },
  observe: (s) => <ActivationCompare header={s.header!} exec={s.exec} />,
  observeLabel: 'The three responses',
  lesson: (s) => <p className="lesson-text">{slopeLesson(s.header!, s.exec)}</p>,
  intro: 'Nothing has been calculated yet. Press “Next” to send the first example into the neuron.',
  levels: levelsOf(exp),
  watchLabel: '▶ Watch it learn',
  deeper: (s) => [
    chartItem(s, 'How far off the neuron was after every pass, to compare the choices over time.'),
  ],
  handoff:
    'One neuron can only draw one straight boundary. What happens when neurons are arranged in layers, each feeding the next? Experiment 3: forward propagation.',
});

export const FORWARD_SPEC = (exp: Experiment): GuidedSpec => ({
  question:
    'In a network, each layer turns the previous layer’s responses into its own. Step one layer at a time and watch the answer being built. Does adding neurons to the hidden layer help?',
  primary: 0,
  primaryTitle: 'Neurons in the hidden layer',
  preset: (v) => ({ label: `${v} ${v === 1 ? 'neuron' : 'neurons'}` }),
  predict: {
    question: (from, to, n) =>
      `Compared with ${from} hidden ${from === 1 ? 'neuron' : 'neurons'}, after ${n} passes with ${to} the network will get…`,
    options: RIGHT,
    outcome: compareRight,
    why: (_o, b, a) =>
      `With ${b.value} it was right on ${pct(b.finalAccuracy)} of the examples; with ${a.value}, on ${pct(a.finalAccuracy)}. More neurons let the hidden layer describe more shapes, but only if the data needs them.`,
  },
  observe: network(),
  observeLabel: 'The network',
  intro: 'Nothing has been calculated yet. Press “Next” to work out the first layer for the first example.',
  levels: levelsOf(exp),
  deeper: (s) => [
    chartItem(s, 'How far off the network was after every pass, and the shape it has learned.'),
  ],
  handoff:
    'The network produces an answer; how do we measure how wrong that answer is, so that it can be improved? Experiment 4: loss functions.',
});

export const LOSS_SPEC = (exp: Experiment): GuidedSpec => ({
  question:
    'To improve, a network needs a number for how wrong each guess is. There is more than one way to count it. Does the way we count change what the network learns?',
  primary: 0,
  primaryTitle: 'How mistakes are counted',
  preset: (v) => ({
    label: LOSS_NAME[String(v)] ?? String(v),
    description:
      String(v) === 'bce'
        ? 'punishes a confident wrong answer very hard'
        : 'punishes in proportion to the gap, squared',
  }),
  predict: {
    question: (from, to, n) =>
      `Compared with counting by ${LOSS_NAME[String(from)]}, after ${n} passes counting by ${LOSS_NAME[String(to)]} the network will get…`,
    options: RIGHT,
    outcome: compareRight,
    why: (_o, b, a) =>
      `Counting by ${LOSS_NAME[String(b.value)]} it was right on ${pct(b.finalAccuracy)}; by ${LOSS_NAME[String(a.value)]}, on ${pct(a.finalAccuracy)}. The two counts disagree most about confident wrong guesses (the right of the chart for a target of 0): cross-entropy rises without limit there, squared error never above 1.`,
  },
  observe: (s) => {
    const last = s.header!.model.layers.at(-1)!.name;
    const q = s.exec?.sample?.layers[last]?.a?.data[0];
    const t = s.exec?.sample?.y.data[0];
    return (
      <>
        <p className="strip" aria-label="Prediction and target">
          {q === undefined || t === undefined
            ? 'No guess yet for this example.'
            : `This example: the network guesses ${num(q)}; the right answer is ${num(t)}.`}
        </p>
        <LossCompareWithCalculator header={s.header!} exec={s.exec} />
      </>
    );
  },
  observeLabel: 'How wrong is this guess?',
  intro: 'Nothing has been calculated yet. Press “Next” until the network makes its first guess.',
  levels: levelsOf(exp),
  deeper: (s) => [
    chartItem(s, 'How far off the network was after every pass, counted the way the run counts it.'),
  ],
  invite: 'Pick the other way of counting: you will be asked to predict what it does first.',
  handoff:
    'Now there is a number for how wrong the network is. How does it use that number to get better, one step at a time? Experiment 5: gradient descent.',
});

export const XOR_SPEC = (exp: Experiment): GuidedSpec => ({
  question:
    'Four points, two classes, arranged so that no single straight line can separate them. How many hidden neurons does a network need to get all four right?',
  primary: 0,
  primaryTitle: 'Neurons in the hidden layer',
  preset: (v) => ({ label: `${v} ${v === 1 ? 'neuron' : 'neurons'}` }),
  predict: {
    question: (_from, to, n) =>
      `With ${to} hidden ${to === 1 ? 'neuron' : 'neurons'}, after ${n} passes, will the network get all four points right?`,
    options: ['yes, all four', 'no, not all four'],
    outcome: (_b, a) => (a.finalAccuracy === 1 ? 0 : 1),
    why: (o, _b, a) =>
      `It was right on ${pct(a.finalAccuracy)} of the four points. ` +
      (o === 0
        ? 'Each hidden neuron draws one line; with enough of them the output combines the lines into a region no single line could make.'
        : 'One hidden neuron draws one line, and one line cannot separate these points. Even with more neurons, a run can stall from an unlucky start.'),
  },
  observe: network(),
  observeLabel: 'The network',
  intro: 'Nothing has been calculated yet. Press “Next” to send the first of the four points through.',
  levels: levelsOf(exp),
  deeper: (s) => [
    chartItem(s, 'The regions the network has drawn, and how far off it was after every pass.'),
  ],
  handoff:
    'Dense layers treat every input separately. For an image, where neighbouring pixels belong together, is there a better way? Experiment 8: a network for images.',
});

export const CNN_SPEC = (exp: Experiment): GuidedSpec => ({
  question:
    'A network for images slides small pattern-detectors across each picture, then decides which digit it shows. How big a step should it take when it learns?',
  primary: 1,
  primaryTitle: 'Step size when learning',
  preset: (v) => ({ label: String(v) }),
  predict: {
    question: (from, to, n) =>
      `Compared with a step size of ${from}, after ${n} ${n === 1 ? 'pass' : 'passes'} with ${to} the network will get…`,
    options: RIGHT,
    outcome: compareRight,
    why: (_o, b, a) =>
      `With ${b.value} it was right on ${pct(b.finalAccuracy)} of the test digits; with ${a.value}, on ${pct(a.finalAccuracy)}. Too small a step and a few passes are not enough; too large and the pattern-detectors overshoot.`,
  },
  observe: (s) => (
    <ConvView header={s.header!} exec={s.exec} focus={s.focus} onFocus={s.setFocus} modeIndicator={false} />
  ),
  observeLabel: 'The image and its pattern-detectors',
  intro: 'Nothing has been calculated yet. Press “Next” to load the first digit.',
  levels: levelsOf(exp),
  deeper: (s) => [chartItem(s, 'How far off, and how often right, after every pass.')],
  handoff:
    'Deeper networks can learn more, but the corrections must travel back through every layer. What happens to them on the way? Experiment D1: vanishing gradients.',
});

export const VANISHING_SPEC = (exp: Experiment): GuidedSpec => ({
  question:
    'In a deep network, each layer passes its correction back to the layer before. Does the correction survive the trip to the first layer?',
  primary: 0,
  primaryTitle: 'How every neuron responds',
  preset: (v) => ({
    label: (
      <>
        <ActivationThumb name={String(v)} /> {String(v)}
      </>
    ),
    description: activationDescription(String(v)),
  }),
  predict: {
    question: (_from, to) =>
      `With ${to} in every layer, in the first pass the correction reaching the first layer, compared with the last layer’s, will be…`,
    options: ['far smaller (less than a tenth)', 'about as large', 'far larger (more than ten times)'],
    outcome: (_b, a) => (a.gradRatio === null ? 1 : a.gradRatio < 0.1 ? 0 : a.gradRatio > 10 ? 2 : 1),
    why: (_o, _b, a) =>
      `In the first pass the first layer’s correction was ${a.gradRatio === null ? 'not measured' : `${num(a.gradRatio)} times`} the last layer’s. Each layer multiplies the correction by its curve’s steepness on the way back; the sigmoid is never steeper than 0.25, so after several layers almost nothing is left.`,
  },
  observe: (s) => (
    <TrainingView
      guided
      header={s.header!}
      exec={s.exec}
      epochs={s.epochs}
      onJumpToEpochEnd={(e) => void s.jump(s.header!.epochStarts[e + 1] - 1)}
    />
  ),
  observeLabel: 'How large the corrections are, layer by layer',
  intro:
    'Nothing has been calculated yet. Press “Next” to run the first pass and fill in the first column of the map.',
  levels: levelsOf(exp),
  handoff:
    'Corrections can also grow instead of shrinking, when the steps are too large. What does that look like? Experiment D2: learning-rate pathology.',
});

export const LR_SPEC = (exp: Experiment): GuidedSpec => ({
  question:
    'Descent takes steps downhill on the error. What happens when the steps are far too small, or too large to land?',
  primary: 0,
  primaryTitle: 'Step size: the learning rate η',
  preset: (v) => ({ label: `η = ${v}` }),
  predict: {
    question: (from, to, n) =>
      `Compared with η = ${from}, after ${n} passes with η = ${to} the error will be…`,
    options: ['lower', 'about the same', 'higher', 'it blows up (grows without limit)'],
    outcome: (b, a) => compareNumber(b.finalLoss, a.finalLoss, true),
    why: (o, b, a) =>
      `With η = ${b.value} the error ended at ${num(b.finalLoss)}; with η = ${a.value}, at ${Number.isFinite(a.finalLoss) ? num(a.finalLoss) : 'not a number: it blew up'}. ` +
      (o === 3
        ? 'Each step overshoots the bottom of the valley by more than it started, so the next step is larger still.'
        : 'A step too small crawls; a step slightly too large zig-zags across the valley but can still settle.'),
  },
  observe: (s) => <SurfacePanel header={s.header!} exec={s.exec} />,
  observeLabel: 'The error landscape',
  intro: 'Nothing has been calculated yet. Press “Next” to take the first step.',
  levels: levelsOf(exp),
  watchLabel: '▶ Watch it walk',
  deeper: (s) => [chartItem(s, 'The error after every pass: falling, flat, or growing without limit.')],
  handoff:
    'That is the whole training cycle: guess, measure, correct, repeat. Open the full workbench to see every step of it, one operation at a time.',
});

const make = (spec: (e: Experiment) => GuidedSpec) =>
  function Screen({ exp }: { exp: Experiment }) {
    return <GuidedScreen exp={exp} spec={spec(exp)} />;
  };

export const ActivationsScreen = make(ACTIVATIONS_SPEC);
export const ForwardScreen = make(FORWARD_SPEC);
export const LossScreen = make(LOSS_SPEC);
export const XorScreen = make(XOR_SPEC);
export const CnnScreen = make(CNN_SPEC);
export const VanishingScreen = make(VANISHING_SPEC);
export const LrScreen = make(LR_SPEC);

/** The specs by experiment id, so tests can read each screen's narration (Fix Round 5, Part 4). */
export const GUIDED_SPECS: Record<string, (e: Experiment) => GuidedSpec> = {
  activations: ACTIVATIONS_SPEC,
  'forward-propagation': FORWARD_SPEC,
  loss: LOSS_SPEC,
  'xor-mlp': XOR_SPEC,
  'cnn-mnist': CNN_SPEC,
  'vanishing-gradients': VANISHING_SPEC,
  'lr-pathology': LR_SPEC,
};

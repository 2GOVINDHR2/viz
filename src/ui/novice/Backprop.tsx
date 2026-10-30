/**
 * Novice screen, experiment 6 — back-propagation (Fix Round 2, §2.6-6), the
 * pedagogical centrepiece. One path through the chain rule at a time,
 * backwards: the learner follows one weight, and each factor of its gradient
 * appears when the backward pass computes it. The product of the factors is
 * shown next to the engine's own value for that gradient, so the chain rule
 * is checked, not asserted. Phase stepping unlocks here.
 */
import katex from 'katex';
import { useMemo, useRef } from 'react';
import type { TraceHeader } from '../../core/npm/ir';
import type { ExecState } from '../../core/npm/state';
import { applyEdit, editValue } from '../../experiments/edits';
import type { Experiment } from '../../experiments/types';
import { num } from '../../explain/format';
import { NetworkView } from '../../views/execution/NetworkView';
import { BoundInspector } from '../BoundInspector';
import { TrainingView } from '../../views/training/TrainingView';
import type { Focus } from '../../views/focus';
import { useLab } from '../store';
import { TryItField } from '../components/Guide';
import { ParamEditor } from '../../views/structure/ParamEditor';
import { useStartingValues } from '../useStartingValues';
import {
  GoingDeeper,
  Handoff,
  NoviceShell,
  Prediction,
  Reveal,
  StepBar,
  useResolve,
  type PredictionSpec,
  PassedOnTheWay,
} from './common';
import { predictionOf, usePredictions } from './state';

const PUSH: PredictionSpec = {
  id: 'push',
  question: 'This example will push the weight you are following…',
  options: ['up', 'down', 'hardly at all'],
};

/** The weight being followed: the focused edge, else the first weight into the first hidden neuron. */
export function followed(focus: Focus | null): { layer: string; i: number; j: number } {
  return focus?.kind === 'edge'
    ? { layer: focus.layer, i: focus.i, j: focus.j }
    : { layer: 'L1', i: 0, j: 0 };
}

export interface ChainFactor {
  label: string;
  value: number | null;
  /** The backward step that produces it, in words. */
  from: string;
}

/**
 * The factors of ∂ℓ/∂w for the followed weight, read from the trace state.
 * Output layer L2 has one unit; for a weight of L1 (input i → hidden j) the chain is
 * δ_out · W²_j · (slope of hidden j) · x_i; for a weight of L2 it is δ_out · a¹_j.
 */
export function chainOf(
  header: TraceHeader,
  exec: ExecState | null,
  w: { layer: string; i: number; j: number },
): { factors: ChainFactor[]; engine: number | null } {
  // The chain belongs to one example: once the batch update starts, the weights it multiplied by have changed.
  const inExample = exec?.current?.path.sample !== null && exec?.current?.path.sample !== undefined;
  const s = inExample ? exec?.sample : undefined;
  const L1 = s?.layers.L1;
  const L2 = s?.layers.L2;
  const H = header.model.layers[0].outShape[0];
  const at = (t: { data: ArrayLike<number> } | undefined, k: number): number | null => (t ? t.data[k] : null);
  const deltaOut: ChainFactor = {
    label: 'error signal at the output: how fast the loss changes as the output neuron’s sum changes',
    value: at(L2?.gradZ, 0),
    from: 'the backward pass through the output neuron',
  };
  if (w.layer === 'L2') {
    return {
      factors: [
        deltaOut,
        {
          label: `hidden neuron ${w.i + 1}’s output, a`,
          value: L2?.gradW ? at(L1?.a, w.i) : null,
          from: 'the weight-gradient step of the output layer',
        },
      ],
      engine: at(L2?.gradW, w.i),
    };
  }
  const gA = at(L1?.gradA, w.j);
  const gZ = at(L1?.gradZ, w.j);
  return {
    factors: [
      deltaOut,
      {
        label: `weight from hidden neuron ${w.j + 1} to the output`,
        value: gA === null ? null : (exec?.params['L2.W']?.value.data[w.j] ?? null),
        from: 'sending the error back along the output layer’s weights',
      },
      {
        label: `slope of hidden neuron ${w.j + 1}’s activation at its z`,
        value: gA !== null && gZ !== null && gA !== 0 ? gZ / gA : null,
        from: 'the backward pass through the hidden neurons',
      },
      {
        label: `input ${w.i + 1}, x`,
        value: L1?.gradW ? at(s?.x, w.i) : null,
        from: 'the weight-gradient step of the hidden layer',
      },
    ],
    engine: at(L1?.gradW, w.i * H + w.j),
  };
}

export function narrateBackprop(exec: ExecState | null): string {
  const ins = exec?.current;
  if (!ins) return 'Press “Next” to run the first example forward through the network.';
  const layer =
    ins.path.layer === 'L1' ? 'the hidden layer' : ins.path.layer === 'L2' ? 'the output layer' : '';
  const s = exec.sample;
  switch (ins.path.phase) {
    case 'init':
      return 'Setting up: every weight and bias gets its starting value.';
    case 'forward':
      return ins.kind === 'LOAD_INPUT'
        ? `Example ${s ? s.datasetIndex + 1 : ''}: two inputs go in; the right answer is ${s ? num(s.y.data[0]) : '·'}.`
        : `Forward pass: ${layer} computes its outputs from the layer before it.`;
    case 'loss':
      return `The network answered ${s?.layers.L2?.a ? num(s.layers.L2.a.data[0]) : '·'}; the right answer is ${s ? num(s.y.data[0]) : '·'}. Loss for this example: ${s?.loss === undefined ? '·' : num(s.loss)}.`;
    case 'backward':
      switch (ins.kind) {
        case 'GRAD_INIT':
          return 'The backward pass starts at the loss: how much does the loss change if the answer changes?';
        case 'GRAD_ACTIVATE':
          return `Back through the activations of ${layer}: multiply by each neuron’s slope (one link of the chain).`;
        case 'GRAD_BIAS':
          return `The biases of ${layer} get their gradient: the error signal of their own neuron.`;
        case 'GRAD_MATMUL_W':
          return `The weights of ${layer} get their gradients: (the input they carry) × (the error signal of the neuron they feed).`;
        case 'GRAD_MATMUL_X':
          return `The error is sent back along ${layer}’s weights to the layer before — this is what makes it “back”-propagation.`;
        default:
          return `${layer ? `${layer[0].toUpperCase()}${layer.slice(1)}` : 'This layer'} has finished its part of the backward pass.`;
      }
    case 'update':
      return 'Update: after the whole batch, each weight moves by −η × its gradient averaged over the batch.';
    default:
      return 'Between examples.';
  }
}

function Tex({ src }: { src: string }) {
  const html = useMemo(() => katex.renderToString(src, { throwOnError: false, displayMode: true }), [src]);
  return (
    <div
      className="tex"
      role="group"
      tabIndex={0}
      aria-label={src}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function BackpropScreen({ exp }: { exp: Experiment }) {
  const s = useLab();
  const starting = useStartingValues(s.header);
  const w = followed(s.focus);
  const live = s.header ? chainOf(s.header, s.exec, w) : null;
  const complete = (c: typeof live): boolean => !!c && c.factors.every((f) => f.value !== null);
  // Whole-phase steps land on the start of each phase, where this example's factors are not computed yet, and
  // the update follows the backward pass: so the last completed chain stays on show, labelled with its
  // example, until the current example computes its own first factor (cold review, E6-S3-u1/E6-S5-d1).
  const key = `${w.layer}:${w.i}:${w.j}`;
  const last = useRef<{ key: string; example: number; chain: NonNullable<typeof live> } | null>(null);
  if (complete(live) && s.exec?.sample)
    last.current = { key, example: s.exec.sample.datasetIndex + 1, chain: live! };
  if (last.current && (last.current.key !== key || s.cursor < 0)) last.current = null;
  const started = !!live && live.factors.some((f) => f.value !== null);
  const kept = !started && last.current ? last.current : null;
  const chain = kept ? kept.chain : live;
  const product = complete(chain) ? chain!.factors.reduce((p, f) => p * (f.value as number), 1) : null;
  const g = live?.engine ?? null;
  const shownGrad = chain?.engine ?? null;
  // The outcome is observed once this example's gradient for the followed weight exists.
  const layerGrads = s.exec?.sample?.layers[w.layer]?.gradW;
  let outcome: number | null = null;
  if (g !== null && layerGrads) {
    const max = Math.max(1e-12, ...Array.from(layerGrads.data, Math.abs));
    outcome = Math.abs(g) < 0.02 * max ? 2 : g < 0 ? 0 : 1;
  }
  useResolve(exp, PUSH, outcome);
  const records = usePredictions((p) => p.records);
  const rec = predictionOf(records, exp.id, PUSH.id);
  const resolved = rec?.correct !== undefined;
  // The explanation of a resolved prediction keeps the gradient it was resolved with.
  const seen = useRef<number | null>(null);
  if (g !== null && outcome !== null && !resolved) seen.current = g;
  const gShown = g ?? seen.current;
  const outShown = outcome ?? rec?.outcome ?? null;
  const name =
    w.layer === 'L1'
      ? `the weight from input ${w.i + 1} to hidden neuron ${w.j + 1}`
      : `the weight from hidden neuron ${w.i + 1} to the output`;

  return (
    <NoviceShell
      exp={exp}
      question="The network gets an example a little wrong. Which of its weights are to blame, and by how much? Follow the error backwards, one step at a time."
    >
      <div className="novice-grid">
        <section className="panel novice-controls" aria-label="Your settings">
          <h3>Follow one weight</h3>
          <p className="small">
            You are following <strong>{name}</strong>. Click any line in the network to follow a different
            weight.
          </p>
          {!resolved && !layerGrads && (
            <Prediction
              exp={exp}
              spec={PUSH}
              hint="Predict before the backward pass reaches this weight. The update moves a weight by −η × its gradient."
            />
          )}
          {!resolved && layerGrads && !rec && (
            <p className="small" role="status">
              This example’s gradients are already computed. Step on to the next example to make a prediction.
            </p>
          )}
          {resolved && (
            <button
              data-control="predict-again"
              className="link"
              onClick={() => usePredictions.getState().clear(exp.id, PUSH.id)}
            >
              Predict again for another example or weight
            </button>
          )}
          {(resolved || layerGrads) && (
            <Reveal
              exp={exp}
              spec={PUSH}
              outcome={outcome}
              why={
                gShown === null
                  ? ''
                  : `For the example you predicted on, its gradient is ${num(gShown)}, so the update moves it by −η × ${num(gShown)}: ${outShown === 2 ? 'almost nothing compared with the other weights of its layer' : gShown < 0 ? 'up' : 'down'}. The sign comes from multiplying the factors on the right: the error at the output, the weights it travelled back along, the slope of each neuron on the way, and the input this weight carries.`
              }
            />
          )}
          <StepBar
            levels={['phase', 'layer', 'operation']}
            note="Start with whole phases; use smaller steps in the backward pass."
          />
        </section>
        <section className="panel novice-observe" aria-label="The network">
          {s.header ? (
            <NetworkView
              header={s.header}
              exec={s.exec}
              focus={{ kind: 'edge', ...w }}
              onFocus={(f) => f && s.setFocus(f)}
            />
          ) : (
            <p aria-busy="true">Running…</p>
          )}
          <p className="narration" aria-live="polite">
            {narrateBackprop(s.exec)}
          </p>
          <PassedOnTheWay />
          {chain && (
            <div className="chain" aria-label={`Chain rule for ${name}`}>
              <h3>
                The chain rule for {name},{' '}
                {kept ? `for example ${kept.example}, the last one worked back through` : 'for this example'}
              </h3>
              <ol>
                {chain.factors.map((f) => (
                  <li key={f.label} className={f.value === null ? 'pending' : 'known'}>
                    <span>{f.label}</span>{' '}
                    <span className="num">
                      {f.value === null ? `· (comes from ${f.from})` : num(f.value)}
                    </span>
                  </li>
                ))}
              </ol>
              <p>
                Multiply them: <strong className="num">{product === null ? '·' : num(product)}</strong>
                {shownGrad !== null && product !== null && (
                  <>
                    {' '}
                    — the engine’s gradient for this weight: <strong className="num">
                      {num(shownGrad)}
                    </strong>{' '}
                    {Math.abs(product - shownGrad) <= 1e-9 * Math.max(1, Math.abs(shownGrad))
                      ? '✓ the same'
                      : '(differs)'}
                  </>
                )}
              </p>
            </div>
          )}
        </section>
      </div>
      <GoingDeeper
        exp={exp}
        items={[
          {
            id: 'numbers',
            label: 'Show the numbers',
            render: () =>
              s.header ? (
                <BoundInspector
                  header={s.header}
                  exec={s.exec}
                  focus={{ kind: 'edge', ...w }}
                  onClear={() => s.setFocus(null)}
                />
              ) : null,
          },
          {
            id: 'maths',
            label: 'Show the maths',
            render: () => (
              <>
                <Tex src="\frac{\partial \ell}{\partial w^{1}_{ij}} = \underbrace{\frac{\partial \ell}{\partial z_{\text{out}}}}_{\text{output error}} \cdot w^{2}_{j} \cdot \sigma'(z^{1}_{j}) \cdot x_i" />
                <Tex src="w \leftarrow w - \eta \cdot \frac{1}{B}\sum_{\text{batch}} \frac{\partial \ell}{\partial w}" />
              </>
            ),
          },
          {
            id: 'activation',
            label: 'Try another activation',
            why: 'The slope of the hidden neurons is one factor of every chain: a different activation changes it.',
            render: () => (
              <label className="try-row">
                Hidden activation{' '}
                <select
                  data-control="deeper:activation-select"
                  value={String(editValue(s.config, exp.editable[0]))}
                  disabled={s.generating}
                  onChange={(e) => void s.reconfigure(applyEdit(s.config, exp.editable[0], e.target.value))}
                >
                  {exp.editable[0].kind === 'activation' &&
                    exp.editable[0].options.map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
            ),
          },
          {
            id: 'settings',
            label: 'Change the weights, the example and the learning rate',
            why: 'Every gradient here depends on the starting weights, the example and its target; the learning rate scales the update.',
            render: () => (
              <>
                {exp.editable.slice(1).map((p, i) => (
                  <TryItField key={i + 1} param={p} k={i + 1} />
                ))}
                {s.header && (
                  <ParamEditor
                    header={s.header}
                    config={s.config}
                    starting={starting}
                    busy={s.generating}
                    onApply={(c) => void s.reconfigure(c)}
                  />
                )}
              </>
            ),
          },
          {
            id: 'second-view',
            label: 'Add the training charts',
            why: 'Every example’s gradients add up over the run: the loss and accuracy per pass show the result.',
            render: () =>
              s.header ? (
                <TrainingView
                  header={s.header}
                  exec={s.exec}
                  epochs={s.epochs}
                  onJumpToEpochEnd={(e) => void s.jump(s.header!.epochStarts[e + 1] - 1)}
                />
              ) : null,
          },
        ]}
      />
      <Handoff text="Back-propagation gives every weight its gradient, however deep it sits. Experiment 7 asks: can a network with a hidden layer learn something a single neuron never can — XOR?" />
    </NoviceShell>
  );
}

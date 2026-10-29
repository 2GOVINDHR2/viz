/**
 * Novice screen, experiment 5 — gradient descent (Fix Round 2, §2.6-5).
 * One view: the loss surface over (w, b) with the path the parameters take.
 * The learning rate is the first control; each new value is predicted before
 * it runs. Batch size arrives second, with the batch-size steps of Fix
 * Round 1, and its own prediction: how many steps one pass makes.
 */
import katex from 'katex';
import { useEffect, useMemo, useState } from 'react';
import type { ExecState } from '../../core/npm/state';
import { applyEdit, editValue } from '../../experiments/edits';
import type { Experiment } from '../../experiments/types';
import { num } from '../../explain/format';
import { SurfacePanel } from '../../views/panels/Panels';
import { TrainingView } from '../../views/training/TrainingView';
import { useLab } from '../store';
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
import { paramPresets, validateParam } from '../../experiments/params';
import { ParamField } from '../components/ParamField';
import { TryItField } from '../components/Guide';

const optionsOf = (exp: Experiment, k: number): number[] => paramPresets(exp.editable[k]) as number[];

const LR_OPTIONS = ['lower', 'about the same', 'higher', 'it blows up (grows without limit)'];

/** How a run's final loss compares with the previous run's (indices into LR_OPTIONS). */
export function compareLoss(first: number, before: number, after: number): number {
  if (!Number.isFinite(after) || after > 10 * first) return 3;
  if (Math.abs(after - before) <= 0.1 * Math.max(after, before) + 0.005) return 1;
  return after < before ? 0 : 2;
}

export function narrateGradientDescent(exec: ExecState | null, batchSize: number): string {
  const ins = exec?.current;
  if (!ins) return 'The line starts at w = −1.5, b = 1.5: a bad fit. Press “Next” to take the first step.';
  const w = exec.params['L1.W']?.value.data[0];
  const b = exec.params['L1.b']?.value.data[0];
  const where = w === undefined || b === undefined ? '' : ` Now w = ${num(w)}, b = ${num(b)}.`;
  const s = exec.sample;
  switch (ins.kind) {
    case 'LOAD_INPUT':
    case 'MATMUL':
    case 'ADD_BIAS':
    case 'ACTIVATE':
    case 'FORWARD_LAYER_END':
    case 'COMPUTE_LOSS':
    case 'GRAD_INIT':
    case 'GRAD_ACTIVATE':
    case 'GRAD_BIAS':
    case 'GRAD_MATMUL_W':
    case 'BACKWARD_LAYER_END':
      return s
        ? `Point ${s.datasetIndex + 1}: x = ${num(s.x.data[0])}, the line says ${s.layers.L1?.a ? num(s.layers.L1.a.data[0]) : '·'}, the right value is ${num(s.y.data[0])}. Its squared error is ${s.loss === undefined ? '·' : num(s.loss)}; its gradient is kept until the batch is complete.`
        : 'Working through the points of this batch.';
    case 'LOSS_REDUCE':
    case 'GRAD_ACCUMULATE':
    case 'COMPUTE_UPDATE':
      return `The gradients of the ${batchSize} points in this batch are averaged: that average says which way is downhill.`;
    case 'APPLY_UPDATE':
    case 'BATCH_END': {
      // The update rule with this step's own numbers, from the trace (w ← w − η·∂L/∂w).
      const u = exec.updates['L1.W'];
      const lr = Number(ins.meta.lr ?? NaN);
      const rule =
        u?.before && u.after && u.grad
          ? ` For w: gradient ${num(u.grad.data[0])}, so w moves by −η × ${num(u.grad.data[0])} = ${num(u.after.data[0] - u.before.data[0])}, from ${num(u.before.data[0])} to ${num(u.after.data[0])}${Number.isFinite(lr) ? ` (η = ${lr})` : ''}.`
          : '';
      return `One step: each parameter moved by −η × its averaged gradient, downhill on the loss.${rule}${exec.batchLoss === undefined ? '' : ` Loss on this batch: ${num(exec.batchLoss)}.`}`;
    }
    case 'EVAL_BEGIN':
    case 'EVAL_END':
    case 'EPOCH_END':
      return `End of a full pass over the 50 points.${where}${exec.lastEval ? ` Loss over all points: ${num(exec.lastEval.loss)}.` : ''}`;
    default:
      return `Setting up the run.${where}`;
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

export function GradientDescentScreen({ exp }: { exp: Experiment }) {
  const s = useLab();
  const records = usePredictions((p) => p.records);
  const lrNow = Number(editValue(s.config, exp.editable[0]));
  const bNow = Number(editValue(s.config, exp.editable[1]));
  const finalLoss = s.epochs.at(-1)?.evalLoss ?? null;
  const firstLoss = s.epochs[0]?.evalLoss ?? null;
  const ready = !!s.header && !s.generating && finalLoss !== null && firstLoss !== null;

  // Learning rate: a new value waits for a prediction, then runs as a trial against the current one.
  const [staged, setStaged] = useState<number | null>(null);
  const [trial, setTrial] = useState<{ from: number; to: number; loss: number; first: number } | null>(null);
  const pair = staged !== null ? { from: lrNow, to: staged } : trial;
  const lrSpec: PredictionSpec | null = pair
    ? {
        id: `lr-${pair.from}-${pair.to}`,
        question: `Compared with η = ${pair.from}, after ${s.config.epochs} passes with η = ${pair.to} the loss will be…`,
        options: LR_OPTIONS,
      }
    : null;
  const lrRec = lrSpec ? predictionOf(records, exp.id, lrSpec.id) : undefined;
  const setting = { config: s.config, dataset: s.dataset, probes: s.probes };
  const stageLr = (v: number): void => {
    if (v === lrNow) return setStaged(null);
    usePredictions.getState().clear(exp.id, `lr-${lrNow}-${v}`);
    setTrial(null);
    setStaged(v);
  };
  useEffect(() => {
    if (staged === null || !lrRec || !ready || finalLoss === null || firstLoss === null) return;
    setTrial({ from: lrNow, to: staged, loss: finalLoss, first: firstLoss });
    setStaged(null);
    void s.reconfigure(applyEdit(useLab.getState().config, exp.editable[0], staged));
  }, [staged, lrRec, ready, finalLoss, firstLoss, lrNow, s, exp]);
  const lrOutcome =
    trial && staged === null && ready && lrNow === trial.to && finalLoss !== null
      ? compareLoss(trial.first, trial.loss, finalLoss)
      : null;
  useResolve(exp, lrSpec ?? { id: 'lr-none', question: '', options: LR_OPTIONS }, lrOutcome);

  // Batch size: the second control, offered once a learning-rate prediction has been resolved.
  const anyLrResolved = Object.entries(records).some(
    ([k, r]) => k.startsWith(`${exp.id}/lr-`) && r.correct !== undefined,
  );
  const [showBatch, setShowBatch] = useState(false);
  const [bStaged, setBStaged] = useState<number | null>(null);
  const bTarget = bStaged ?? bNow;
  const counts = [...new Set([1, Math.ceil(50 / bTarget), 50])];
  const bSpec: PredictionSpec = {
    id: `batch-${bTarget}`,
    question: `With batches of ${bTarget} points, one full pass over the 50 points makes…`,
    options: counts.map((n) => (n === 1 ? '1 step' : `${n} steps`)),
  };
  const bRec = predictionOf(records, exp.id, bSpec.id);
  const stageBatch = (v: number): void => {
    if (v === bNow) return setBStaged(null);
    usePredictions.getState().clear(exp.id, `batch-${v}`);
    setBStaged(v);
  };
  useEffect(() => {
    if (bStaged === null || !bRec || !ready) return;
    setBStaged(null);
    void s.reconfigure(applyEdit(useLab.getState().config, exp.editable[1], bStaged));
  }, [bStaged, bRec, ready, s, exp]);
  const steps = s.epochs[0]?.batchLosses.length ?? null;
  const bIdx = steps === null ? -1 : counts.indexOf(steps);
  const bOutcome = bStaged === null && bRec && ready && bIdx >= 0 ? bIdx : null;
  useResolve(exp, bSpec, bOutcome);

  return (
    <NoviceShell
      exp={exp}
      question="How does a model find the best straight line through 50 points? It starts with a bad line and walks downhill on its loss, one step at a time. How big should each step be?"
    >
      <div className="novice-grid">
        <section className="panel novice-controls" aria-label="Your settings">
          <h3>Step size: the learning rate η</h3>
          <div className="seg" role="radiogroup" aria-label="Learning rate">
            {optionsOf(exp, 0).map((v) => (
              <button
                data-control="lr"
                key={v}
                role="radio"
                aria-checked={(staged ?? lrNow) === v}
                className={(staged ?? lrNow) === v ? 'on' : ''}
                disabled={s.generating}
                onClick={() => stageLr(v)}
              >
                η = {v}
              </button>
            ))}
          </div>
          {/* Any learning rate, typed exactly; divergent ones included (Fix Round 3, A4 row 5). */}
          <ParamField
            param={exp.editable[0]}
            control="lr-typed"
            label="…or type any learning rate η"
            value={staged ?? lrNow}
            disabled={s.generating}
            validate={(raw) => validateParam(setting, exp.editable[0], raw)}
            onApply={(v) => stageLr(Number(v))}
          />
          {staged !== null && lrSpec && (
            <Prediction
              exp={exp}
              spec={lrSpec}
              hint="Choose one: the run with the new learning rate starts as soon as you do."
            />
          )}
          {lrSpec && staged === null && trial && (
            <Reveal
              exp={exp}
              spec={lrSpec}
              outcome={lrOutcome}
              why={
                lrOutcome === 3
                  ? `Each step moves the parameters by η × the gradient. With η = ${lrNow} every step overshoots the bottom of the valley by more than it started, so the next gradient is larger, and the next step larger still: the loss grows without limit.`
                  : lrOutcome === 2
                    ? `With η = ${lrNow} each step is so small that ${s.config.epochs} passes are not enough to reach the bottom of the valley.`
                    : `Both learning rates reach the bottom of the valley within ${s.config.epochs} passes; look at the path to see how differently they get there (a large η zig-zags across the valley).`
              }
            />
          )}
          {staged === null && !trial && (
            <p className="small muted">
              Pick a different learning rate: you will be asked to predict what it does first.
            </p>
          )}
          {anyLrResolved && !showBatch && (
            <button data-control="batch-open" className="link" onClick={() => setShowBatch(true)}>
              ▸ A second control: the batch size
            </button>
          )}
          {showBatch && (
            <div className="second-control">
              <h3>How many points per step: the batch size B</h3>
              <p className="small">{exp.walkthrough[4]?.text}</p>
              <div className="seg" role="radiogroup" aria-label="Batch size">
                {optionsOf(exp, 1).map((v) => (
                  <button
                    data-control="batch"
                    key={v}
                    role="radio"
                    aria-checked={bTarget === v}
                    className={bTarget === v ? 'on' : ''}
                    disabled={s.generating}
                    onClick={() => stageBatch(v)}
                  >
                    B = {v}
                  </button>
                ))}
              </div>
              <ParamField
                param={exp.editable[1]}
                control="batch-typed"
                label="…or type any batch size B"
                value={bTarget}
                disabled={s.generating}
                validate={(raw) => validateParam(setting, exp.editable[1], raw)}
                onApply={(v) => stageBatch(Number(v))}
              />
              {bStaged !== null && (
                <Prediction exp={exp} spec={bSpec} hint="Choose one: the new run starts as soon as you do." />
              )}
              {bStaged === null && (
                <Reveal
                  exp={exp}
                  spec={bSpec}
                  outcome={bOutcome}
                  why={`There are 50 / B = ${Math.ceil(50 / bNow)} batches in one pass, and the parameters move once per batch. Each step now follows the averaged gradient of only ${bNow} points — a noisier estimate — so the path wobbles instead of heading straight downhill. ${exp.walkthrough[5]?.text ?? ''}`}
                />
              )}
            </div>
          )}
        </section>
        <section className="panel novice-observe" aria-label="The loss surface">
          {s.header ? <SurfacePanel header={s.header} exec={s.exec} /> : <p aria-busy="true">Running…</p>}
          <p className="narration" aria-live="polite">
            {narrateGradientDescent(s.exec, bNow)}
          </p>
          <PassedOnTheWay />
          <StepBar levels={['sample', 'batch']} />
          <div className="learn">
            <button
              data-control="play"
              disabled={!s.header || s.generating}
              onClick={() => s.setPlaying(!s.playing)}
            >
              {s.playing ? '❚❚ Pause' : '▶ Watch it walk'}
            </button>
            <button
              data-control="jump-end"
              disabled={!s.header || s.generating}
              onClick={() => void s.jump(s.length - 1)}
            >
              Jump to the end
            </button>
            {finalLoss !== null && (
              <span className="small">
                Loss after {s.config.epochs} passes with η = {lrNow}, B = {bNow}:{' '}
                <strong>{Number.isFinite(finalLoss) ? num(finalLoss) : 'not a number (it blew up)'}</strong>
              </span>
            )}
          </div>
        </section>
      </div>
      <GoingDeeper
        exp={exp}
        items={[
          {
            id: 'numbers',
            label: 'Show the numbers',
            render: () => (
              <table className="outputs">
                <caption>Loss over all 50 points after each pass</caption>
                <thead>
                  <tr>
                    <th scope="col">pass</th>
                    <th scope="col">steps in the pass</th>
                    <th scope="col">loss</th>
                  </tr>
                </thead>
                <tbody>
                  {s.epochs.slice(0, 12).map((e) => (
                    <tr key={e.epoch}>
                      <td>{e.epoch + 1}</td>
                      <td>{e.batchLosses.length}</td>
                      <td>{num(e.evalLoss)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ),
          },
          {
            id: 'maths',
            label: 'Show the maths',
            render: () => (
              <>
                <Tex src="L(w,b) = \frac{1}{B}\sum_{i \in \text{batch}} (w x_i + b - y_i)^2" />
                <Tex src="w \leftarrow w - \eta\,\frac{\partial L}{\partial w}, \qquad b \leftarrow b - \eta\,\frac{\partial L}{\partial b}" />
              </>
            ),
          },
          {
            id: 'settings',
            label: 'Change the starting point and the passes',
            why: 'Where descent starts, and how many passes it makes, change the path it takes.',
            render: () => (
              <>
                {exp.editable.slice(2).map((p, i) => (
                  <TryItField key={i + 2} param={p} k={i + 2} />
                ))}
              </>
            ),
          },
          {
            id: 'second-view',
            label: 'Add the loss-per-pass chart',
            why: 'A second picture of the same run: the loss after every pass, to see how fast it falls — or that it rises.',
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
      <Handoff text="The gradient told each parameter of this one-neuron model which way is downhill. But in a network with hidden neurons, how does a weight deep inside find out its share of the blame? Experiment 6: back-propagation." />
    </NoviceShell>
  );
}

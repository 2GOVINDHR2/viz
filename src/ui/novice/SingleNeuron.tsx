/**
 * Novice screen, experiment 1 — a single neuron (Fix Round 2, §2.6-1).
 * Two weights and a bias, and nothing else. The learner predicts what raising
 * the bias does, drags it, and sees all four outputs move together; then lets
 * the neuron learn AND. Vocabulary is limited to what this experiment
 * teaches: "error", never "loss"; no layers, activations or gradients.
 */
import katex from 'katex';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExecState } from '../../core/npm/state';
import { applyEdit, editValue } from '../../experiments/edits';
import type { Experiment } from '../../experiments/types';
import { num } from '../../explain/format';
import { illumination } from '../../views/illumination';
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
import { useFirstAndLastPass, type ExampleForward } from './trace';

const BIAS: PredictionSpec = {
  id: 'bias-up',
  question: 'If you make the bias b larger, the neuron’s four outputs will…',
  options: ['all go up', 'all go down', 'stay the same'],
};

/** One plain sentence for the instruction at the cursor, in this experiment's vocabulary. */
export function narrateSingleNeuron(exec: ExecState | null): string {
  const ins = exec?.current;
  if (!ins) return 'Nothing has happened yet. Press “Next” to start the first calculation.';
  const s = exec.sample;
  const L = s?.layers.L1;
  const v = (t: { data: Float64Array | Float32Array } | undefined): string => (t ? num(t.data[0]) : '·');
  const param = String(ins.meta.param ?? '');
  const what = param.endsWith('.b') ? 'bias b' : 'weights w₁, w₂';
  switch (ins.kind) {
    case 'INIT_PARAM':
      return `Setting up: the neuron starts with the ${what} you chose (${Array.from(ins.results.value.data).map(num).join(', ')}).`;
    case 'EPOCH_BEGIN':
      return 'A new pass over the four examples begins.';
    case 'BATCH_BEGIN':
      return 'The neuron is about to look at the four examples, one at a time.';
    case 'LOAD_INPUT':
      return `Next example: inputs x₁ = ${num(ins.results.x.data[0])}, x₂ = ${num(ins.results.x.data[1])}. The right answer is ${num(ins.results.y.data[0])}.`;
    case 'MATMUL':
      return `Weighted sum: w₁·x₁ + w₂·x₂ = ${v(L?.u)}.`;
    case 'ADD_BIAS':
      return `Add the bias: z = ${v(L?.u)} + b = ${v(L?.z)}.`;
    case 'ACTIVATE':
      return `Squash with the sigmoid: output = σ(z) = ${v(L?.a)}, always between 0 and 1. Above 0.5 counts as “yes”.`;
    case 'FORWARD_LAYER_END':
      return `The neuron’s answer for this example is ${v(L?.a)}.`;
    case 'COMPUTE_LOSS':
      return `Compare with the right answer: the error for this example is ${s?.loss === undefined ? '·' : num(s.loss)} (0 would be perfect).`;
    case 'APPLY_UPDATE':
      return `Learning: the neuron nudges its ${what} to reduce the error. New value${param.endsWith('.b') ? '' : 's'}: ${Array.from(ins.results.value.data).map(num).join(', ')}.`;
    case 'EVAL_BEGIN':
    case 'EVAL_END':
      return 'End of a pass: the neuron is checked on all four examples with its current weights and bias.';
    case 'EPOCH_END':
      return 'One pass over the four examples is complete.';
    case 'BATCH_END':
      return 'The neuron has seen all four examples and adjusted itself once.';
    default:
      // The working-out of how to adjust (taught in experiments 5 and 6).
      return 'Learning: the neuron works out which way to nudge its weights and bias to reduce the error. How it does this is the subject of experiments 5 and 6.';
  }
}

function NeuronPicture({ exec, w, b }: { exec: ExecState | null; w: number[]; b: number }) {
  const header = useLab((s) => s.header);
  const lit = header ? illumination(header, exec) : null;
  const x = exec?.sample?.x;
  const a = exec?.sample?.layers.L1?.a?.data[0];
  const mag = Math.max(1e-9, ...w.map(Math.abs));
  const ys = [60, 160];
  return (
    <svg viewBox="0 0 420 220" className="neuron-svg" role="img" aria-labelledby="np-t np-d">
      <title id="np-t">The neuron</title>
      <desc id="np-d">
        {`Inputs x₁ ${x ? `= ${num(x.data[0])}` : ''} and x₂ ${x ? `= ${num(x.data[1])}` : ''}; weights w₁ = ${num(w[0])}, w₂ = ${num(w[1])}; bias b = ${num(b)}; output ${a === undefined ? 'not yet computed' : num(a)}.`}
      </desc>
      {w.map((wi, i) => {
        const on = lit?.edges === 'L1';
        return (
          <g key={i} data-lit={on ? 'edges' : undefined} className={`edge-n${on ? ' active' : ''}`}>
            <line
              x1={70}
              y1={ys[i]}
              x2={250}
              y2={110}
              stroke={wi >= 0 ? 'var(--pos)' : 'var(--neg)'}
              strokeDasharray={wi >= 0 ? undefined : '6 4'}
              strokeWidth={1 + (6 * Math.abs(wi)) / mag}
            />
            <text x={150} y={ys[i] + (i ? 10 : -12)} className="small-label">
              w{i ? '₂' : '₁'} = {num(wi)}
            </text>
          </g>
        );
      })}
      {[0, 1].map((i) => {
        const on = lit?.input ?? false;
        return (
          <g key={i} data-lit={on ? 'input' : undefined} className={`node-n${on ? ' active' : ''}`}>
            <circle cx={45} cy={ys[i]} r={25} />
            <text x={45} y={ys[i] + 5} textAnchor="middle">
              {x ? num(x.data[i]) : `x${i ? '₂' : '₁'}`}
            </text>
          </g>
        );
      })}
      <g
        data-lit={lit && (lit.units.length || lit.bias) ? 'unit' : undefined}
        className={`node-n${lit && (lit.units.length || lit.bias) ? ' active' : ''}`}
      >
        <circle cx={280} cy={110} r={32} />
        <text x={280} y={106} textAnchor="middle" className="small-label">
          Σ + b
        </text>
        <text x={280} y={124} textAnchor="middle" className="small-label">
          then σ
        </text>
      </g>
      <text x={280} y={62} textAnchor="middle" className={`small-label${lit?.bias ? ' lit-text' : ''}`}>
        b = {num(b)}
      </text>
      <line x1={312} y1={110} x2={350} y2={110} stroke="var(--text)" strokeWidth={2} />
      <g data-lit={lit?.loss ? 'loss' : undefined} className={`node-n${lit?.loss ? ' active' : ''}`}>
        <rect x={352} y={88} width={62} height={44} rx={6} />
        <text x={383} y={115} textAnchor="middle">
          {a === undefined ? 'out' : num(a)}
        </text>
      </g>
    </svg>
  );
}

function OutputsTable({
  rows,
  caption,
  detail,
}: {
  rows: ExampleForward[];
  caption: string;
  detail?: boolean;
}) {
  return (
    <table className="outputs">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">x₁</th>
          <th scope="col">x₂</th>
          {detail && <th scope="col">weighted sum</th>}
          {detail && <th scope="col">z (sum + b)</th>}
          <th scope="col">output</th>
          <th scope="col">right answer</th>
          <th scope="col">
            says <span className="muted small">(yes if output &gt; 0.5)</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.index}>
            <td>{num(r.x[0])}</td>
            <td>{num(r.x[1])}</td>
            {detail && <td>{r.u === null ? '·' : num(r.u)}</td>}
            {detail && <td>{r.z === null ? '·' : num(r.z)}</td>}
            <td>
              <span
                className="bar"
                style={{ width: `${Math.round(60 * (r.a ?? 0))}px` }}
                aria-hidden="true"
              />{' '}
              {r.a === null ? '·' : num(r.a)}
            </td>
            <td>{num(r.y[0])}</td>
            <td>{r.a === null ? '·' : r.a > 0.5 ? 'yes' : 'no'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The four examples and the line w₁x₁ + w₂x₂ + b = 0 (output exactly 0.5), from the engine's current parameters. */
function DecisionLine({ w, b }: { w: number[]; b: number }) {
  const S = 220;
  const lo = -0.5;
  const hi = 1.5;
  const px = (v: number): number => ((v - lo) / (hi - lo)) * S;
  const py = (v: number): number => S - px(v);
  // Clip the line to the plotted square.
  const pts: [number, number][] = [];
  if (Math.abs(w[1]) > 1e-12) for (const x of [lo, hi]) pts.push([x, -(w[0] * x + b) / w[1]]);
  else if (Math.abs(w[0]) > 1e-12) for (const y of [lo, hi]) pts.push([-b / w[0], y]);
  const examples: [number, number, number][] = [
    [0, 0, 0],
    [0, 1, 0],
    [1, 0, 0],
    [1, 1, 1],
  ];
  return (
    <svg
      viewBox={`0 0 ${S} ${S}`}
      className="decision-svg"
      role="img"
      aria-label={`The four examples and the line where the output is 0.5: ${num(w[0])}·x₁ + ${num(w[1])}·x₂ + ${num(b)} = 0. Filled points have the right answer 1, open points 0.`}
    >
      <rect x={0} y={0} width={S} height={S} className="frame" />
      <clipPath id="dl-clip">
        <rect x={0} y={0} width={S} height={S} />
      </clipPath>
      {pts.length === 2 && (
        <line
          x1={px(pts[0][0])}
          y1={py(pts[0][1])}
          x2={px(pts[1][0])}
          y2={py(pts[1][1])}
          className="boundary"
          clipPath="url(#dl-clip)"
        />
      )}
      {examples.map(([x1, x2, y]) => (
        <g key={`${x1}${x2}`}>
          <circle cx={px(x1)} cy={py(x2)} r={8} className={y ? 'pt-one' : 'pt-zero'} />
          <text x={px(x1) + 12} y={py(x2) - 10} className="small-label">
            ({x1}, {x2})
          </text>
        </g>
      ))}
    </svg>
  );
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

export function SingleNeuronScreen({ exp }: { exp: Experiment }) {
  const s = useLab();
  const passes = useFirstAndLastPass(s.header);
  const [pending, setPending] = useState<Record<number, number>>({});
  const timer = useRef<number | undefined>(undefined);
  const values = exp.editable.map((e, k) => pending[k] ?? Number(editValue(s.config, e)));
  const w = [
    Number(s.exec?.params['L1.W']?.value.data[0] ?? values[0]),
    Number(s.exec?.params['L1.W']?.value.data[1] ?? values[1]),
  ];
  const b = Number(s.exec?.params['L1.b']?.value.data[0] ?? values[2]);

  // Sliders regenerate the run once the learner pauses, not on every intermediate value.
  const drag = (k: number, v: number): void => {
    setPending({ ...pending, [k]: v });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void s.reconfigure(applyEdit(useLab.getState().config, exp.editable[k], v));
      setPending({});
    }, 300);
  };

  // Prediction → observation: snapshot the outputs when the prediction is made; the outcome is
  // observed when the bias has changed and the new run's outputs have arrived.
  const records = usePredictions((p) => p.records);
  const rec = predictionOf(records, exp.id, BIAS.id);
  const biasNow = Number(editValue(s.config, exp.editable[2]));
  const [snap, setSnap] = useState<{ b: number; outs: number[] } | null>(null);
  useEffect(() => {
    if (rec && rec.correct === undefined && !snap && passes && !s.generating)
      setSnap({ b: biasNow, outs: passes.first.map((p) => p.a ?? 0) });
  }, [rec, snap, passes, biasNow, s.generating]);
  let outcome: number | null = null;
  if (snap && passes && !s.generating && biasNow > snap.b && passes.first.length === snap.outs.length) {
    const d = passes.first.map((p, i) => (p.a ?? 0) - snap.outs[i]);
    outcome = d.every((x) => x > 1e-12) ? 0 : d.every((x) => x < -1e-12) ? 1 : 2;
  }
  const lowered = snap !== null && outcome === null && biasNow < snap.b;
  useResolve(exp, BIAS, outcome);

  const trained = (s.exec?.completedEpochs ?? 0) >= s.config.epochs;
  const learnedAnd = passes?.last.every((r) => r.a !== null && r.a > 0.5 === (r.y[0] === 1)) ?? false;

  return (
    <NoviceShell
      exp={exp}
      question="Can one neuron learn AND — say “yes” only when both inputs are 1? Set its two weights and its bias, then let it learn."
    >
      <div className="novice-grid">
        <section className="panel novice-controls" aria-label="Your settings">
          <h3>Your settings</h3>
          {exp.editable.map((e, k) => {
            if (e.kind !== 'initialValue') return null;
            const id = `nv-${exp.id}-${k}`;
            return (
              <div key={id} className="try-row">
                <label htmlFor={id}>{['weight w₁', 'weight w₂', 'bias b'][k]}</label>
                <span className="slider">
                  <input
                    data-control={`slider:${k}`}
                    id={id}
                    type="range"
                    min={e.min}
                    max={e.max}
                    step={e.step}
                    value={values[k]}
                    onChange={(ev) => drag(k, Number(ev.target.value))}
                  />
                  <output htmlFor={id}>{values[k].toFixed(2)}</output>
                </span>
              </div>
            );
          })}
          <Prediction
            exp={exp}
            spec={BIAS}
            hint="Choose one, then drag the bias slider and watch the table."
          />
          {lowered && (
            <p className="small" role="status">
              You made b smaller. To test the prediction, make it larger than {num(snap.b)}.
            </p>
          )}
          <Reveal
            exp={exp}
            spec={BIAS}
            outcome={outcome}
            why="The bias is added to the weighted sum of every example, and the sigmoid always turns a bigger sum into a bigger output. So moving b up lifts all four outputs together, while a weight only matters for examples whose input for it is 1."
          />
        </section>
        <section className="panel novice-observe" aria-label="The neuron">
          <NeuronPicture exec={s.exec} w={w} b={b} />
          <p className="narration" aria-live="polite">
            {narrateSingleNeuron(s.exec)}
          </p>
          <PassedOnTheWay />
          <StepBar levels={['operation']} />
          {passes ? (
            <OutputsTable
              rows={passes.first}
              caption="With your settings: the neuron’s output for each example"
            />
          ) : (
            <p className="small muted" aria-busy="true">
              Running the neuron…
            </p>
          )}
          <div className="learn">
            <button
              data-control="learn"
              className="primary"
              disabled={!s.header || s.generating}
              onClick={() => void s.jump(s.length - 1)}
            >
              Let it learn
            </button>
            <span className="small muted">
              The neuron goes over the four examples {s.config.epochs} times, nudging its weights and bias a
              little each time to reduce its error.
            </span>
          </div>
          {trained && passes && (
            <>
              <OutputsTable rows={passes.last} caption="After learning (outputs during its last pass)" />
              <p className={`reveal ${learnedAnd ? 'right' : 'wrong'}`} role="status">
                {learnedAnd
                  ? '✓ It learned AND: “yes” only for (1, 1). The weights and bias it found draw a straight line that puts (1, 1) on one side and the other three on the other.'
                  : 'It has not learned AND from these starting settings in the time given. Try different starting values and let it learn again.'}
              </p>
            </>
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
              passes ? (
                <OutputsTable rows={passes.first} caption="Every value, with your settings" detail />
              ) : null,
          },
          {
            id: 'maths',
            label: 'Show the maths',
            render: () => (
              <>
                <Tex src="z = w_1 x_1 + w_2 x_2 + b" />
                <Tex src="\text{output} = \sigma(z) = \frac{1}{1 + e^{-z}}" />
              </>
            ),
          },
          {
            id: 'second-view',
            label: 'Add the decision line',
            why: 'A second picture of the same neuron: the four examples as points, and the line where its output is exactly 0.5. Everything on one side gets “yes”.',
            render: () => <DecisionLine w={w} b={b} />,
          },
        ]}
      />
      <Handoff text="One neuron squashes its sum with the sigmoid. Experiment 2 asks: what other squashing functions are there, and why does the choice matter?" />
    </NoviceShell>
  );
}

/**
 * Novice screen, experiment 1 — a single neuron (Fix Round 2, §2.6-1).
 * Two weights and a bias, and nothing else. The learner predicts what raising
 * the bias does, drags it, and sees all four outputs move together; then lets
 * the neuron learn AND. Vocabulary is limited to what this experiment
 * teaches: "error", never "loss"; no layers, activations or gradients.
 */
import katex from 'katex';
import { useEffect, useMemo, useState } from 'react';
import type { ExecState } from '../../core/npm/state';
import { applyEdit, editValue } from '../../experiments/edits';
import { TryItField } from '../components/Guide';
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
  if (!ins)
    return 'The training run has not started yet. Press “Next” to watch its first calculation, or “Let it learn” to run all of it.';
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

/** One example's forward computation, as the diagram shows it (C1, C2). */
interface DiagramRow {
  x: number[];
  /** The weights and bias the computation used. */
  w: number[];
  b: number;
  u: number | null;
  z: number | null;
  a: number | null;
  /** Where the values come from, for the caption. */
  source: string;
}

/** The weights and bias a pass used, read back from its own rows: u at (1, 0) is w₁, u at (0, 1) is w₂, z − u is b. */
export function passWeights(
  rows: ExampleForward[],
  fallback: { w: number[]; b: number },
): { w: number[]; b: number } {
  const at = (x1: number, x2: number) => rows.find((r) => r.x[0] === x1 && r.x[1] === x2);
  const e1 = at(1, 0);
  const e2 = at(0, 1);
  const any = rows.find((r) => r.u !== null && r.z !== null);
  if (!e1 || !e2 || e1.u === null || e2.u === null || !any) return fallback;
  return { w: [e1.u, e2.u], b: any.z! - any.u! };
}

const correctOf = (r: ExampleForward): boolean | null => (r.a === null ? null : r.a > 0.5 === (r.y[0] === 1));
export const score = (rows: ExampleForward[]): number => rows.filter((r) => correctOf(r) === true).length;

function NeuronPicture({
  exec,
  row,
  w,
  b,
}: {
  exec: ExecState | null;
  row: DiagramRow | null;
  w: number[];
  b: number;
}) {
  const header = useLab((s) => s.header);
  const lit = header ? illumination(header, exec) : null;
  // A table row drives the diagram (C1); otherwise the example the run is at, if any.
  const live = exec?.sample;
  const x = row?.x ?? (live ? Array.from(live.x.data) : null);
  const W = row?.w ?? w;
  const B = row?.b ?? b;
  const z = row ? row.z : (live?.layers.L1?.z?.data[0] ?? null);
  const a = row ? row.a : (live?.layers.L1?.a?.data[0] ?? null);
  const u = row ? row.u : (live?.layers.L1?.u?.data[0] ?? null);
  const mag = Math.max(1e-9, ...W.map(Math.abs));
  const ys = [60, 160];
  const v = (n: number | null | undefined): string => (n === null || n === undefined ? '·' : num(n));
  return (
    <figure className="neuron-figure">
      <svg viewBox="0 0 460 220" className="neuron-svg" role="img" aria-labelledby="np-t np-d">
        <title id="np-t">The neuron</title>
        <desc id="np-d">
          {`Inputs x₁ ${x ? `= ${num(x[0])}` : ''} and x₂ ${x ? `= ${num(x[1])}` : ''}; weights w₁ = ${num(W[0])}, w₂ = ${num(W[1])}; bias b = ${num(B)}; ${x ? `products ${num(W[0] * x[0])} and ${num(W[1] * x[1])}; ` : ''}sum plus bias z = ${v(z)}; output σ(z) = ${v(a)}.`}
        </desc>
        {W.map((wi, i) => {
          const on = lit?.edges === 'L1';
          return (
            <g key={i} data-lit={on ? 'edges' : undefined} className={`edge-n${on ? ' active' : ''}`}>
              <line
                x1={70}
                y1={ys[i]}
                x2={218}
                y2={110}
                stroke={wi >= 0 ? 'var(--pos)' : 'var(--neg)'}
                strokeDasharray={wi >= 0 ? undefined : '6 4'}
                strokeWidth={1 + (6 * Math.abs(wi)) / mag}
              />
              <text x={128} y={ys[i] + (i ? 18 : -14)} className="small-label">
                w{i ? '₂' : '₁'} = {num(wi)}
                {x ? `,  × ${num(x[i])} = ${num(wi * x[i])}` : ''}
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
                {x ? num(x[i]) : `x${i ? '₂' : '₁'}`}
              </text>
            </g>
          );
        })}
        {/* Stage 1 (C2): the weighted sum plus the bias. */}
        <g
          data-lit={lit && (lit.units.length || lit.bias) ? 'unit' : undefined}
          className={`node-n${lit && (lit.units.length || lit.bias) ? ' active' : ''}`}
          data-stage="sum"
        >
          <circle cx={250} cy={110} r={32} />
          <text x={250} y={104} textAnchor="middle" className="small-label">
            sum + b
          </text>
          <text x={250} y={122} textAnchor="middle">
            {v(z)}
          </text>
        </g>
        <text x={250} y={36} textAnchor="middle" className={`small-label${lit?.bias ? ' lit-text' : ''}`}>
          b = {num(B)}
          {u !== null && u !== undefined ? `  (sum ${num(u)})` : ''}
        </text>
        <line x1={282} y1={110} x2={316} y2={110} stroke="var(--text)" strokeWidth={2} />
        {/* Stage 2 (C2): the sigmoid squashes the sum into the output. */}
        <g
          data-lit={lit?.loss ? 'loss' : undefined}
          className={`node-n${lit?.loss ? ' active' : ''}`}
          data-stage="out"
        >
          <rect x={318} y={82} width={124} height={56} rx={8} />
          <text x={380} y={104} textAnchor="middle" className="small-label">
            σ squashes it to
          </text>
          <text x={380} y={124} textAnchor="middle">
            {v(a)}
            {a !== null && a !== undefined ? (a > 0.5 ? '  yes' : '  no') : ''}
          </text>
        </g>
      </svg>
      <figcaption className="small muted">
        {row ? `${row.source}. ` : ''}A solid line is a positive weight and a dashed line a negative one; the
        thicker the line, the larger the weight.
      </figcaption>
    </figure>
  );
}

function OutputsTable({
  rows,
  caption,
  detail,
  pinned,
  onHover,
  onPin,
}: {
  rows: ExampleForward[];
  caption: string;
  detail?: boolean;
  pinned?: number | null;
  onHover?: (i: number | null) => void;
  onPin?: (i: number | null) => void;
}) {
  const k = score(rows);
  return (
    <>
      <table className="outputs" onMouseLeave={() => onHover?.(null)}>
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
            {onPin && (
              <th scope="col">
                <span className="sr-only">Show in the diagram</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const ok = correctOf(r);
            return (
              <tr
                key={r.index}
                className={`${ok === false ? 'wrong-row' : ''}${pinned === i ? ' pinned' : ''}`}
                onMouseEnter={() => onHover?.(i)}
              >
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
                {/* Correct or not is said in words and a mark, never by colour alone (C3). */}
                <td>
                  {r.a === null ? '·' : r.a > 0.5 ? 'yes' : 'no'}
                  {ok !== null && <span className="mark">{ok ? ' ✓' : ' ✗ wrong'}</span>}
                </td>
                {onPin && (
                  <td>
                    <button
                      type="button"
                      className="link small"
                      data-control="row:pin"
                      aria-pressed={pinned === i}
                      onFocus={() => onHover?.(i)}
                      onBlur={() => onHover?.(null)}
                      onClick={() => onPin(pinned === i ? null : i)}
                    >
                      {pinned === i ? 'pinned' : 'show'}
                      <span className="sr-only">
                        {' '}
                        example ({num(r.x[0])}, {num(r.x[1])}) in the diagram
                      </span>
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {/* The goal, scored (C3). */}
      <p className="score" data-score={k}>
        Correct on{' '}
        <strong>
          {k} of {rows.length}
        </strong>
        {k === rows.length ? ': it says “yes” only for (1, 1).' : '.'}
      </p>
    </>
  );
}

/** Starting and final values of the three parameters, with the score before and after (C4, C7). */
function BeforeAfter({
  title,
  before,
  after,
  note,
}: {
  title: string;
  before: { values: number[]; correct: number };
  after: { values: number[]; correct: number };
  note?: string;
}) {
  const names = ['w₁', 'w₂', 'b'];
  return (
    <section className="before-after" aria-label={title}>
      <h4>{title}</h4>
      <table className="outputs">
        <thead>
          <tr>
            <th scope="col" />
            {names.map((n) => (
              <th key={n} scope="col">
                {n}
              </th>
            ))}
            <th scope="col">correct</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">before</th>
            {before.values.map((v, i) => (
              <td key={i}>{num(v)}</td>
            ))}
            <td>{before.correct} of 4</td>
          </tr>
          <tr>
            <th scope="row">after</th>
            {after.values.map((v, i) => (
              <td key={i}>{num(v)}</td>
            ))}
            <td>{after.correct} of 4</td>
          </tr>
        </tbody>
      </table>
      {note && <p className="small">{note}</p>}
    </section>
  );
}

/** One computation walked through with its numbers, before the learner changes anything (C6). */
function WorkedExample({
  row,
  w,
  b,
  onDone,
}: {
  row: ExampleForward;
  w: number[];
  b: number;
  onDone(): void;
}) {
  const p1 = w[0] * row.x[0];
  const p2 = w[1] * row.x[1];
  return (
    <section className="panel worked" aria-label="A worked example">
      <h3>
        A worked example: the neuron’s answer for x₁ = {num(row.x[0])}, x₂ = {num(row.x[1])}
      </h3>
      <ol>
        <li>
          Multiply each input by its weight: {num(row.x[0])} × {num(w[0])} = <strong>{num(p1)}</strong>, and{' '}
          {num(row.x[1])} × {num(w[1])} = <strong>{num(p2)}</strong>.
        </li>
        <li>
          Add them up: {num(p1)} + {num(p2)} = <strong>{row.u === null ? num(p1 + p2) : num(row.u)}</strong>.
        </li>
        <li>
          Add the bias b = {num(b)}: the sum is <strong>{row.z === null ? '·' : num(row.z)}</strong>.
        </li>
        <li>
          Squash it with the sigmoid σ, which turns any number into one between 0 and 1: σ(
          {row.z === null ? '·' : num(row.z)}) = <strong>{row.a === null ? '·' : num(row.a)}</strong>.
        </li>
        <li>
          Above 0.5 counts as “yes”, so the neuron says{' '}
          <strong>{row.a !== null && row.a > 0.5 ? 'yes' : 'no'}</strong>; the right answer for AND is{' '}
          {row.y[0] === 1 ? '“yes”' : '“no”'}.
        </li>
      </ol>
      <p className="small">
        The same four steps happen for every example. Now change the settings and watch them.
      </p>
      <button type="button" data-control="worked:dismiss" onClick={onDone}>
        Got it: let me try
      </button>
    </section>
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

/** The training-outcome prediction (B1): resolved only when the run reaches its end. */
export const TRAIN: PredictionSpec = {
  id: 'train-outcome',
  question: 'Once it has learned, on how many of the four examples will the neuron be right?',
  options: ['all four: “yes” only for (1, 1)', 'three of the four', 'two or fewer'],
};

/** Which option of TRAIN a final score is. */
export const trainOutcome = (correct: number): number => (correct === 4 ? 0 : correct === 3 ? 1 : 2);

/** A setting that solves AND, and why (C7). */
const SOLUTION = { values: [4, 4, -6] };

export function SingleNeuronScreen({ exp }: { exp: Experiment }) {
  const s = useLab();
  const passes = useFirstAndLastPass(s.header);
  const values = exp.editable.slice(0, 3).map((e) => Number(editValue(s.config, e)));
  const w = [
    Number(s.exec?.params['L1.W']?.value.data[0] ?? values[0]),
    Number(s.exec?.params['L1.W']?.value.data[1] ?? values[1]),
  ];
  const b = Number(s.exec?.params['L1.b']?.value.data[0] ?? values[2]);

  // Prediction 1, about the bias (B1 keeps it): resolved as soon as the bias is raised and the new run's outputs
  // arrive, because what it predicts is a property of the forward computation, not of learning.
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

  // The end of training, and nothing from it before then (A4).
  const trained = (s.exec?.completedEpochs ?? 0) >= s.config.epochs;
  const startCorrect = passes ? score(passes.first) : null;
  const finalAcc = trained ? (s.exec?.eval?.accuracy ?? null) : null;
  const finalCorrect = finalAcc === null || !passes ? null : Math.round(finalAcc * passes.first.length);
  const finalValues = trained ? [w[0], w[1], b] : null;

  // Prediction 2, about learning (B1): answerable before the run, resolved only when it completes.
  const trainRec = predictionOf(records, exp.id, TRAIN.id);
  useResolve(exp, TRAIN, finalCorrect === null ? null : trainOutcome(finalCorrect));

  // C8: every setting tried, with its score.
  const recordAttempt = s.recordAttempt;
  useEffect(() => {
    if (passes && !s.generating)
      recordAttempt({ values, correct: score(passes.first), of: passes.first.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passes, s.generating]);

  // C1: a table row drives the diagram; a click pins it.
  const [hover, setHover] = useState<{ table: 'first' | 'last'; i: number } | null>(null);
  const [pin, setPin] = useState<{ table: 'first' | 'last'; i: number } | null>(null);
  const shownRow = ((): DiagramRow | null => {
    const sel = hover ?? pin ?? (s.exec?.sample ? null : { table: 'first' as const, i: 0 });
    if (!sel || !passes) return null;
    const rows = sel.table === 'first' ? passes.first : passes.last;
    const r = rows[sel.i];
    if (!r) return null;
    const pw = passWeights(rows, { w: values.slice(0, 2), b: values[2] });
    return {
      ...r,
      ...pw,
      source:
        sel.table === 'first'
          ? `Example (${num(r.x[0])}, ${num(r.x[1])}) with your settings`
          : `Example (${num(r.x[0])}, ${num(r.x[1])}) during the last pass of learning`,
    };
  })();

  // C6 and C7.
  const worked = !s.deeper['worked-done'];
  const [solved, setSolved] = useState<{ values: number[]; correct: number } | null>(null);
  const applySolution = (): void => {
    setSolved({ values, correct: startCorrect ?? 0 });
    let c = s.config;
    SOLUTION.values.forEach((v, k) => (c = applyEdit(c, exp.editable[k], v)));
    void s.reconfigure(c);
  };
  const solutionArrived =
    solved && passes && !s.generating && values.every((v, k) => v === SOLUTION.values[k])
      ? score(passes.first)
      : null;

  return (
    <NoviceShell
      exp={exp}
      question="Can one neuron learn AND — say “yes” only when both inputs are 1? Set its two weights and its bias, then let it learn."
    >
      {worked && passes && passes.first[3] && (
        <WorkedExample
          row={passes.first[3]}
          w={values.slice(0, 2)}
          b={values[2]}
          onDone={() => s.setDeeper('worked-done', true)}
        />
      )}
      <div className="novice-grid">
        <section className="panel novice-controls" aria-label="Your settings">
          <h3>Your settings</h3>
          {/* Drag or type each value (Fix Round 3, A3): the slider and the field share one state. */}
          {exp.editable.slice(0, 3).map((e, k) => (
            <TryItField key={k} param={e} k={k} label={['weight w₁', 'weight w₂', 'bias b'][k]} />
          ))}
          <Prediction
            exp={exp}
            spec={BIAS}
            label="Prediction about the bias"
            hint="Choose one, then make the bias larger and watch the table."
          />
          {lowered && (
            <p className="small" role="status">
              You made b smaller. To test the prediction, make it larger than {num(snap.b)}.
            </p>
          )}
          <div className="solution">
            <button
              type="button"
              data-control="solution"
              disabled={!s.header || s.generating}
              onClick={applySolution}
            >
              Show me settings that work
            </button>
            {solved && solutionArrived !== null && (
              <BeforeAfter
                title="A working solution"
                before={solved}
                after={{ values: SOLUTION.values, correct: solutionArrived }}
                note="With w₁ = w₂ = 4 and b = −6, the sums for the four examples are −6, −2, −2 and +2. Only (1, 1) gets a positive sum, so only it gets an output above 0.5: AND."
              />
            )}
          </div>
          {s.attempts.length > 1 && (
            <section className="attempts" aria-label="Your attempts">
              <h4>Your attempts</h4>
              <ol>
                {s.attempts.map((a, k) => (
                  <li key={k}>
                    w₁ = {num(a.values[0])}, w₂ = {num(a.values[1])}, b = {num(a.values[2])}: correct on{' '}
                    {a.correct} of {a.of}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </section>
        <section className="panel novice-observe" aria-label="The neuron">
          <NeuronPicture exec={s.exec} row={shownRow} w={w} b={b} />
          <p className="narration" aria-live="polite">
            {narrateSingleNeuron(s.exec)}
          </p>
          <PassedOnTheWay />
          <StepBar levels={['operation']} />
          {passes ? (
            <OutputsTable
              rows={passes.first}
              caption="With your settings: the neuron’s output for each example (point at a row to see it in the diagram)"
              pinned={pin?.table === 'first' ? pin.i : null}
              onHover={(i) => setHover(i === null ? null : { table: 'first', i })}
              onPin={(i) => setPin(i === null ? null : { table: 'first', i })}
            />
          ) : (
            <p className="small muted" aria-busy="true">
              Running the neuron…
            </p>
          )}
          {/* The bias prediction's feedback sits beside the table that demonstrates it (C9). */}
          <Reveal
            exp={exp}
            spec={BIAS}
            outcome={outcome}
            why="The bias is added to the weighted sum of every example, and the sigmoid always turns a bigger sum into a bigger output. So moving b up lifts all four outputs together, while a weight only matters for examples whose input for it is 1."
          />
          {!trained && (
            <Prediction
              exp={exp}
              spec={TRAIN}
              label="Prediction about learning"
              hint={
                trainRec
                  ? 'Now let it learn: the answer comes when the run ends.'
                  : 'Choose one before you let it learn.'
              }
            />
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
              “Next” runs one calculation at a time, so you can watch each step; “Let it learn” runs all{' '}
              {s.config.epochs} passes over the four examples at once, nudging the weights and bias a little
              each time to reduce the error.
            </span>
          </div>
          {trained && passes && finalValues && finalCorrect !== null && startCorrect !== null && (
            <>
              <OutputsTable
                rows={passes.last}
                caption="After learning (outputs during its last pass)"
                pinned={pin?.table === 'last' ? pin.i : null}
                onHover={(i) => setHover(i === null ? null : { table: 'last', i })}
                onPin={(i) => setPin(i === null ? null : { table: 'last', i })}
              />
              <BeforeAfter
                title="What learning changed"
                before={{ values, correct: startCorrect }}
                after={{ values: finalValues, correct: finalCorrect }}
              />
              <Reveal
                exp={exp}
                spec={TRAIN}
                outcome={trainOutcome(finalCorrect)}
                why={
                  finalCorrect === 4
                    ? 'Learning moved all three numbers until the line where the output is 0.5 put (1, 1) on one side and the other three on the other.'
                    : 'From these starting settings, 60 passes were not enough to separate (1, 1) from the rest. Try other starting values, or “Show me settings that work”.'
                }
              />
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
          {
            id: 'settings',
            label: 'Change the examples',
            why: 'Type your own inputs for the four examples, or a different random seed, and the neuron learns from those instead.',
            render: () => (
              <div className="deeper-settings">
                {exp.editable.slice(3).map((e, i) => (
                  <TryItField key={i + 3} param={e} k={i + 3} />
                ))}
              </div>
            ),
          },
        ]}
      />
      <Handoff text="One neuron squashes its sum with the sigmoid. Experiment 2 asks: what other squashing functions are there, and why does the choice matter?" />
    </NoviceShell>
  );
}

/**
 * View B — Training State View.
 *
 * Everything shown is what the trace has recorded up to the cursor: completed
 * epochs' losses and accuracy, per-layer gradient magnitude over epochs (the
 * view that makes vanishing gradients visible), current weight and gradient
 * distributions, and — for 2-D data — the decision boundary from the latest
 * evaluation. Charts are clickable to move the cursor to the end of an epoch.
 */
import { scaleLinear } from 'd3-scale';
import { useEffect, useRef } from 'react';
import type { EpochSummary } from '../../core/engine/protocol';
import type { TraceHeader } from '../../core/npm/ir';
import type { ExecState } from '../../core/npm/state';
import type { Tensor } from '../../core/tensor/tensor';
import { num } from '../../explain/format';
import { valueFill } from '../execution/NetworkView';
import { Histogram, LineChart } from './charts';

export interface TrainingViewProps {
  header: TraceHeader;
  exec: ExecState | null;
  epochs: EpochSummary[];
  onJumpToEpochEnd(epoch: number): void;
}

/** Sequential single-hue scale for log gradient magnitude: light (small) → dark (large). */
const gradFill = scaleLinear<string>().domain([0, 1]).range(['#eef4fb', '#0b3d75']).clamp(true);

export function epochPosition(header: TraceHeader, cursor: number): number {
  const s = header.epochStarts;
  if (cursor < s[0]) return 0;
  for (let e = 0; e + 1 < s.length; e++)
    if (cursor < s[e + 1]) return e + (cursor - s[e] + 1) / (s[e + 1] - s[e]);
  return s.length - 1;
}

function GradientHeatmap({
  header,
  epochs,
  completed,
  onPick,
}: {
  header: TraceHeader;
  epochs: EpochSummary[];
  completed: number;
  onPick(e: number): void;
}) {
  const weights = header.model.params.map((p, k) => ({ p, k })).filter(({ p }) => p.role === 'weight');
  const E = epochs.length;
  const shown = epochs.slice(0, completed);
  const logs = shown.flatMap((s) => weights.map(({ k }) => Math.log10(Math.max(s.gradNorms[k], 1e-30))));
  const lo = logs.length ? Math.min(...logs) : 0;
  const hi = logs.length ? Math.max(...logs) : 1;
  const W = 340;
  const rowH = Math.min(22, Math.max(10, 120 / weights.length));
  const left = 46;
  const cw = (W - left - 8) / Math.max(E, 1);
  const H = weights.length * rowH + 30;
  const t = (v: number): number => (hi - lo < 1e-9 ? 0.5 : (Math.log10(Math.max(v, 1e-30)) - lo) / (hi - lo));
  return (
    <figure className="chart">
      <figcaption>Gradient magnitude per layer, by epoch</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Mean weight-gradient norm per layer for ${completed} completed epochs. Darker is larger, on a log scale from ${num(10 ** lo)} to ${num(10 ** hi)}.`}
      >
        {weights.map(({ p }, r) => (
          <text key={p.name} x={left - 4} y={r * rowH + rowH / 2 + 4} textAnchor="end" className="tick">
            {p.name.replace('.W', '')}
          </text>
        ))}
        {shown.map((s, e) =>
          weights.map(({ p, k }, r) => (
            <rect
              key={`${e}-${p.name}`}
              x={left + e * cw}
              y={r * rowH + 1}
              width={Math.max(cw - (cw > 4 ? 1 : 0), 0.5)}
              height={rowH - 2}
              fill={gradFill(t(s.gradNorms[k]))}
              className="pickable"
              onClick={() => onPick(e)}
            >
              <title>{`Epoch ${e + 1}, ${p.name}: ‖∂L/∂W‖ = ${num(s.gradNorms[k])}`}</title>
            </rect>
          )),
        )}
        <text x={left} y={H - 14} className="tick">
          epoch 1
        </text>
        <text x={W - 8} y={H - 14} textAnchor="end" className="tick">
          epoch {E}
        </text>
        <defs>
          <linearGradient id="gradLegend">
            <stop offset="0" stopColor={gradFill(0)} />
            <stop offset="1" stopColor={gradFill(1)} />
          </linearGradient>
        </defs>
        <rect
          x={left + 60}
          y={H - 10}
          width={110}
          height={7}
          fill="url(#gradLegend)"
          stroke="var(--border)"
        />
        <text x={left + 56} y={H - 3} textAnchor="end" className="tick">
          {logs.length ? num(10 ** lo) : ''}
        </text>
        <text x={left + 174} y={H - 3} className="tick">
          {logs.length ? num(10 ** hi) : ''}
        </text>
      </svg>
      <p className="small muted">
        Rows are layers (input at the top). A pale top row under a dark bottom row is the signature of
        vanishing gradients.
      </p>
    </figure>
  );
}

/** Marching-squares segments of the p = 0.5 contour on a res × res grid. */
function contour(values: ArrayLike<number>, res: number): [number, number, number, number][] {
  const segs: [number, number, number, number][] = [];
  const v = (r: number, c: number): number => values[r * res + c] - 0.5;
  const lerp = (a: number, b: number): number => a / (a - b);
  for (let r = 0; r + 1 < res; r++)
    for (let c = 0; c + 1 < res; c++) {
      const a = v(r, c),
        b = v(r, c + 1),
        d = v(r + 1, c),
        e = v(r + 1, c + 1);
      const pts: [number, number][] = [];
      if (a * b < 0) pts.push([c + lerp(a, b), r]);
      if (b * e < 0) pts.push([c + 1, r + lerp(b, e)]);
      if (d * e < 0) pts.push([c + lerp(d, e), r + 1]);
      if (a * d < 0) pts.push([c, r + lerp(a, d)]);
      if (pts.length >= 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
      if (pts.length === 4) segs.push([pts[2][0], pts[2][1], pts[3][0], pts[3][1]]);
    }
  return segs;
}

function DecisionBoundary({ header, exec }: { header: TraceHeader; exec: ExecState | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ev = exec?.lastEval;
  const b: Tensor | null = ev?.boundary ?? null;
  const bounds = ev?.bounds;
  const S = 220;
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx || !b) return;
    const res = b.shape[0];
    const cell = S / res;
    for (let r = 0; r < res; r++)
      for (let c = 0; c < res; c++) {
        ctx.fillStyle = valueFill(2 * b.data[r * res + c] - 1);
        ctx.globalAlpha = 0.55;
        // Row 0 is the smallest y; draw it at the bottom.
        ctx.fillRect(c * cell, S - (r + 1) * cell, cell + 0.5, cell + 0.5);
      }
    ctx.globalAlpha = 1;
  }, [b]);
  const xs = header.dataset.xs;
  const ys = header.dataset.ys;
  if (header.model.inputShape.length !== 1 || header.model.inputShape[0] !== 2 || !xs || !ys) return null;
  const k = ys.shape[1];
  const cls = (i: number): number =>
    k === 1 ? (ys.data[i] >= 0.5 ? 1 : 0) : Array.from(ys.data.slice(i * k, i * k + k)).indexOf(1);
  const toPx = (x: number, y: number): [number, number] =>
    bounds
      ? [((x - bounds[0]) / (bounds[1] - bounds[0])) * S, S - ((y - bounds[2]) / (bounds[3] - bounds[2])) * S]
      : [0, 0];
  const res = b?.shape[0] ?? 1;
  const segs = b ? contour(b.data, res) : [];
  const current = exec?.sample?.datasetIndex;
  return (
    <figure className="chart boundary">
      <figcaption>Decision boundary {ev ? `after epoch ${ev.epoch + 1}` : ''}</figcaption>
      {!b || !bounds ? (
        <p className="small muted">
          Appears after the first epoch completes (it comes from the evaluation at each epoch's end).
        </p>
      ) : (
        <div className="boundary-box" style={{ width: S, height: S }}>
          <canvas ref={canvas} width={S} height={S} aria-hidden="true" />
          <svg
            viewBox={`0 0 ${S} ${S}`}
            role="img"
            aria-label={`Predicted class over the input plane after epoch ${ev!.epoch + 1}; accuracy ${ev!.accuracy !== null ? `${num(ev!.accuracy * 100)}%` : 'n/a'}.`}
          >
            {segs.map(([x1, y1, x2, y2], q) => (
              <line
                key={q}
                x1={((x1 + 0.5) / res) * S}
                y1={S - ((y1 + 0.5) / res) * S}
                x2={((x2 + 0.5) / res) * S}
                y2={S - ((y2 + 0.5) / res) * S}
                className="contour"
              />
            ))}
            {Array.from({ length: xs.shape[0] }, (_, i) => {
              const [px, py] = toPx(xs.data[2 * i], xs.data[2 * i + 1]);
              const c = cls(i);
              const ring = i === current;
              return c === 1 ? (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={ring ? 7 : 4.5}
                  className={`pt c1${ring ? ' current' : ''}`}
                />
              ) : (
                <rect
                  key={i}
                  x={px - (ring ? 6 : 4)}
                  y={py - (ring ? 6 : 4)}
                  width={ring ? 12 : 8}
                  height={ring ? 12 : 8}
                  className={`pt c0${ring ? ' current' : ''}`}
                />
              );
            })}
          </svg>
        </div>
      )}
      <p className="small muted">
        ● class 1 · ■ class 0 · shading = predicted probability of class 1 · line = 50 % boundary · ringed =
        current example
      </p>
    </figure>
  );
}

export function TrainingView({ header, exec, epochs, onJumpToEpochEnd }: TrainingViewProps) {
  const completed = exec?.completedEpochs ?? 0;
  const done = epochs.slice(0, completed);
  const E = header.epochStarts.length - 1;
  const pos = exec ? epochPosition(header, exec.cursor) : 0;
  const hasAcc = epochs.some((e) => e.evalAccuracy !== null);
  const hasTest = epochs.some((e) => e.testLoss !== null);
  const pick = (e: number): void => onJumpToEpochEnd(Math.max(0, Math.min(E - 1, e - 1)));
  const layers = header.model.layers.filter((l) => l.params.length > 0);

  return (
    <section className="panel training" aria-label="Training state view">
      <div className="panel-head">
        <h2>Training so far</h2>
        <span className="muted small">
          {completed} of {E} epochs complete · click a chart to jump to the end of that epoch
        </span>
      </div>
      <div className="charts">
        <LineChart
          title="Loss per epoch"
          xLabel="epoch"
          yLabel="loss (log)"
          log
          xMax={E}
          marker={pos}
          onPick={pick}
          series={[
            {
              label: 'training (running mean)',
              values: done.map((e) => e.meanLoss),
              color: 'var(--series-1)',
            },
            {
              label: 'evaluation (end of epoch)',
              values: done.map((e) => e.evalLoss),
              color: 'var(--series-2)',
              dash: '5 3',
            },
            ...(hasTest
              ? [
                  {
                    label: 'held-out test',
                    values: done.map((e) => e.testLoss ?? NaN),
                    color: 'var(--series-3)',
                    dash: '1 3',
                  },
                ]
              : []),
          ]}
        />
        {hasAcc && (
          <LineChart
            title="Accuracy per epoch"
            xLabel="epoch"
            yLabel="accuracy (%)"
            xMax={E}
            yDomain={[0, 100]}
            marker={pos}
            onPick={pick}
            format={(v) => `${Math.round(v)}`}
            series={[
              {
                label: 'training set',
                values: done.map((e) => (e.evalAccuracy ?? NaN) * 100),
                color: 'var(--series-1)',
              },
              ...(hasTest
                ? [
                    {
                      label: 'held-out test',
                      values: done.map((e) => (e.testAccuracy ?? NaN) * 100),
                      color: 'var(--series-3)',
                      dash: '1 3',
                    },
                  ]
                : []),
            ]}
          />
        )}
        <GradientHeatmap
          header={header}
          epochs={epochs}
          completed={completed}
          onPick={(e) => onJumpToEpochEnd(e)}
        />
        <DecisionBoundary header={header} exec={exec} />
      </div>
      <h3>Distributions at this point</h3>
      <div className="hists">
        {layers.map((l) => (
          <div key={l.name} className="hist-pair">
            <Histogram
              title={`${l.name} weights`}
              values={exec?.params[`${l.name}.W`]?.value.data ?? null}
              color="var(--series-1)"
            />
            <Histogram
              title={`${l.name} batch gradient`}
              values={exec?.lastGrads[`${l.name}.W`]?.data ?? null}
              color="var(--series-2)"
            />
          </div>
        ))}
      </div>
      <details className="table-view">
        <summary>Table view of the epoch data</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Epoch</th>
                <th>Training loss</th>
                <th>Evaluation loss</th>
                {hasAcc && <th>Accuracy</th>}
                {hasTest && <th>Test loss</th>}
                {hasTest && <th>Test accuracy</th>}
                {header.model.params
                  .filter((p) => p.role === 'weight')
                  .map((p) => (
                    <th key={p.name}>‖∂L/∂{p.name}‖</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {done.map((e) => (
                <tr key={e.epoch}>
                  <td>{e.epoch + 1}</td>
                  <td>{num(e.meanLoss)}</td>
                  <td>{num(e.evalLoss)}</td>
                  {hasAcc && <td>{e.evalAccuracy === null ? '—' : `${num(e.evalAccuracy * 100)}%`}</td>}
                  {hasTest && <td>{e.testLoss === null ? '—' : num(e.testLoss)}</td>}
                  {hasTest && <td>{e.testAccuracy === null ? '—' : `${num(e.testAccuracy * 100)}%`}</td>}
                  {header.model.params.map((p, k) =>
                    p.role === 'weight' ? <td key={p.name}>{num(e.gradNorms[k])}</td> : null,
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

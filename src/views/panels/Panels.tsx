/**
 * Reusable experiment panels, chosen declaratively by experiments. Curves of
 * standard functions (activations, losses) are drawn from their formulas;
 * everything specific to this run — the current z, ŷ, y, the parameter path,
 * the comparison runs — comes from the trace or from real training runs.
 */
import { scaleLinear, scaleLog } from 'd3-scale';
import { useEffect, useMemo, useState } from 'react';
import { lrVerdict, type ComparedRun } from '../../core/engine/protocol';
import type { TrainConfig } from '../../core/engine/session';
import type { TraceHeader } from '../../core/npm/ir';
import type { ExecState } from '../../core/npm/state';
import { sigmoidScalar } from '../../core/tensor/ops';
import { num } from '../../explain/format';
import type { Experiment } from '../../experiments/types';
import { engineRequest } from '../../ui/store';

const W = 340;
const H = 190;
const M = { l: 40, r: 12, t: 16, b: 30 };

const ACT: Record<string, { f: (z: number) => number; d: (z: number) => number }> = {
  sigmoid: { f: sigmoidScalar, d: (z) => sigmoidScalar(z) * (1 - sigmoidScalar(z)) },
  tanh: { f: Math.tanh, d: (z) => 1 - Math.tanh(z) ** 2 },
  relu: { f: (z) => Math.max(0, z), d: (z) => (z > 0 ? 1 : 0) },
  linear: { f: (z) => z, d: () => 1 },
};

function Axes({
  x,
  y,
  xLabel,
  yLabel,
  xTicks,
  yTicks,
}: {
  x: (v: number) => number;
  y: (v: number) => number;
  xLabel: string;
  yLabel: string;
  xTicks: number[];
  yTicks: number[];
}) {
  return (
    <g>
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={M.l - 4} y={y(t) + 3} textAnchor="end" className="tick">
            {num(t)}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x${t}`} x={x(t)} y={H - M.b + 13} textAnchor="middle" className="tick">
          {num(t)}
        </text>
      ))}
      <text x={(M.l + W - M.r) / 2} y={H - 3} textAnchor="middle" className="axis-label">
        {xLabel}
      </text>
      <text x={8} y={M.t - 5} className="axis-label">
        {yLabel}
      </text>
    </g>
  );
}

const path = (pts: [number, number][]): string =>
  pts.map(([a, b], k) => `${k ? 'L' : 'M'}${a.toFixed(1)},${b.toFixed(1)}`).join('');

export function ActivationPanel({ header, exec }: { header: TraceHeader; exec: ExecState | null }) {
  const layer = header.model.layers[0];
  const name = layer.activation ?? 'linear';
  const a = ACT[name] ?? ACT.linear;
  const z = exec?.sample?.layers[layer.name]?.z?.data[0];
  const zMax = Math.max(8, z !== undefined && Number.isFinite(z) ? Math.min(Math.abs(z) + 1, 20) : 0);
  const zs = Array.from({ length: 161 }, (_, k) => -zMax + (2 * zMax * k) / 160);
  const ys = zs.map(a.f);
  const lo = Math.min(-1, ...ys.filter((v) => v > -2));
  const hi = Math.max(1, ...ys.filter((v) => v < 2));
  const x = scaleLinear()
    .domain([-zMax, zMax])
    .range([M.l, W - M.r]);
  const y = scaleLinear()
    .domain([lo, hi])
    .range([H - M.b, M.t])
    .clamp(true);
  return (
    <figure className="chart panel-chart">
      <figcaption>Activation function: {name}</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${name} and its slope over z from ${-zMax} to ${zMax}${z !== undefined ? `; current example at z = ${num(z)}, f(z) = ${num(a.f(z))}, slope ${num(a.d(z))}` : ''}.`}
      >
        <Axes x={x} y={y} xLabel="z" yLabel="value" xTicks={x.ticks(6)} yTicks={y.ticks(4)} />
        <path
          d={path(zs.map((v, k) => [x(v), y(ys[k])]))}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
        />
        <path
          d={path(zs.map((v) => [x(v), y(a.d(v))]))}
          fill="none"
          stroke="var(--series-2)"
          strokeWidth={2}
          strokeDasharray="5 3"
        />
        {z !== undefined && Number.isFinite(z) && (
          <g>
            <line x1={x(z)} x2={x(z)} y1={M.t} y2={H - M.b} className="cursor-line" />
            <circle
              cx={x(z)}
              cy={y(a.f(z))}
              r={4.5}
              fill="var(--series-1)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
            <circle
              cx={x(z)}
              cy={y(a.d(z))}
              r={4.5}
              fill="var(--series-2)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      <ul className="legend-row">
        <li>
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" x2="22" y1="4" y2="4" stroke="var(--series-1)" strokeWidth="2" />
          </svg>
          f(z)
        </li>
        <li>
          <svg width="22" height="8" aria-hidden="true">
            <line
              x1="0"
              x2="22"
              y1="4"
              y2="4"
              stroke="var(--series-2)"
              strokeWidth="2"
              strokeDasharray="5 3"
            />
          </svg>
          slope f′(z) — the factor the gradient is multiplied by
        </li>
      </ul>
      <p className="small">
        {z === undefined
          ? 'Step to an ACTIVATE instruction to place the current example on the curve.'
          : `Current example: z = ${num(z)}, f(z) = ${num(a.f(z))}, f′(z) = ${num(a.d(z))}${a.d(z) < 0.01 ? ' — saturated: almost no gradient will pass back.' : '.'}`}
      </p>
    </figure>
  );
}

export function LossComparePanel({ header, exec }: { header: TraceHeader; exec: ExecState | null }) {
  const last = header.model.layers[header.model.layers.length - 1].name;
  const p = exec?.sample?.layers[last]?.a?.data[0];
  const yT = exec?.sample?.y.data[0];
  const target = yT === undefined ? 1 : yT;
  const eps = 1e-7;
  const mse = (q: number): number => (q - target) ** 2;
  const bce = (q: number): number => {
    const c = Math.min(Math.max(q, eps), 1 - eps);
    return -(target * Math.log(c) + (1 - target) * Math.log(1 - c));
  };
  const qs = Array.from({ length: 199 }, (_, k) => (k + 1) / 200);
  const x = scaleLinear()
    .domain([0, 1])
    .range([M.l, W - M.r]);
  const y = scaleLinear()
    .domain([0, 4])
    .range([H - M.b, M.t])
    .clamp(true);
  return (
    <figure className="chart panel-chart">
      <figcaption>Two losses for the same prediction (target y = {num(target)})</figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Squared error and cross-entropy as functions of the prediction for target ${target}${p !== undefined ? `; current prediction ${num(p)}: squared error ${num(mse(p))}, cross-entropy ${num(bce(p))}` : ''}.`}
      >
        <Axes
          x={x}
          y={y}
          xLabel="prediction ŷ"
          yLabel="loss"
          xTicks={[0, 0.25, 0.5, 0.75, 1]}
          yTicks={[0, 1, 2, 3, 4]}
        />
        <path
          d={path(qs.map((q) => [x(q), y(mse(q))]))}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
        />
        <path
          d={path(qs.map((q) => [x(q), y(bce(q))]))}
          fill="none"
          stroke="var(--series-2)"
          strokeWidth={2}
          strokeDasharray="5 3"
        />
        {p !== undefined && (
          <g>
            <line x1={x(p)} x2={x(p)} y1={M.t} y2={H - M.b} className="cursor-line" />
            <circle
              cx={x(p)}
              cy={y(mse(p))}
              r={4.5}
              fill="var(--series-1)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
            <circle
              cx={x(p)}
              cy={y(bce(p))}
              r={4.5}
              fill="var(--series-2)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          </g>
        )}
      </svg>
      <ul className="legend-row">
        <li>
          <svg width="22" height="8" aria-hidden="true">
            <line x1="0" x2="22" y1="4" y2="4" stroke="var(--series-1)" strokeWidth="2" />
          </svg>
          squared error (ŷ − y)²
        </li>
        <li>
          <svg width="22" height="8" aria-hidden="true">
            <line
              x1="0"
              x2="22"
              y1="4"
              y2="4"
              stroke="var(--series-2)"
              strokeWidth="2"
              strokeDasharray="5 3"
            />
          </svg>
          cross-entropy −[y log ŷ + (1−y) log(1−ŷ)]
        </li>
      </ul>
      <p className="small">
        {p === undefined
          ? 'Step to a forward pass to place the current prediction on both curves.'
          : `Current ŷ = ${num(p)}: squared error ${num(mse(p))}, cross-entropy ${num(bce(p))}. The run trains with ${header.config && (header.config as TrainConfig).loss === 'mse' ? 'squared error' : 'cross-entropy'}.`}
      </p>
    </figure>
  );
}

/** Contour levels of L(w, b) = mean((w·x + b − y)²), computed from the dataset recorded in the trace header. */
function surface(
  xs: Float64Array,
  ys: Float64Array,
  wr: [number, number],
  br: [number, number],
  n: number,
): number[] {
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0,
    syy = 0;
  const N = xs.length;
  for (let i = 0; i < N; i++) {
    sx += xs[i];
    sy += ys[i];
    sxx += xs[i] * xs[i];
    sxy += xs[i] * ys[i];
    syy += ys[i] * ys[i];
  }
  const out: number[] = [];
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const w = wr[0] + ((wr[1] - wr[0]) * c) / (n - 1);
      const b = br[0] + ((br[1] - br[0]) * r) / (n - 1);
      out.push((w * w * sxx + 2 * w * b * sx + N * b * b - 2 * w * sxy - 2 * b * sy + syy) / N);
    }
  return out;
}

function contourSegs(values: number[], n: number, level: number): [number, number, number, number][] {
  const segs: [number, number, number, number][] = [];
  const v = (r: number, c: number): number => values[r * n + c] - level;
  const t = (a: number, b: number): number => a / (a - b);
  for (let r = 0; r + 1 < n; r++)
    for (let c = 0; c + 1 < n; c++) {
      const a = v(r, c),
        b = v(r, c + 1),
        d = v(r + 1, c),
        e = v(r + 1, c + 1);
      const pts: [number, number][] = [];
      if (a * b < 0) pts.push([c + t(a, b), r]);
      if (b * e < 0) pts.push([c + 1, r + t(b, e)]);
      if (d * e < 0) pts.push([c + t(d, e), r + 1]);
      if (a * d < 0) pts.push([c, r + t(a, d)]);
      if (pts.length >= 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
      if (pts.length === 4) segs.push([pts[2][0], pts[2][1], pts[3][0], pts[3][1]]);
    }
  return segs;
}

export function SurfacePanel({ header, exec }: { header: TraceHeader; exec: ExecState | null }) {
  const [points, setPoints] = useState<{ id: number; values: number[] }[]>([]);
  const cursor = exec?.cursor ?? -1;
  useEffect(() => {
    let live = true;
    const t = window.setTimeout(() => {
      void engineRequest<'paramHistory'>({ op: 'paramHistory', params: ['L1.W', 'L1.b'], cursor }).then(
        (r) => live && setPoints(r.points),
      );
    }, 60);
    return () => {
      live = false;
      window.clearTimeout(t);
    };
  }, [cursor, header]);
  const xs = header.dataset.xs;
  const ys = header.dataset.ys;
  const S = 260;
  const n = 48;
  const data = useMemo(() => {
    if (!xs || !ys) return null;
    // Least-squares optimum, for the marker.
    const N = xs.size;
    let sx = 0,
      sy = 0,
      sxx = 0,
      sxy = 0;
    for (let i = 0; i < N; i++) {
      sx += xs.data[i];
      sy += ys.data[i];
      sxx += xs.data[i] ** 2;
      sxy += xs.data[i] * ys.data[i];
    }
    const wOpt = (N * sxy - sx * sy) / (N * sxx - sx * sx);
    const bOpt = (sy - wOpt * sx) / N;
    const wr: [number, number] = [wOpt - 4, wOpt + 4];
    const br: [number, number] = [bOpt - 3, bOpt + 3];
    const vals = surface(xs.data, ys.data, wr, br, n);
    const minL = Math.min(...vals);
    const levels = [0.02, 0.1, 0.3, 1, 2, 4, 8, 16].map((k) => minL + k);
    return { wOpt, bOpt, wr, br, levels: levels.map((l) => ({ l, segs: contourSegs(vals, n, l) })) };
  }, [xs, ys]);
  if (!data) return null;
  const x = scaleLinear().domain(data.wr).range([0, S]);
  const y = scaleLinear().domain(data.br).range([S, 0]);
  const gx = (c: number): number => (c / (n - 1)) * S;
  const gy = (r: number): number => S - (r / (n - 1)) * S;
  const clampPt = (w: number, b: number): [number, number] => [
    Math.min(Math.max(x(w), -20), S + 20),
    Math.min(Math.max(y(b), -20), S + 20),
  ];
  const last = points.at(-1);
  return (
    <figure className="chart panel-chart">
      <figcaption>Loss surface L(w, b) and the path of gradient descent</figcaption>
      <svg
        className="surface"
        viewBox={`-34 -18 ${S + 44} ${S + 46}`}
        role="img"
        aria-label={`Contours of the squared-error loss over weight w and bias b. ${points.length} parameter states so far${last ? `; now w = ${num(last.values[0])}, b = ${num(last.values[1])}` : ''}. Minimum at w = ${num(data.wOpt)}, b = ${num(data.bOpt)}.`}
      >
        <rect x={0} y={0} width={S} height={S} fill="var(--surface)" stroke="var(--border)" />
        {data.levels.map(({ l, segs }) => (
          <g key={l}>
            {segs.map(([c1, r1, c2, r2], q) => (
              <line key={q} x1={gx(c1)} y1={gy(r1)} x2={gx(c2)} y2={gy(r2)} className="level" />
            ))}
          </g>
        ))}
        <path
          d={`M${x(data.wOpt) - 6},${y(data.bOpt) - 6}L${x(data.wOpt) + 6},${y(data.bOpt) + 6}M${x(data.wOpt) - 6},${y(data.bOpt) + 6}L${x(data.wOpt) + 6},${y(data.bOpt) - 6}`}
          stroke="var(--text)"
          strokeWidth={2}
        />
        <polyline
          points={points.map((p) => clampPt(p.values[0], p.values[1]).join(',')).join(' ')}
          fill="none"
          stroke="var(--series-2)"
          strokeWidth={1.8}
        />
        {points.map((p, k) => {
          const [cx, cy] = clampPt(p.values[0], p.values[1]);
          return (
            <circle
              key={p.id}
              cx={cx}
              cy={cy}
              r={k === points.length - 1 ? 5 : 2.5}
              fill="var(--series-2)"
              stroke="var(--surface)"
              strokeWidth={1}
            />
          );
        })}
        {x.ticks(5).map((t) => (
          <text key={`w${t}`} x={x(t)} y={S + 13} textAnchor="middle" className="tick">
            {num(t)}
          </text>
        ))}
        {y.ticks(5).map((t) => (
          <text key={`b${t}`} x={-4} y={y(t) + 3} textAnchor="end" className="tick">
            {num(t)}
          </text>
        ))}
        <text x={S / 2} y={S + 26} textAnchor="middle" className="axis-label">
          weight w
        </text>
        <text x={-30} y={-8} className="axis-label">
          bias b
        </text>
      </svg>
      <p className="small">
        Contours are levels of the loss over all {header.dataset.n} points; ✕ marks the minimum (least-squares
        fit). Dots are the parameters after each update so far
        {last ? `: now w = ${num(last.values[0])}, b = ${num(last.values[1])}` : ''}.
      </p>
    </figure>
  );
}

export function LrComparePanel({ experiment, config }: { experiment: Experiment; config: TrainConfig }) {
  const edit = experiment.editable.find((e) => e.kind === 'learningRate');
  const rates = edit && edit.kind === 'learningRate' ? edit.options : [];
  const [runs, setRuns] = useState<ComparedRun[] | null>(null);
  useEffect(() => {
    let live = true;
    setRuns(null);
    void engineRequest<'compareRuns'>({
      op: 'compareRuns',
      configs: rates.map((lr) => ({ ...config, optimizer: { ...config.optimizer, lr } })),
      dataset: experiment.dataset,
    }).then((r) => live && setRuns(r.runs));
    return () => {
      live = false;
    };
    // Recompute when the architecture or data changes, not when the selected rate does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiment.id, JSON.stringify({ ...config, optimizer: { ...config.optimizer, lr: 0 } })]);
  const VERDICT: Record<ReturnType<typeof lrVerdict>, string> = {
    divergent: 'divergent: every step overshoots further',
    'too large': 'too large: overshoots back and forth',
    'too small': 'too small: still far from the minimum',
    good: 'good: fast and steady',
  };
  const verdict = (r: ComparedRun): string => VERDICT[lrVerdict(r, runs ?? [])];
  const w = 160,
    h = 100;
  return (
    <figure className="chart panel-chart">
      <figcaption>The same model trained with {rates.length} learning rates</figcaption>
      {!runs ? (
        <p className="small muted">Training the comparison runs…</p>
      ) : (
        <div className="multiples">
          {runs.map((r) => {
            const finite = r.losses.filter((v) => Number.isFinite(v) && v > 0);
            const lo = Math.max(1e-6, Math.min(...finite));
            const hi = Math.max(lo * 10, Math.max(...finite));
            const x = scaleLinear()
              .domain([0, Math.max(1, r.losses.length - 1)])
              .range([4, w - 4]);
            const y = scaleLog()
              .domain([lo, hi])
              .range([h - 4, 4])
              .clamp(true);
            const current = r.lr === config.optimizer.lr;
            return (
              <div key={r.lr} className={`multiple${current ? ' current' : ''}`}>
                <div className="small">
                  <strong>η = {r.lr}</strong>
                  {current ? ' (main run)' : ''}
                </div>
                <svg
                  viewBox={`0 0 ${w} ${h}`}
                  role="img"
                  aria-label={`Learning rate ${r.lr}: loss from ${num(r.losses[0])} to ${num(r.losses.at(-1)!)} over ${r.losses.length} epochs; ${verdict(r)}.`}
                >
                  <rect x={0} y={0} width={w} height={h} fill="none" stroke="var(--border)" />
                  <polyline
                    points={r.losses
                      .map((v, k) => (Number.isFinite(v) ? `${x(k)},${y(Math.max(v, lo))}` : ''))
                      .join(' ')}
                    fill="none"
                    stroke="var(--series-1)"
                    strokeWidth={2}
                  />
                </svg>
                <div className="small">
                  {verdict(r)} · final {num(r.losses.at(-1)!)}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="small muted">
        Evaluation loss per epoch (log scale), each run trained for real from the same starting point.
      </p>
    </figure>
  );
}

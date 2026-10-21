/** Small, dependency-light SVG chart primitives for View B (d3 for scales only). */
import { scaleLinear, scaleLog } from 'd3-scale';
import { useState, type MouseEvent } from 'react';
import { num } from '../../explain/format';

export interface Series {
  label: string;
  values: number[];
  /** Line style carries identity together with the legend, so it never rests on colour alone. */
  dash?: string;
  color: string;
}

export interface LineChartProps {
  title: string;
  xLabel: string;
  yLabel: string;
  series: Series[];
  /** x of the first value (epochs are 1-based). */
  x0?: number;
  /** Total x extent, so the chart does not rescale as values arrive. */
  xMax: number;
  log?: boolean;
  yDomain?: [number, number];
  /** Current position on the x axis (may be fractional). */
  marker?: number;
  onPick?(x: number): void;
  format?(v: number): string;
}

const W = 340;
const H = 170;
const M = { l: 46, r: 10, t: 22, b: 30 };

export function LineChart({
  title,
  xLabel,
  yLabel,
  series,
  x0 = 1,
  xMax,
  log,
  yDomain,
  marker,
  onPick,
  format = num,
}: LineChartProps) {
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values).filter((v) => Number.isFinite(v) && (!log || v > 0));
  const lo = yDomain?.[0] ?? (all.length ? Math.min(...all) : 0);
  const hi = yDomain?.[1] ?? (all.length ? Math.max(...all) : 1);
  const x = scaleLinear()
    .domain([x0, Math.max(x0 + 1, xMax)])
    .range([M.l, W - M.r]);
  const y = log
    ? scaleLog()
        .domain([Math.max(1e-12, lo * 0.9), Math.max(hi * 1.1, lo * 1.5)])
        .range([H - M.b, M.t])
        .clamp(true)
    : scaleLinear()
        .domain([lo, hi === lo ? lo + 1 : hi])
        .nice()
        .range([H - M.b, M.t]);
  const xTicks = x.ticks(5).filter((t) => Number.isInteger(t));
  const yTicks = (y.ticks(4) as number[]).filter((_, k, a) => !log || a.length <= 6 || k % 2 === 0);
  const pick = (e: MouseEvent<SVGSVGElement>): number => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    return Math.round(Math.min(Math.max(x.invert(px), x0), xMax));
  };
  const n = Math.max(...series.map((s) => s.values.length), 0);
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg
        data-control={onPick ? 'chart:pick' : undefined}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${series.map((s) => `${s.label}: ${s.values.length ? `latest ${format(s.values[s.values.length - 1])}` : 'no data yet'}`).join('; ')}.`}
        onMouseMove={(e) => setHover(pick(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => onPick?.(pick(e))}
        className={onPick ? 'pickable' : undefined}
      >
        {yTicks.map((t) => (
          <g key={`y${t}`}>
            <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={M.l - 4} y={y(t) + 3} textAnchor="end" className="tick">
              {log ? powerOfTen(t, format) : format(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={`x${t}`} x={x(t)} y={H - M.b + 13} textAnchor="middle" className="tick">
            {t}
          </text>
        ))}
        <text x={(M.l + W - M.r) / 2} y={H - 3} textAnchor="middle" className="axis-label">
          {xLabel}
        </text>
        <text x={10} y={M.t - 8} className="axis-label">
          {yLabel}
        </text>
        {series.map((s) => {
          const pts = s.values
            .map((v, k) => (Number.isFinite(v) && (!log || v > 0) ? `${x(x0 + k)},${y(v)}` : null))
            .filter(Boolean);
          return (
            <polyline
              key={s.label}
              points={pts.join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dash}
            />
          );
        })}
        {series.map((s) =>
          s.values.length ? (
            <circle
              key={`end${s.label}`}
              cx={x(x0 + s.values.length - 1)}
              cy={y(Math.max(s.values[s.values.length - 1], log ? 1e-12 : -Infinity))}
              r={3.5}
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ) : null,
        )}
        {marker !== undefined && (
          <line x1={x(marker)} x2={x(marker)} y1={M.t} y2={H - M.b} className="cursor-line" />
        )}
        {hover !== null && hover - x0 < n && (
          <g className="readout">
            <line x1={x(hover)} x2={x(hover)} y1={M.t} y2={H - M.b} className="crosshair" />
            <text x={Math.min(x(hover) + 4, W - 120)} y={M.t + 10} className="tick strong">
              {`${xLabel} ${hover}: ${series.map((s) => `${s.label.split(' ')[0]} ${s.values[hover - x0] !== undefined ? format(s.values[hover - x0]) : '—'}`).join(', ')}`}
            </text>
          </g>
        )}
      </svg>
      {series.length > 1 && (
        <ul className="legend-row" aria-hidden="true">
          {series.map((s) => (
            <li key={s.label}>
              <svg width="22" height="8">
                <line
                  x1="0"
                  x2="22"
                  y1="4"
                  y2="4"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeDasharray={s.dash}
                />
              </svg>
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}

/** Histogram of a tensor's values with symmetric bins around zero. */
export function bins(values: ArrayLike<number>, count = 12): { edges: number[]; counts: number[] } {
  let m = 1e-12;
  for (let i = 0; i < values.length; i++)
    if (Number.isFinite(values[i])) m = Math.max(m, Math.abs(values[i]));
  const edges = Array.from({ length: count + 1 }, (_, k) => -m + (2 * m * k) / count);
  const counts = new Array<number>(count).fill(0);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    counts[Math.min(count - 1, Math.floor(((v + m) / (2 * m)) * count))]++;
  }
  return { edges, counts };
}

export function Histogram({
  title,
  values,
  color,
}: {
  title: string;
  values: ArrayLike<number> | null;
  color: string;
}) {
  const w = 160;
  const h = 70;
  if (!values || values.length === 0) {
    return (
      <figure className="hist">
        <figcaption>{title}</figcaption>
        <p className="muted small">not yet available</p>
      </figure>
    );
  }
  const { edges, counts } = bins(values);
  const max = Math.max(...counts, 1);
  const bw = (w - 8) / counts.length;
  return (
    <figure className="hist">
      <figcaption>{title}</figcaption>
      <svg
        viewBox={`0 0 ${w} ${h + 14}`}
        role="img"
        aria-label={`${title}: ${values.length} values between ${num(edges[0])} and ${num(edges[edges.length - 1])}`}
      >
        {counts.map((c, k) => (
          <rect
            key={k}
            x={4 + k * bw + 1}
            y={h - (c / max) * (h - 6)}
            width={bw - 2}
            height={(c / max) * (h - 6)}
            rx={1.5}
            fill={color}
          >
            <title>{`${num(edges[k])} … ${num(edges[k + 1])}: ${c}`}</title>
          </rect>
        ))}
        <line x1={w / 2} x2={w / 2} y1={4} y2={h} className="zero" />
        <text x={4} y={h + 12} className="tick">
          {num(edges[0])}
        </text>
        <text x={w - 4} y={h + 12} textAnchor="end" className="tick">
          {num(edges[edges.length - 1])}
        </text>
      </svg>
    </figure>
  );
}

const SUP: Record<string, string> = {
  '-': '⁻',
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
};

/** A log-axis tick: a power of ten as 10ⁿ, which fits the axis margin where 1.00×10⁻¹² does not. */
function powerOfTen(t: number, format: (v: number) => string): string {
  const e = Math.log10(t);
  if (Math.abs(e - Math.round(e)) > 1e-9 || Math.abs(e) < 3) return format(t);
  return `10${[...String(Math.round(e))].map((c) => SUP[c]).join('')}`;
}

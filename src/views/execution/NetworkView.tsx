/**
 * View A — Neural Execution View.
 *
 * Node-link diagram of a dense network rendered from the reconstructed state
 * alone. Activation values are printed in every neuron and also encoded by
 * fill; weights are encoded by stroke width (magnitude) and by both colour and
 * dash pattern (sign), so no meaning depends on colour alone. The instruction
 * at the cursor is highlighted through its registered visual mapping, and the
 * flow direction is shown by arrowheads and a persistent text mode indicator.
 */
import { scaleLinear } from 'd3-scale';
import type { KeyboardEvent } from 'react';
import type { TraceHeader } from '../../core/npm/ir';
import type { ExecState } from '../../core/npm/state';
import type { Tensor } from '../../core/tensor/tensor';
import { num } from '../../explain/format';
import { type Focus, sameFocus } from '../focus';
import { type Flow, visualMapping } from '../registry';
import { ModeIndicator } from './ModeIndicator';

export interface NetworkViewProps {
  header: TraceHeader;
  exec: ExecState | null;
  focus: Focus | null;
  onFocus(f: Focus | null): void;
}

/** Edges stay individually focusable by keyboard only while there are few enough to tab through. */
const MAX_FOCUSABLE_EDGES = 64;

/** Minimum drawing size; deeper or wider networks get more room so columns and labels never overlap. */
const MIN_W = 760;
const MIN_H = 480;
const COL_GAP = 150;
const ROW_GAP = 74;
const PAD_X = 70;
const PAD_TOP = 70;
const PAD_BOTTOM = 40;
const R = 26;

export const valueFill = scaleLinear<string>()
  .domain([-1, 0, 1])
  .range(['#D55E00', '#F7F7F7', '#0072B2'])
  .clamp(true);
const POS = '#0072B2';
const NEG = '#D55E00';

interface Column {
  layer: string | null;
  label: string;
  values: (number | null)[];
  grads: (number | null)[];
  /** Which gradient `grads` holds: w.r.t. the pre-activation z, or (earlier in the backward pass) the output a. */
  gradOf: 'z' | 'a';
  biases: (number | null)[];
}

/** WCAG relative luminance of an "rgb(r, g, b)" or "#rrggbb" colour. */
function luminance(color: string): number {
  const m = color.startsWith('#')
    ? [1, 3, 5].map((k) => parseInt(color.slice(k, k + 2), 16))
    : (color.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).slice(0, 3).map(Number);
  const [r, g, b] = m.map((c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white, whichever contrasts more with the neuron's fill. */
export function textOn(v: number | null): string {
  if (v === null) return 'var(--text)';
  const L = luminance(valueFill(v));
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? '#000000' : '#ffffff';
}

function at(t: Tensor | undefined, i: number): number | null {
  return t && i < t.size ? t.data[i] : null;
}

export function modeOf(exec: ExecState | null): Flow {
  if (!exec?.current) return 'none';
  return visualMapping(exec.current).flow;
}

export function NetworkView({ header, exec, focus, onFocus }: NetworkViewProps) {
  const flow = modeOf(exec);
  const current = exec?.current ?? null;
  const mapping = current ? visualMapping(current) : null;
  const activeLayer = current?.path.layer ?? null;

  const nIn = header.model.inputShape[0];
  const columns: Column[] = [
    {
      layer: null,
      label: 'Input',
      values: Array.from({ length: nIn }, (_, i) => at(exec?.sample?.x, i)),
      grads: Array.from({ length: nIn }, () => null),
      gradOf: 'z',
      biases: Array.from({ length: nIn }, () => null),
    },
    ...header.model.layers.map((l, k): Column => {
      const ls = exec?.sample?.layers[l.name];
      const units = l.outShape[0];
      const b = exec?.params[`${l.name}.b`]?.value;
      const g = ls?.gradZ ?? ls?.gradA;
      return {
        layer: l.name,
        label:
          k === header.model.layers.length - 1
            ? `Output (${l.activation})`
            : `Hidden ${k + 1} (${l.activation})`,
        values: Array.from({ length: units }, (_, i) => at(ls?.a, i)),
        grads: Array.from({ length: units }, (_, i) => at(g, i)),
        gradOf: ls?.gradZ ? 'z' : 'a',
        biases: Array.from({ length: units }, (_, i) => at(b, i)),
      };
    }),
  ];

  const W = Math.max(MIN_W, 2 * PAD_X + 120 + (columns.length - 1) * COL_GAP);
  const H = Math.max(
    MIN_H,
    PAD_TOP + PAD_BOTTOM + Math.max(...columns.map((c) => c.values.length)) * ROW_GAP,
  );
  const colX = (c: number): number => PAD_X + (c * (W - 2 * PAD_X - 120)) / Math.max(1, columns.length - 1);
  const nodeY = (c: number, i: number): number => {
    const n = columns[c].values.length;
    const span = H - PAD_TOP - PAD_BOTTOM;
    return PAD_TOP + ((i + 0.5) * span) / n;
  };

  // Edge styling from the current weights.
  const weights = header.model.layers.map((l) => exec?.params[`${l.name}.W`]?.value);
  const maxW = Math.max(1e-9, ...weights.flatMap((w) => (w ? Array.from(w.data, Math.abs) : [])));

  // GRAD_MATMUL_X sends the gradient back along the active layer's weights, so those edges light up too.
  const highlightEdges = (mapping?.target === 'edges' || current?.kind === 'GRAD_MATMUL_X') && activeLayer;
  const highlightUnits = (mapping?.target === 'units' || mapping?.target === 'layer') && activeLayer;
  const highlightBias = mapping?.target === 'bias' && activeLayer;
  const updateParamRole = current?.path.phase === 'update' ? String(current.meta.param).split('.')[1] : null;
  const marker =
    flow === 'backward' ? 'url(#arrow-back)' : flow === 'forward' ? 'url(#arrow-fwd)' : undefined;

  // GRAD_MATMUL_X sends the gradient to the layer *before* the active one.
  const activeIdx = header.model.layers.findIndex((l) => l.name === activeLayer);
  const receivingLayer = activeIdx > 0 ? header.model.layers[activeIdx - 1].name : null;
  const outIdx = columns.length - 1;
  const loss = exec?.sample?.loss;
  const target = exec?.sample?.y;
  const lossActive = mapping?.target === 'loss';

  const toggle = (f: Focus): void => onFocus(sameFocus(focus, f) ? null : f);
  const onKey = (f: Focus) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle(f);
    }
  };
  const edgeCount = columns
    .slice(1)
    .reduce((a, col, k) => a + col.values.length * columns[k].values.length, 0);
  const edgesFocusable = edgeCount <= MAX_FOCUSABLE_EDGES;

  return (
    <section className="panel network" aria-label="Neural execution view">
      <ModeIndicator exec={exec} />
      <div className="network-scroll">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby="netTitle netDesc"
          className="network-svg"
          // Large networks keep a legible scale and scroll horizontally instead of shrinking.
          style={W > MIN_W ? { minWidth: Math.round(W * 0.72) } : undefined}
        >
          <title id="netTitle">Network diagram</title>
          <desc id="netDesc">
            {`${columns.map((c) => `${c.label}: ${c.values.length} unit${c.values.length > 1 ? 's' : ''}`).join('; ')}. Blue solid edges are positive weights, orange dashed edges negative; thickness shows magnitude.`}
          </desc>
          <defs>
            <marker
              id="arrow-fwd"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
            </marker>
            <marker
              id="arrow-back"
              viewBox="0 0 10 10"
              refX="1"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M10,0 L0,5 L10,10 z" fill="currentColor" />
            </marker>
          </defs>

          {columns.map((col, c) => (
            <text
              key={`h${c}`}
              x={colX(c)}
              y={columns.length > 4 ? 22 : 30}
              className="col-label"
              textAnchor="middle"
            >
              {/* With many columns the activation goes on a second line so neighbouring headings never touch. */}
              {columns.length > 4 && col.label.includes(' (') ? (
                <>
                  <tspan x={colX(c)}>{col.label.split(' (')[0]}</tspan>
                  <tspan x={colX(c)} dy={16}>
                    ({col.label.split(' (')[1]}
                  </tspan>
                </>
              ) : (
                col.label
              )}
            </text>
          ))}

          {columns.slice(1).map((col, k) => {
            const c = k + 1;
            const w = weights[k];
            const active =
              highlightEdges === col.layer || (updateParamRole === 'W' && activeLayer === col.layer);
            // During the update of this layer's weights, overlay each weight's change Δ (dotted, width ∝ |Δ|).
            const upd = exec?.updates[`${col.layer}.W`];
            const delta =
              upd?.before && upd.after && updateParamRole === 'W' && activeLayer === col.layer ? upd : null;
            let maxD = 1e-12;
            if (delta)
              for (let q = 0; q < delta.after!.size; q++)
                maxD = Math.max(maxD, Math.abs(delta.after!.data[q] - delta.before!.data[q]));
            return (
              <g key={`e${c}`} className={active ? 'edges active' : 'edges'}>
                {columns[c - 1].values.map((_, i) =>
                  col.values.map((__, j) => {
                    const idx = i * col.values.length + j;
                    const wv = w ? w.data[idx] : 0;
                    const x1 = colX(c - 1) + R;
                    const x2 = colX(c) - R;
                    const y1 = nodeY(c - 1, i);
                    const y2 = nodeY(c, j);
                    const backward = flow === 'backward';
                    const f: Focus = { kind: 'edge', layer: col.layer as string, i, j };
                    const isFocus = sameFocus(focus, f);
                    const d = delta ? delta.after!.data[idx] - delta.before!.data[idx] : null;
                    const label = `Weight from ${columns[c - 1].label} unit ${i + 1} to ${col.label} unit ${j + 1}: ${num(wv)}${d !== null ? `, changed by ${num(d)} this step` : ''}`;
                    return (
                      <g
                        key={`${i}-${j}`}
                        className={`edge${isFocus ? ' focused' : ''}`}
                        onClick={() => toggle(f)}
                        {...(edgesFocusable
                          ? {
                              tabIndex: 0,
                              role: 'button',
                              'aria-pressed': isFocus,
                              'aria-label': label,
                              onKeyDown: onKey(f),
                            }
                          : {})}
                      >
                        <line
                          x1={backward ? x2 : x1}
                          y1={backward ? y2 : y1}
                          x2={backward ? x1 + 4 : x2 - 4}
                          y2={backward ? y1 : y2}
                          stroke={wv >= 0 ? POS : NEG}
                          strokeDasharray={wv >= 0 ? undefined : '5 3'}
                          strokeWidth={0.6 + (5 * Math.abs(wv)) / maxW}
                          strokeOpacity={active || isFocus ? 0.95 : 0.45}
                          markerEnd={active ? marker : undefined}
                          style={{ color: wv >= 0 ? POS : NEG }}
                        />
                        {d !== null && Math.abs(d) > 0 && (
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            className="delta"
                            strokeWidth={1 + (5 * Math.abs(d)) / maxD}
                          />
                        )}
                        <line x1={x1} y1={y1} x2={x2} y2={y2} className="hit" />
                        <title>{label}</title>
                      </g>
                    );
                  }),
                )}
              </g>
            );
          })}

          {columns.map((col, c) =>
            col.values.map((v, i) => {
              const x = colX(c);
              const y = nodeY(c, i);
              const layer = col.layer ?? 'input';
              const f: Focus = { kind: 'unit', layer, index: i };
              const isFocus = sameFocus(focus, f);
              const unitActive =
                (highlightUnits && col.layer === activeLayer) ||
                (mapping?.target === 'input' && c === 0) ||
                (current?.kind === 'GRAD_MATMUL_X' && col.layer !== null && col.layer === receivingLayer);
              const label = `${col.label}, unit ${i + 1}: ${v === null ? 'not yet computed' : `value ${num(v)}`}${col.grads[i] !== null ? `, gradient ${num(col.grads[i] as number)}` : ''}${col.biases[i] !== null ? `, bias ${num(col.biases[i] as number)}` : ''}`;
              return (
                <g
                  key={`n${c}-${i}`}
                  className={`node${unitActive ? ' active' : ''}${isFocus ? ' focused' : ''}`}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isFocus}
                  aria-label={label}
                  onClick={() => toggle(f)}
                  onKeyDown={onKey(f)}
                >
                  <circle cx={x} cy={y} r={R} fill={v === null ? 'var(--surface)' : valueFill(v)} />
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    className="node-value"
                    style={{ fill: textOn(v) }}
                  >
                    {v === null ? '·' : num(v)}
                  </text>
                  {col.biases[i] !== null && (
                    <text
                      x={x}
                      y={y - R - 5}
                      textAnchor="middle"
                      className={`bias${(highlightBias && col.layer === activeLayer) || (updateParamRole === 'b' && activeLayer === col.layer) ? ' active' : ''}`}
                    >
                      b={num(col.biases[i] as number)}
                    </text>
                  )}
                  {col.grads[i] !== null && (
                    <text x={x} y={y + R + 14} textAnchor="middle" className="grad">
                      ∂ℓ/∂{col.gradOf}={num(col.grads[i] as number)}
                    </text>
                  )}
                </g>
              );
            }),
          )}

          <g
            className={`loss-box${lossActive ? ' active' : ''}`}
            aria-label={loss === undefined ? 'Loss not yet computed' : `Loss ${num(loss)}`}
          >
            <rect x={colX(outIdx) + 50} y={nodeY(outIdx, 0) - 34} width={104} height={68} rx={6} />
            <text x={colX(outIdx) + 102} y={nodeY(outIdx, 0) - 12} textAnchor="middle">
              {target ? `target y = ${Array.from(target.data).map(num).join(', ')}` : 'target y'}
            </text>
            <text x={colX(outIdx) + 102} y={nodeY(outIdx, 0) + 12} textAnchor="middle" className="loss-value">
              {loss === undefined ? 'ℓ = ·' : `ℓ = ${num(loss)}`}
            </text>
          </g>
        </svg>
      </div>
      <p className="legend">
        <span className="swatch pos" aria-hidden="true" /> positive weight (solid){' '}
        <span className="swatch neg" aria-hidden="true" /> negative weight (dashed) · line thickness =
        |weight| · number in each neuron = its current value · during an update, dotted overlays show each
        weight's change (thicker = larger change) · click a neuron or a weight to inspect it
      </p>
    </section>
  );
}

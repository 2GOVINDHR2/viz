/**
 * View A — Neural Execution View (P4 basic form).
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
import { type Flow, visualMapping } from '../registry';

export interface NetworkViewProps {
  header: TraceHeader;
  exec: ExecState | null;
  focus: { layer: string; index: number } | null;
  onFocus(f: { layer: string; index: number } | null): void;
}

const W = 760;
const H = 480;
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

const MODE: Record<Flow, { text: string; icon: string; cls: string }> = {
  forward: { text: 'FORWARD PASS', icon: '▶', cls: 'mode-forward' },
  backward: { text: 'BACKWARD PASS', icon: '◀', cls: 'mode-backward' },
  update: { text: 'PARAMETER UPDATE', icon: '⟳', cls: 'mode-update' },
  none: { text: 'CONTROL', icon: '●', cls: 'mode-none' },
};

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
  const dense = header.model.layers.every((l) => l.type === 'dense');
  const flow = modeOf(exec);
  const mode = MODE[flow];
  const current = exec?.current ?? null;
  const mapping = current ? visualMapping(current) : null;
  const activeLayer = current?.path.layer ?? null;

  if (!dense) {
    return (
      <section className="panel" aria-label="Neural execution view">
        <p>This view renders dense networks; convolutional layers are shown in the Network Structure View.</p>
      </section>
    );
  }

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

  const onKey = (f: { layer: string; index: number }) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFocus(focus && focus.layer === f.layer && focus.index === f.index ? null : f);
    }
  };

  return (
    <section className="panel network" aria-label="Neural execution view">
      <div className={`mode-indicator ${mode.cls}`} role="status" aria-live="polite">
        <span aria-hidden="true" className="mode-icon">
          {mode.icon}
        </span>
        <strong>{mode.text}</strong>
        <span className="mode-label">{mapping?.label ?? 'Ready — press Step to begin'}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="netTitle netDesc" className="network-svg">
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
          <text key={`h${c}`} x={colX(c)} y={30} className="col-label" textAnchor="middle">
            {col.label}
          </text>
        ))}

        {columns.slice(1).map((col, k) => {
          const c = k + 1;
          const w = weights[k];
          const active =
            highlightEdges === col.layer || (updateParamRole === 'W' && activeLayer === col.layer);
          return (
            <g key={`e${c}`} className={active ? 'edges active' : 'edges'}>
              {columns[c - 1].values.map((_, i) =>
                col.values.map((__, j) => {
                  const wv = w ? w.data[i * col.values.length + j] : 0;
                  const x1 = colX(c - 1) + R;
                  const x2 = colX(c) - R;
                  const y1 = nodeY(c - 1, i);
                  const y2 = nodeY(c, j);
                  const backward = flow === 'backward';
                  return (
                    <line
                      key={`${i}-${j}`}
                      x1={backward ? x2 : x1}
                      y1={backward ? y2 : y1}
                      x2={backward ? x1 + 4 : x2 - 4}
                      y2={backward ? y1 : y2}
                      stroke={wv >= 0 ? POS : NEG}
                      strokeDasharray={wv >= 0 ? undefined : '5 3'}
                      strokeWidth={0.6 + (5 * Math.abs(wv)) / maxW}
                      strokeOpacity={active ? 0.95 : 0.45}
                      markerEnd={active ? marker : undefined}
                      style={{ color: wv >= 0 ? POS : NEG }}
                    >
                      <title>{`Weight ${col.layer}.W[${i + 1},${j + 1}] = ${num(wv)}`}</title>
                    </line>
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
            const isFocus = focus?.layer === layer && focus.index === i;
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
                onClick={() => onFocus(isFocus ? null : { layer, index: i })}
                onKeyDown={onKey({ layer, index: i })}
              >
                <circle cx={x} cy={y} r={R} fill={v === null ? 'var(--surface)' : valueFill(v)} />
                <text x={x} y={y + 4} textAnchor="middle" className="node-value" style={{ fill: textOn(v) }}>
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
      <p className="legend">
        <span className="swatch pos" aria-hidden="true" /> positive weight (solid){' '}
        <span className="swatch neg" aria-hidden="true" /> negative weight (dashed) · line thickness =
        |weight| · number in each neuron = its current value · click or press Enter on a neuron to focus the
        explanation on it
      </p>
    </section>
  );
}

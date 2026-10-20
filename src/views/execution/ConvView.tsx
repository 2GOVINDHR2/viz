/**
 * View A for convolutional networks: the input image with the receptive field
 * of the selected output cell, every kernel, an animated sliding-window
 * convolution, per-channel feature maps (activations in the forward pass,
 * error signals in the backward pass), pooled maps and class probabilities.
 * All values come from the reconstructed state.
 */
import { useEffect, useRef, useState } from 'react';
import type { TraceHeader } from '../../core/npm/ir';
import type { ExecState } from '../../core/npm/state';
import type { Tensor } from '../../core/tensor/tensor';
import { num } from '../../explain/format';
import type { Focus } from '../focus';
import { illumination } from '../illumination';
import { visualMapping } from '../registry';
import { ModeIndicator } from './ModeIndicator';
import { textOn, valueFill } from './NetworkView';

/** Draws channel `c` of a [1, C, H, W] (or [C, H, W]) tensor; grey for images in [0, 1], diverging otherwise. */
function MapCanvas({
  t,
  c,
  size,
  grey,
  label,
  onPick,
  highlight,
}: {
  t: Tensor;
  c: number;
  size: number;
  grey?: boolean;
  label: string;
  onPick?(i: number, j: number): void;
  highlight?: { r0: number; c0: number; h: number; w: number } | null;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [H, W] = t.shape.slice(-2);
  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    let m = 1e-12;
    const off = c * H * W;
    for (let k = 0; k < H * W; k++) m = Math.max(m, Math.abs(t.data[off + k]));
    const img = ctx.createImageData(W, H);
    for (let k = 0; k < H * W; k++) {
      const v = t.data[off + k];
      let r: number, g: number, b: number;
      if (grey) r = g = b = Math.round(255 * (1 - Math.min(Math.max(v, 0), 1)));
      else {
        const rgb = valueFill(v / m)
          .match(/\d+/g)!
          .map(Number);
        [r, g, b] = rgb;
      }
      img.data.set([r, g, b, 255], k * 4);
    }
    ctx.putImageData(img, 0, 0);
  }, [t, c, H, W, grey]);
  const s = size / W;
  return (
    <div className="map" style={{ width: size }}>
      <div className="map-box" style={{ width: size, height: (H / W) * size }}>
        <canvas
          ref={ref}
          width={W}
          height={H}
          aria-hidden="true"
          style={{ width: size, height: (H / W) * size }}
        />
        <svg
          data-control={onPick ? 'select:cell' : undefined}
          viewBox={`0 0 ${size} ${(H / W) * size}`}
          // Pickable maps are operable by keyboard: arrow keys move the selected cell (WCAG 2.1.1).
          role={onPick ? 'button' : 'img'}
          aria-label={
            onPick
              ? `${label}. Selected cell ${highlight ? `row ${highlight.r0 + 1}, column ${highlight.c0 + 1}` : 'none'}; arrow keys move it.`
              : label
          }
          tabIndex={onPick ? 0 : undefined}
          onKeyDown={
            onPick
              ? (e) => {
                  const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[
                    e.key
                  ];
                  if (!d) return;
                  e.preventDefault();
                  e.stopPropagation();
                  const r = Math.min(H - 1, Math.max(0, (highlight?.r0 ?? 0) + (highlight ? d[0] : 0)));
                  const q = Math.min(W - 1, Math.max(0, (highlight?.c0 ?? 0) + (highlight ? d[1] : 0)));
                  onPick(r, q);
                }
              : undefined
          }
          onClick={
            onPick
              ? (e) => {
                  const box = e.currentTarget.getBoundingClientRect();
                  onPick(
                    Math.floor(((e.clientY - box.top) / box.height) * H),
                    Math.floor(((e.clientX - box.left) / box.width) * W),
                  );
                }
              : undefined
          }
          className={onPick ? 'pickable' : undefined}
        >
          {highlight && (
            <rect
              x={highlight.c0 * s}
              y={highlight.r0 * s}
              width={highlight.w * s}
              height={highlight.h * s}
              className="window"
            />
          )}
        </svg>
      </div>
      <div className="map-label small">{label.split(':')[0]}</div>
    </div>
  );
}

export function KernelGrid({ k, f }: { k: Tensor; f: number }) {
  const [, C, KH, KW] = k.shape;
  let m = 1e-12;
  for (let q = 0; q < C * KH * KW; q++) m = Math.max(m, Math.abs(k.data[f * C * KH * KW + q]));
  return (
    <table className="kernel" aria-label={`Kernel ${f + 1}`}>
      <tbody>
        {Array.from({ length: KH }, (_, u) => (
          <tr key={u}>
            {Array.from({ length: KW }, (_, v) => {
              const val = k.data[(f * C + 0) * KH * KW + u * KW + v];
              return (
                <td
                  key={v}
                  style={{
                    background: valueFill(val / m),
                    color: textOn(val / m),
                  }}
                >
                  {num(val)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ConvView({
  header,
  exec,
  focus,
  onFocus,
}: {
  header: TraceHeader;
  exec: ExecState | null;
  focus: Focus | null;
  onFocus(f: Focus | null): void;
}) {
  const convIdx = header.model.layers.findIndex((l) => l.type === 'conv2d');
  const conv = header.model.layers[convIdx];
  const pool = header.model.layers.find((l, k) => k > convIdx && l.type === 'pool');
  const out = header.model.layers[header.model.layers.length - 1];
  const s = exec?.sample;
  const ls = s?.layers[conv.name];
  const K = exec?.params[`${conv.name}.W`]?.value;
  const [F, OH, OW] = conv.outShape;
  const [, IH] = conv.inShape;
  const kSize = K?.shape[2] ?? 3;
  const cfg =
    (header.config as { model?: { layers?: { stride?: number; padding?: number }[] } }).model?.layers?.[
      convIdx
    ] ?? {};
  const stride = cfg.stride ?? 1;
  const pad = cfg.padding ?? 0;
  const current = exec?.current ?? null;
  const flow = current ? visualMapping(current).flow : 'none';
  // Which stage of the pipeline the instruction acts on (illumination contract, src/views/illumination.ts).
  const lit = illumination(header, exec);
  const touches = (name: string): boolean =>
    lit.edges === name || lit.bias === name || lit.units.includes(name);
  const head = header.model.layers.filter((l, k) => k > convIdx && l !== pool);
  const stageLit = {
    input: lit.input || lit.units.includes('input'),
    kernels: lit.edges === conv.name || lit.bias === conv.name,
    maps: lit.units.includes(conv.name),
    pool: pool ? touches(pool.name) : false,
    head: head.some((l) => touches(l.name)),
    loss: lit.loss,
  };
  const litAttr = (on: boolean, name: string) =>
    on ? { 'data-lit': name, className: 'stage active' } : { className: 'stage' };
  const backward = flow === 'backward';

  // Sliding-window position: the focused output cell, or an animated sweep while the cursor is on CONV2D.
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [sweep, setSweep] = useState(0);
  const sweeping =
    current?.kind === 'CONV2D' && !reduced && !(focus?.kind === 'unit' && focus.layer === conv.name);
  useEffect(() => {
    if (!sweeping) return;
    const t = window.setInterval(() => setSweep((x) => (x + 1) % (OH * OW)), 45);
    return () => window.clearInterval(t);
  }, [sweeping, OH, OW]);
  const chosen = focus?.kind === 'unit' && focus.layer === conv.name ? focus.index : null;
  const f = chosen !== null ? Math.floor(chosen / (OH * OW)) : 0;
  const cell = chosen !== null ? chosen % (OH * OW) : sweeping ? sweep : 0;
  const oi = Math.floor(cell / OW);
  const oj = cell % OW;
  const win = { r0: oi * stride - pad, c0: oj * stride - pad, h: kSize, w: kSize };

  // The dot product for the window, from the trace's input and kernel values.
  const x = s?.x;
  let terms: string[] = [];
  let dot = 0;
  if (x && K) {
    terms = [];
    for (let u = 0; u < kSize; u++)
      for (let v = 0; v < kSize; v++) {
        const r = win.r0 + u,
          c = win.c0 + v;
        const xv = r >= 0 && r < IH && c >= 0 && c < x.shape[3] ? x.data[r * x.shape[3] + c] : 0;
        const kv = K.data[f * kSize * kSize + u * kSize + v];
        dot += xv * kv;
        if (xv !== 0) terms.push(`${num(xv)}·${num(kv)}`);
      }
  }
  const b = exec?.params[`${conv.name}.b`]?.value.data[f];
  const probs = s?.layers[out.name]?.a;
  const mapSize = 96;
  // Show the furthest stage of this example's convolution layer that has been computed.
  const mapsTensor = backward ? ls?.gradZ : (ls?.a ?? ls?.z ?? ls?.u);
  const mapsTitle = backward
    ? 'Error signal ∂ℓ/∂z per channel'
    : ls?.a
      ? 'Feature maps (after activation)'
      : ls?.z
        ? 'Feature maps (after bias, before activation)'
        : 'Feature maps (convolution output u)';
  const pick = (ch: number) => (i: number, j: number) =>
    onFocus({ kind: 'unit', layer: conv.name, index: ch * OH * OW + i * OW + j });

  return (
    <section className="panel network conv" aria-label="Convolution view">
      <ModeIndicator exec={exec} />
      <div
        className={`conv-grid${lit.network ? ' net-all' : ''}`}
        data-lit={lit.network ? 'network' : undefined}
      >
        <div className="conv-col">
          <div {...litAttr(stageLit.input, 'input')}>
            <h3>Input</h3>
            {x ? (
              <MapCanvas
                t={x}
                c={0}
                size={168}
                grey
                label={`Input image, example ${s?.datasetIndex}: the window shows the receptive field of output cell (${oi + 1}, ${oj + 1})`}
                highlight={win}
              />
            ) : (
              <p className="small muted">Load an example to see it.</p>
            )}
            {s && (
              <p className="small">
                target: {header.dataset.classes?.[Array.from(s.y.data).indexOf(1)] ?? '—'}
              </p>
            )}
          </div>
        </div>
        <div className="conv-col">
          <div {...litAttr(stageLit.kernels, 'kernels')}>
            <h3>Kernels ({conv.name})</h3>
            <div className="kernels">
              {K ? (
                Array.from({ length: F }, (_, q) => (
                  <div key={q} className={`kernel-box${q === f ? ' active' : ''}`}>
                    <div className="small">kernel {q + 1}</div>
                    <KernelGrid k={K} f={q} />
                  </div>
                ))
              ) : (
                <p className="small muted">not initialised yet</p>
              )}
            </div>
            {x && K && (
              <p className="computation small" aria-live="off">
                <strong>
                  Window at ({oi + 1}, {oj + 1}), kernel {f + 1}:
                </strong>{' '}
                {terms.length
                  ? `u = ${terms.slice(0, 5).join(' + ')}${terms.length > 5 ? ' + …' : ''} = ${num(dot)}`
                  : 'u = 0 (every pixel under the window is 0)'}
                {b !== undefined ? `; z = u + b = ${num(dot + b)}` : ''}
                {ls?.u ? ` (trace: ${num(ls.u.data[f * OH * OW + cell])})` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="conv-col wide">
          <div {...litAttr(stageLit.maps, 'maps')}>
            <h3>{mapsTitle}</h3>
            <div className="maps">
              {Array.from({ length: F }, (_, q) => {
                const t = mapsTensor;
                return t ? (
                  <MapCanvas
                    key={q}
                    t={t}
                    c={q}
                    size={mapSize}
                    label={`Channel ${q + 1}: ${OH}×${OW} ${backward ? 'error signals' : 'activations'}; click a cell to place the window`}
                    onPick={pick(q)}
                    highlight={q === f ? { r0: oi, c0: oj, h: 1, w: 1 } : null}
                  />
                ) : (
                  <div key={q} className="map placeholder small muted" style={{ width: mapSize }}>
                    channel {q + 1}: not computed yet
                  </div>
                );
              })}
            </div>
          </div>
          {pool && (
            <div {...litAttr(stageLit.pool, 'pool')}>
              <h3>After {(pool.type === 'pool' && 'pooling') || pool.type}</h3>
              {s?.layers[pool.name]?.a ? (
                <div className="maps">
                  {Array.from({ length: F }, (_, q) => (
                    <MapCanvas
                      key={q}
                      t={s.layers[pool.name].a!}
                      c={q}
                      size={64}
                      label={`Channel ${q + 1}: after pooling`}
                    />
                  ))}
                </div>
              ) : (
                <p className="small muted">Appears after the pooling layer runs.</p>
              )}
            </div>
          )}
          <div {...litAttr(stageLit.head, 'head')}>
            <h3>Prediction</h3>
            {probs ? (
              <ul className="probs">
                {Array.from(probs.data).map((p, k) => (
                  <li key={k}>
                    <span className="prob-label">{header.dataset.classes?.[k] ?? `class ${k + 1}`}</span>
                    <span className="prob-bar" style={{ width: `${Math.max(1, p * 100)}%` }} />
                    <span className="num">{num(p * 100)}%</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="small muted">Appears after the output layer runs.</p>
            )}
          </div>
          <p {...litAttr(stageLit.loss, 'loss')}>
            Loss for this example:{' '}
            {s?.loss === undefined ? 'not yet computed' : <span className="num">ℓ = {num(s.loss)}</span>}
          </p>
        </div>
      </div>
      <p className="legend">
        Orange = negative, blue = positive (each map scaled to its own largest magnitude); input pixels in
        grey.{' '}
        {sweeping
          ? 'The window sweeps across the output while the cursor is on the convolution; click a feature-map cell to stop it there.'
          : 'Click a feature-map cell to place the window.'}
      </p>
    </section>
  );
}

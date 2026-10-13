/**
 * The standard figure set, built from a trace alone (no engine, no DOM):
 * architecture, forward- and backward-pass snapshots, loss curve, gradient
 * magnitude by layer, decision-boundary evolution and convolution feature
 * maps. Each figure is a standalone vector SVG plus a CSV of exactly the
 * numbers it draws, so every claim in a manuscript traces back to data.
 * The same functions run in the app's worker (in-app export) and in
 * scripts/export-figures.ts (batch export from any trace file).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TraceHeader } from '../core/npm/ir';
import type { TraceSource } from '../core/npm/source';
import { epochSummaries, reconstructState, type EpochSummary, type ExecState } from '../core/npm/state';
import type { Tensor } from '../core/tensor/tensor';
import { NetworkView } from '../views/execution/NetworkView';
import { toCsv, type Cell } from './csv';
import { diverging, INK, mapColour, pixel, sequential, type PrintMode } from './ink';
import { fmt, frame, pow10, text, ticks } from './svg';

export type FigureId =
  | 'architecture'
  | 'forward-pass'
  | 'backward-pass'
  | 'loss-curve'
  | 'gradient-magnitude'
  | 'decision-boundary'
  | 'feature-maps';

export interface Figure {
  id: FigureId;
  title: string;
  caption: string;
  svg: string;
  csv: string;
}

export interface FigureOptions {
  mode: PrintMode;
  /** Replaces the automatic caption of the figure with this id. */
  captions?: Partial<Record<FigureId, string>>;
}

const figure = (
  id: FigureId,
  title: string,
  auto: string,
  body: string,
  w: number,
  h: number,
  csv: string,
  o: FigureOptions,
): Figure => {
  const caption = o.captions?.[id] ?? auto;
  return { id, title, caption, svg: frame(body, w, h, { title, caption, mode: o.mode }), csv };
};

const where = (h: TraceHeader, exec: ExecState): string => {
  const p = exec.current?.path;
  if (!p) return 'before training';
  const parts = [`epoch ${(p.epoch ?? 0) + 1}`];
  if (p.batch !== null) parts.push(`batch ${p.batch + 1}`);
  if (exec.sample) parts.push(`example #${exec.sample.datasetIndex}`);
  return `${parts.join(', ')}, instruction ${exec.current!.id} of ${h.length}`;
};

const paramCount = (h: TraceHeader, layer: string): number =>
  h.model.params.filter((p) => p.layer === layer).reduce((s, p) => s + p.shape.reduce((a, b) => a * b, 1), 0);

// ------------------------------------------------------------------ architecture

export function architecture(h: TraceHeader, o: FigureOptions): Figure {
  const ink = INK[o.mode];
  const boxes = [
    { name: 'Input', kind: h.dataset.name, shape: h.model.inputShape, params: 0 },
    ...h.model.layers.map((l) => ({
      name: `${l.name} · ${l.type}`,
      kind: l.activation ?? '',
      shape: l.outShape,
      params: paramCount(h, l.name),
    })),
  ];
  const bw = 112,
    bh = 64,
    gap = 26,
    perRow = 6;
  const rows = Math.ceil(boxes.length / perRow);
  const W = Math.min(boxes.length, perRow) * (bw + gap) - gap;
  const H = rows * (bh + 40) - 40;
  const pos = (k: number) => ({ x: (k % perRow) * (bw + gap), y: Math.floor(k / perRow) * (bh + 40) });
  let body = `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${ink.axis}"/></marker></defs>`;
  boxes.forEach((b, k) => {
    const { x, y } = pos(k);
    body += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" fill="#ffffff" stroke="${ink.text}" stroke-width="${o.mode === 'highContrast' ? 2 : 1.2}"/>`;
    body += text(x + bw / 2, y + 17, b.name, { size: 11, anchor: 'middle', weight: 700, fill: ink.text });
    body += text(x + bw / 2, y + 32, b.kind, { size: 10, anchor: 'middle', fill: ink.muted });
    body += text(x + bw / 2, y + 46, `[${b.shape.join('×')}]`, {
      size: 10,
      anchor: 'middle',
      fill: ink.text,
    });
    if (k > 0)
      body += text(x + bw / 2, y + 59, `${b.params} params`, {
        size: 9.5,
        anchor: 'middle',
        fill: ink.muted,
      });
    if (k + 1 < boxes.length) {
      const n = pos(k + 1);
      body +=
        n.y === y
          ? `<line x1="${x + bw}" y1="${y + bh / 2}" x2="${n.x - 2}" y2="${y + bh / 2}" stroke="${ink.axis}" stroke-width="1.4" marker-end="url(#arr)"/>`
          : `<path d="M${x + bw / 2},${y + bh} V${y + bh + 20} H${n.x + bw / 2} V${n.y - 2}" fill="none" stroke="${ink.axis}" stroke-width="1.4" marker-end="url(#arr)"/>`;
    }
  });
  const total = h.model.layers.reduce((s, l) => s + paramCount(h, l.name), 0);
  const csv = toCsv(
    ['layer', 'type', 'activation', 'in_shape', 'out_shape', 'params'],
    h.model.layers.map((l) => ({
      layer: l.name,
      type: l.type,
      activation: l.activation,
      in_shape: l.inShape.join('x'),
      out_shape: l.outShape.join('x'),
      params: paramCount(h, l.name),
    })),
  );
  return figure(
    'architecture',
    'Network architecture',
    `${h.model.layers.length} layers, ${total} trainable parameters, trained on ${h.dataset.name} (${h.dataset.n} examples). Shapes are per example.`,
    body,
    W,
    H,
    csv,
    o,
  );
}

// ------------------------------------------------------------------ execution snapshots

const PRINT_CSS = (o: FigureOptions) => {
  const ink = INK[o.mode];
  return `text{font-family:'DejaVu Sans',Arial,sans-serif;fill:${ink.text}}.col-label{font-size:14px;font-weight:700}.node circle{stroke:${ink.text};stroke-width:1.2}.node.active circle{stroke:${o.mode === 'colour' ? '#f0b400' : '#000'};stroke-width:4}.node-value{font-size:11px;font-weight:700}.bias{font-size:12px;fill:${ink.muted}}.grad{font-size:12px;font-weight:700}.loss-box rect{fill:#f2f2f2;stroke:${ink.text}}.loss-box.active rect{stroke-width:3}.loss-box text{font-size:12.5px}.loss-value{font-weight:700}.edge .hit{display:none}${o.mode === 'highContrast' ? '.edge line{stroke-opacity:1}' : ''}.edge .delta{stroke:${o.mode === 'colour' ? '#00785a' : '#000'};stroke-dasharray:1 3;stroke-linecap:round}`;
};

/** The app's own Neural Execution View, rendered without interaction, then converted to the print mode. */
function networkSvg(
  h: TraceHeader,
  exec: ExecState,
  o: FigureOptions,
): { body: string; w: number; h: number } {
  const html = renderToStaticMarkup(
    createElement(NetworkView, { header: h, exec, focus: null, onFocus: () => undefined }),
  );
  let svg = html.slice(html.indexOf('<svg'), html.indexOf('</svg>') + 6);
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!;
  svg = svg
    .replace(/var\(--surface\)/g, '#ffffff')
    .replace(/var\(--text\)/g, INK[o.mode].text)
    .replace(/ (tabindex|role|aria-[a-z]+)="[^"]*"/g, '')
    .replace(/<title>[^<]*<\/title>/g, '');
  if (o.mode !== 'colour') {
    svg = svg
      .replace(
        /(fill|stroke)="(#[0-9a-fA-F]{6}|rgb\([^)]*\))"/g,
        (_, a: 'fill' | 'stroke', c: string) => `${a}="${mapColour(c, a, o.mode)}"`,
      )
      .replace(
        /style="([^"]*)"/g,
        (_, st: string) =>
          `style="${st.replace(
            /(fill|color):\s*(#[0-9a-fA-F]{6}|rgb\([^)]*\))/g,
            (__, a: string, c: string) =>
              o.mode === 'highContrast' && a === 'fill'
                ? 'fill:#000000'
                : `${a}:${mapColour(c, a === 'fill' ? 'fill' : 'stroke', o.mode)}`,
          )}"`,
      );
  }
  const inner = svg.slice(svg.indexOf('>') + 1, svg.lastIndexOf('</svg>'));
  const w = Number(vb[1]),
    hh = Number(vb[2]);
  return {
    body: `<style>${PRINT_CSS(o)}</style><svg width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}">${inner}</svg>`,
    w,
    h: hh,
  };
}

function stateCsv(h: TraceHeader, exec: ExecState): string {
  const rows: Record<string, Cell>[] = [];
  exec.sample?.x.data.forEach((v, i) => rows.push({ layer: 'input', unit: i + 1, a: v }));
  for (const l of h.model.layers) {
    const s = exec.sample?.layers[l.name];
    const n = l.outShape.reduce((a, b) => a * b, 1);
    for (let i = 0; i < n; i++)
      rows.push({
        layer: l.name,
        unit: i + 1,
        u: s?.u?.data[i],
        z: s?.z?.data[i],
        a: s?.a?.data[i],
        dL_dz: s?.gradZ?.data[i],
        bias: l.type === 'dense' ? exec.params[`${l.name}.b`]?.value.data[i] : undefined,
      });
  }
  for (const [name, p] of Object.entries(exec.params))
    p.value.data.forEach((v, i) =>
      rows.push({ layer: name, unit: i + 1, param_value: v, batch_grad: exec.lastGrads?.[name]?.data[i] }),
    );
  return toCsv(['layer', 'unit', 'u', 'z', 'a', 'dL_dz', 'bias', 'param_value', 'batch_grad'], rows);
}

export function snapshot(
  src: TraceSource,
  cursor: number,
  id: 'forward-pass' | 'backward-pass',
  o: FigureOptions,
): Figure {
  const exec = reconstructState(src, cursor);
  const h = src.header;
  if (h.model.layers.some((l) => l.type === 'conv2d')) return featureMaps(src, cursor, o, id);
  const { body, w, h: hh } = networkSvg(h, exec, o);
  const what = id === 'forward-pass' ? 'Forward pass' : 'Backward pass';
  const cap =
    id === 'forward-pass'
      ? `Neural Execution View at ${where(h, exec)} (${exec.current?.kind ?? 'start'}). Numbers in neurons are activations; line thickness is |weight|, solid lines positive and dashed negative.`
      : `Neural Execution View at ${where(h, exec)} (${exec.current?.kind ?? 'start'}). Values under neurons are the error signals ∂ℓ/∂z flowing backwards; arrows point in the direction of the backward pass.`;
  return figure(id, `${what} — ${h.dataset.name}`, cap, body, w, hh, stateCsv(h, exec), o);
}

// ------------------------------------------------------------------ convolution feature maps

/**
 * Negative cells in greyscale/high contrast get one diagonal stroke each, all
 * in a single path — far smaller in SVG and PDF than a pattern fill per cell.
 */
const hatchMark = (x: number, y: number, c: number): string =>
  `M${(x + c * 0.15).toFixed(2)},${(y + c * 0.85).toFixed(2)}L${(x + c * 0.85).toFixed(2)},${(y + c * 0.15).toFixed(2)}`;
const hatchPath = (d: string): string =>
  d ? `<path d="${d}" stroke="#000" stroke-width="0.7" fill="none"/>` : '';

function grid(
  t: Tensor,
  c: number,
  x: number,
  y: number,
  cell: number,
  o: FigureOptions,
  kind: 'image' | 'signed',
): string {
  const [H, W] = t.shape.slice(-2);
  const off = c * H * W;
  let m = 1e-12;
  for (let k = 0; k < H * W; k++) m = Math.max(m, Math.abs(t.data[off + k]));
  let s = '';
  let marks = '';
  for (let i = 0; i < H; i++)
    for (let j = 0; j < W; j++) {
      const v = t.data[off + i * W + j];
      const rx = x + j * cell,
        ry = y + i * cell;
      if (kind === 'image')
        s += `<rect x="${rx}" y="${ry}" width="${cell}" height="${cell}" fill="${pixel(v)}"/>`;
      else {
        const d = diverging(v / m, o.mode);
        s += `<rect x="${rx}" y="${ry}" width="${cell}" height="${cell}" fill="${d.fill}"/>`;
        if (d.hatch) marks += hatchMark(rx, ry, cell);
      }
    }
  return (
    s +
    hatchPath(marks) +
    `<rect x="${x}" y="${y}" width="${W * cell}" height="${H * cell}" fill="none" stroke="${INK[o.mode].text}" stroke-width="0.8"/>`
  );
}

export function featureMaps(
  src: TraceSource,
  cursor: number,
  o: FigureOptions,
  id: FigureId = 'feature-maps',
): Figure {
  const h = src.header;
  const ink = INK[o.mode];
  const exec = reconstructState(src, cursor);
  const ci = h.model.layers.findIndex((l) => l.type === 'conv2d');
  const conv = h.model.layers[ci];
  const pool = h.model.layers.find((l, k) => k > ci && l.type === 'pool');
  const s = exec.sample;
  const K = exec.params[`${conv.name}.W`]?.value;
  const ls = s?.layers[conv.name];
  const backward = id === 'backward-pass';
  const maps = backward ? ls?.gradZ : (ls?.a ?? ls?.z ?? ls?.u);
  const F = conv.outShape[0];
  const rows: Record<string, Cell>[] = [];
  let body = '';
  let y: number;
  const label = (x: number, yy: number, t: string) => text(x, yy, t, { size: 10.5, fill: ink.text });
  if (s) {
    body += label(0, 10, `Input (example #${s.datasetIndex})`) + grid(s.x, 0, 0, 16, 4, o, 'image');
    s.x.data.forEach((v, k) =>
      rows.push({
        kind: 'input',
        channel: 1,
        row: Math.floor(k / s.x.shape[3]) + 1,
        col: (k % s.x.shape[3]) + 1,
        value: v,
      }),
    );
  }
  if (K) {
    const [, , KH, KW] = K.shape;
    for (let f = 0; f < F; f++) {
      const x = 130 + f * (KW * 18 + 14);
      body += label(x, 10, `kernel ${f + 1}`);
      const kt = {
        shape: [1, 1, KH, KW],
        data: K.data.subarray(f * KH * KW * K.shape[1], f * KH * KW * K.shape[1] + KH * KW),
      } as unknown as Tensor;
      body += grid(kt, 0, x, 16, 18, o, 'signed');
      for (let q = 0; q < KH * KW; q++) {
        body += text(x + (q % KW) * 18 + 9, 16 + Math.floor(q / KW) * 18 + 12, fmt(kt.data[q], 2), {
          size: 6.5,
          anchor: 'middle',
          fill: ink.text,
        });
        rows.push({
          kind: 'kernel',
          channel: f + 1,
          row: Math.floor(q / KW) + 1,
          col: (q % KW) + 1,
          value: kt.data[q],
        });
      }
    }
  }
  y = 136;
  const [, OH, OW] = conv.outShape;
  const cell = Math.max(2, Math.floor(110 / OW));
  body += label(
    0,
    y,
    backward ? 'Error signal ∂ℓ/∂z per channel' : ls?.a ? 'Feature maps (after activation)' : 'Feature maps',
  );
  for (let f = 0; f < F; f++) {
    const x = f * (OW * cell + 14);
    if (maps) {
      body +=
        grid(maps, f, x, y + 8, cell, o, 'signed') + label(x, y + 8 + OH * cell + 13, `channel ${f + 1}`);
      for (let q = 0; q < OH * OW; q++)
        rows.push({
          kind: backward ? 'dL_dz' : 'feature_map',
          channel: f + 1,
          row: Math.floor(q / OW) + 1,
          col: (q % OW) + 1,
          value: maps.data[f * OH * OW + q],
        });
    } else body += label(x, y + 30, `channel ${f + 1}: not computed`);
  }
  y += 8 + OH * cell + 30;
  const pooled = pool ? s?.layers[pool.name]?.a : undefined;
  if (pool && pooled && !backward) {
    const [, PH, PW] = pool.outShape;
    const pc = Math.max(2, Math.floor(80 / PW));
    body += label(0, y, 'After pooling');
    for (let f = 0; f < F; f++) {
      body += grid(pooled, f, f * (PW * pc + 14), y + 8, pc, o, 'signed');
      for (let q = 0; q < PH * PW; q++)
        rows.push({
          kind: 'pooled',
          channel: f + 1,
          row: Math.floor(q / PW) + 1,
          col: (q % PW) + 1,
          value: pooled.data[f * PH * PW + q],
        });
    }
    y += 8 + PH * pc + 10;
  }
  const W = Math.max(F * (OW * cell + 14), 130 + F * ((K?.shape[3] ?? 3) * 18 + 14));
  const signNote =
    o.mode === 'colour'
      ? 'blue positive, orange negative'
      : 'darker = larger magnitude, a diagonal stroke marks negative cells';
  const cap = `${backward ? 'Backward' : 'Forward'} pass through the convolution layer at ${where(h, exec)}. Each map is scaled to its own largest magnitude (${signNote}); kernel values are printed in each cell.`;
  return figure(
    id,
    `${backward ? 'Backward pass' : 'Convolution feature maps'} — ${h.dataset.name}`,
    cap,
    body,
    W,
    y,
    toCsv(['kind', 'channel', 'row', 'col', 'value'], rows),
    o,
  );
}

// ------------------------------------------------------------------ charts from epoch summaries

interface Series {
  name: string;
  values: (number | null)[];
}

function lineChart(
  x0: number,
  y0: number,
  w: number,
  h: number,
  n: number,
  series: Series[],
  o: FigureOptions,
  yLabel: string,
  opts: { log?: boolean; yMin?: number; yMax?: number },
): string {
  const ink = INK[o.mode];
  const all = series
    .flatMap((s) => s.values)
    .filter((v): v is number => v !== null && Number.isFinite(v) && (!opts.log || v > 0));
  let lo = opts.yMin ?? Math.min(...all),
    hi = opts.yMax ?? Math.max(...all);
  if (lo === hi) [lo, hi] = [lo - 1, hi + 1];
  const ly = (v: number) => (opts.log ? Math.log10(v) : v);
  const Y = (v: number) => y0 + h - ((ly(v) - ly(lo)) / (ly(hi) - ly(lo))) * h;
  const X = (e: number) => x0 + (n <= 1 ? w / 2 : (e / (n - 1)) * w);
  let s = '';
  for (const t of ticks(lo, hi, 4, opts.log)) {
    s += `<line x1="${x0}" x2="${x0 + w}" y1="${Y(t)}" y2="${Y(t)}" stroke="${ink.grid}" stroke-width="0.8"/>`;
    s += text(x0 - 5, Y(t) + 3.5, fmt(t, 3), { size: 9, anchor: 'end', fill: ink.muted });
  }
  for (const t of ticks(1, n, 6).filter(Number.isInteger))
    s += text(X(t - 1), y0 + h + 13, String(t), { size: 9, anchor: 'middle', fill: ink.muted });
  s += `<line x1="${x0}" x2="${x0 + w}" y1="${y0 + h}" y2="${y0 + h}" stroke="${ink.axis}"/>`;
  s += text(x0 - 38, y0 + h / 2, yLabel, { size: 10, anchor: 'middle', fill: ink.text, rotate: true });
  series.forEach((ser, k) => {
    const pts = ser.values.map((v, e) =>
      v === null || !Number.isFinite(v) || (opts.log && v <= 0)
        ? null
        : `${X(e).toFixed(1)},${Y(v).toFixed(1)}`,
    );
    const d = pts
      .reduce<string>((acc, p, e) => (p ? acc + (acc && pts[e - 1] ? ` L${p}` : ` M${p}`) : acc), '')
      .trim();
    if (d)
      s += `<path d="${d}" fill="none" stroke="${ink.series[k]}" stroke-width="${ink.stroke}" stroke-dasharray="${ink.dashes[k]}" stroke-linejoin="round"/>`;
    if (n <= 12)
      pts.forEach(
        (p) =>
          p &&
          (s += `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="2.6" fill="${ink.series[k]}"/>`),
      );
  });
  return s;
}

function legend(x: number, y: number, names: string[], o: FigureOptions): string {
  const ink = INK[o.mode];
  return names
    .map(
      (nm, k) =>
        `<line x1="${x}" x2="${x + 22}" y1="${y + k * 14}" y2="${y + k * 14}" stroke="${ink.series[k]}" stroke-width="${ink.stroke}" stroke-dasharray="${ink.dashes[k]}"/>` +
        text(x + 27, y + k * 14 + 3.5, nm, { size: 9.5, fill: ink.text }),
    )
    .join('');
}

export function lossCurve(h: TraceHeader, epochs: EpochSummary[], o: FigureOptions): Figure {
  const n = epochs.length;
  const loss: Series[] = [
    { name: 'training loss (mean over the epoch)', values: epochs.map((e) => e.meanLoss) },
    { name: 'loss after the epoch, training set', values: epochs.map((e) => e.evalLoss) },
  ];
  if (epochs.some((e) => e.testLoss !== null))
    loss.push({ name: 'loss after the epoch, test set', values: epochs.map((e) => e.testLoss) });
  const finite = loss
    .flatMap((s) => s.values)
    .filter((v): v is number => v !== null && Number.isFinite(v) && v > 0);
  const log = finite.length > 0 && Math.max(...finite) / Math.min(...finite) > 50;
  const hasAcc = epochs.some((e) => e.evalAccuracy !== null);
  // Legends sit above their panel, never over the data.
  const W = 460;
  const H1 = 170;
  const H2 = 90;
  const L1 = loss.length * 14 + 6;
  let body = legend(
    48,
    6,
    loss.map((s) => s.name),
    o,
  );
  body += lineChart(48, L1, W - 60, H1, n, loss, o, 'Loss', { log });
  let y = L1 + H1 + 24;
  if (hasAcc) {
    const acc: Series[] = [
      {
        name: 'accuracy, training set',
        values: epochs.map((e) => (e.evalAccuracy === null ? null : e.evalAccuracy * 100)),
      },
    ];
    if (epochs.some((e) => e.testAccuracy !== null))
      acc.push({
        name: 'accuracy, test set',
        values: epochs.map((e) => (e.testAccuracy === null ? null : e.testAccuracy * 100)),
      });
    body += legend(
      48,
      y,
      acc.map((s) => s.name),
      o,
    );
    y += acc.length * 14;
    body += lineChart(48, y, W - 60, H2, n, acc, o, 'Accuracy (%)', { yMin: 0, yMax: 100 });
    y += H2 + 24;
  }
  body += text(48 + (W - 60) / 2, y + 6, 'Epoch', { size: 10, anchor: 'middle', fill: INK[o.mode].text });
  const csv = toCsv(
    ['epoch', 'train_loss_running', 'eval_loss', 'test_loss', 'eval_accuracy', 'test_accuracy'],
    epochs.map((e) => ({
      epoch: e.epoch + 1,
      train_loss_running: e.meanLoss,
      eval_loss: e.evalLoss,
      test_loss: e.testLoss,
      eval_accuracy: e.evalAccuracy,
      test_accuracy: e.testAccuracy,
    })),
  );
  return figure(
    'loss-curve',
    `Loss${hasAcc ? ' and accuracy' : ''} by epoch — ${h.dataset.name}`,
    `${n} epochs.${log ? ' Loss on a logarithmic axis.' : ''} Loss and accuracy are separate panels sharing the epoch axis.`,
    body,
    W,
    y + 10,
    csv,
    o,
  );
}

export function gradientMagnitude(h: TraceHeader, epochs: EpochSummary[], o: FigureOptions): Figure {
  const ink = INK[o.mode];
  const names = h.model.params.filter((p) => p.role === 'weight').map((p) => p.name);
  const idx = names.map((nm) => epochs[0]?.params.indexOf(nm) ?? -1);
  const vals = epochs.map((e) => idx.map((k) => e.gradNorms[k]));
  const logs = vals
    .flat()
    .filter((v) => v > 0 && Number.isFinite(v))
    .map(Math.log10);
  const lo = Math.floor(Math.min(...logs, 0)),
    hi = Math.ceil(Math.max(...logs, lo + 1));
  const cw = Math.max(4, Math.min(28, Math.floor(380 / Math.max(1, epochs.length)))),
    ch = 18;
  let body = '';
  names.forEach((nm, r) => {
    body += text(56, 14 + r * ch + 12, nm, { size: 9.5, anchor: 'end', fill: ink.text });
    epochs.forEach((_, c) => {
      const v = vals[c][r];
      const fill =
        v > 0 && Number.isFinite(v) ? sequential((Math.log10(v) - lo) / (hi - lo), o.mode) : '#ffffff';
      body += `<rect x="${62 + c * cw}" y="${14 + r * ch}" width="${cw - 1}" height="${ch - 1}" fill="${fill}"/>`;
    });
  });
  const gx = 62 + epochs.length * cw + 20;
  for (let k = 0; k <= 10; k++)
    body += `<rect x="${gx}" y="${14 + (10 - k) * 9}" width="12" height="9" fill="${sequential(k / 10, o.mode)}"/>`;
  body +=
    text(gx + 16, 22, pow10(hi), { size: 9, fill: ink.text }) +
    text(gx + 16, 14 + 99, pow10(lo), { size: 9, fill: ink.text });
  body += text(62, 14 + names.length * ch + 14, `Epoch 1 → ${epochs.length}`, { size: 9.5, fill: ink.muted });
  const csv = toCsv(
    ['epoch', 'param', 'mean_grad_norm'],
    epochs.flatMap((e, c) =>
      names.map((nm, r) => ({ epoch: e.epoch + 1, param: nm, mean_grad_norm: vals[c][r] })),
    ),
  );
  return figure(
    'gradient-magnitude',
    `Gradient magnitude per layer — ${h.dataset.name}`,
    'Mean L2 norm of each weight tensor’s batch gradient over the epoch, on a logarithmic scale (darker = larger). A pale top row with a dark bottom row is the signature of vanishing gradients.',
    body,
    gx + 60,
    Math.max(14 + names.length * ch + 20, 120),
    csv,
    o,
  );
}

// ------------------------------------------------------------------ decision boundary evolution

export function decisionBoundary(
  src: TraceSource,
  o: FigureOptions,
  upTo = src.header.epochStarts.length - 2,
): Figure | null {
  const h = src.header;
  const ink = INK[o.mode];
  const evals = Array.from({ length: upTo + 1 }, (_, e) => src.get(h.epochStarts[e + 1] - 2)).filter(
    (i) => i.results.boundary,
  );
  if (!evals.length || !h.dataset.xs || h.dataset.inputShape[0] !== 2) return null;
  const pick = [
    ...new Set([
      0,
      Math.round((evals.length - 1) / 3),
      Math.round((2 * (evals.length - 1)) / 3),
      evals.length - 1,
    ]),
  ].map((k) => evals[k]);
  const S = 130,
    gap = 16;
  const rows: Record<string, Cell>[] = [];
  let body = '';
  pick.forEach((ev, k) => {
    let marks = '';
    const b = ev.results.boundary;
    const [x0, x1, y0, y1] = ev.meta.bounds as number[];
    const res = b.shape[0];
    const ox = k * (S + gap),
      oy = 16,
      c = S / res;
    body += text(ox, 10, `after epoch ${(ev.path.epoch ?? 0) + 1}`, { size: 10, fill: ink.text });
    for (let r = 0; r < res; r++)
      for (let q = 0; q < res; q++) {
        const p = b.data[r * res + q];
        const d = diverging((p - 0.5) * 2, o.mode);
        body += `<rect x="${(ox + q * c).toFixed(2)}" y="${(oy + (res - 1 - r) * c).toFixed(2)}" width="${(c + 0.05).toFixed(2)}" height="${(c + 0.05).toFixed(2)}" fill="${d.fill}"/>`;
        if (d.hatch) marks += hatchMark(ox + q * c, oy + (res - 1 - r) * c, c);
        rows.push({
          epoch: (ev.path.epoch ?? 0) + 1,
          x: x0 + ((x1 - x0) * (q + 0.5)) / res,
          y: y0 + ((y1 - y0) * (r + 0.5)) / res,
          p_class1: p,
        });
      }
    body += hatchPath(marks);
    const xs = h.dataset.xs!,
      ys = h.dataset.ys!;
    const out = ys.shape[1] ?? 1;
    for (let i = 0; i < h.dataset.n; i++) {
      const px = ox + ((xs.data[2 * i] - x0) / (x1 - x0)) * S,
        py = oy + S - ((xs.data[2 * i + 1] - y0) / (y1 - y0)) * S;
      const cls = out === 1 ? ys.data[i] >= 0.5 : ys.data[i * out] < 0.5;
      body += cls
        ? `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.6" fill="#ffffff" stroke="#000" stroke-width="0.9"/>`
        : `<rect x="${(px - 2.4).toFixed(1)}" y="${(py - 2.4).toFixed(1)}" width="4.8" height="4.8" fill="#000"/>`;
    }
    body += `<rect x="${ox}" y="${oy}" width="${S}" height="${S}" fill="none" stroke="${ink.text}" stroke-width="0.8"/>`;
  });
  const note =
    o.mode === 'colour'
      ? 'blue = class 1 likely, orange = class 0 likely'
      : 'darker = more confident; a diagonal stroke marks the class 0 side';
  return figure(
    'decision-boundary',
    `Decision boundary over training — ${h.dataset.name}`,
    `Predicted probability of class 1 over the input plane after selected epochs (${note}). ○ class 1, ■ class 0 training points.`,
    body,
    pick.length * (S + gap) - gap,
    S + 18,
    toCsv(['epoch', 'x', 'y', 'p_class1'], rows),
    o,
  );
}

// ------------------------------------------------------------------ standard set

/** Cursors for the snapshots: the first example of the last epoch, at its loss (forward) and when its error reaches layer 1 (backward). */
export function snapshotCursors(
  src: TraceSource,
  epoch = src.header.epochStarts.length - 2,
): { forward: number; backward: number } {
  const ins = src.range(src.header.epochStarts[epoch], src.header.epochStarts[epoch + 1]);
  const forward = ins.find((i) => i.kind === 'COMPUTE_LOSS')!.id;
  const first = src.header.model.layers[0].name;
  const backward =
    ins.find((i) => i.id > forward && i.kind === 'BACKWARD_LAYER_END' && i.path.layer === first)?.id ??
    forward;
  return { forward, backward };
}

/**
 * Every applicable figure for a trace. With `cursor`, the snapshots and the
 * epoch-based charts show the state at that instruction (what the views show);
 * without it, the whole run.
 */
export function figureSet(src: TraceSource, o: FigureOptions, cursor?: number): Figure[] {
  const h = src.header;
  const all = epochSummaries(src);
  const done = cursor === undefined ? all.length : reconstructState(src, cursor).completedEpochs;
  const epochs = all.slice(0, done);
  const snap = cursor === undefined ? snapshotCursors(src) : { forward: cursor, backward: cursor };
  const conv = h.model.layers.some((l) => l.type === 'conv2d');
  const out: (Figure | null)[] = [
    architecture(h, o),
    snapshot(src, snap.forward, 'forward-pass', o),
    cursor === undefined ? snapshot(src, snap.backward, 'backward-pass', o) : null,
    epochs.length ? lossCurve(h, epochs, o) : null,
    epochs.length ? gradientMagnitude(h, epochs, o) : null,
    epochs.length ? decisionBoundary(src, o, epochs.length - 1) : null,
    conv && cursor === undefined ? featureMaps(src, snap.forward, o) : null,
  ];
  return out.filter((f): f is Figure => f !== null);
}

/**
 * Generates the publication figures in figures/ from real runs:
 *   forward-pass, backward-pass  — the Neural Execution View rendered from a trace state (no UI chrome)
 *   loss-curve, parity-overlay, vanishing-gradients — data written as CSV here, plotted by figures/plot.py
 * Every figure has a CSV of its underlying numbers beside it.
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveDataset } from '../src/core/engine/host';
import * as D from '../src/core/engine/datasets';
import { TrainingSession, type TrainConfig } from '../src/core/engine/session';
import { TraceStore, reconstructState, storeSource, type ExecState, type TraceSource } from '../src/core/npm';
import { experimentById } from '../src/experiments/registry';
import { NetworkView } from '../src/views/execution/NetworkView';
import { ARCHITECTURES } from '../tests/parity/architectures';
import { initTf, runParity } from '../tests/parity/oracle';

const OUT = resolve(import.meta.dirname, '../figures');
const csv = (name: string, head: string[], rows: (string | number)[][]): void =>
  writeFileSync(resolve(OUT, name), [head.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n');

// Print styles replace the app's CSS variables and interactive affordances; greyscale-safe because
// sign is also carried by dash pattern and every value is printed.
const PRINT_CSS = `
  text { font-family: 'DejaVu Sans', Arial, sans-serif; fill: #000; }
  .col-label { font-size: 14px; font-weight: 700; }
  .node circle { stroke: #000; stroke-width: 1.2; }
  .node.active circle { stroke: #000; stroke-width: 4; }
  .node-value { font-size: 13.5px; font-weight: 700; }
  .bias { font-size: 12px; fill: #333; }
  .grad { font-size: 12px; font-weight: 700; fill: #000; }
  .loss-box rect { fill: #f2f2f2; stroke: #000; }
  .loss-box.active rect { stroke-width: 3; }
  .loss-box text { font-size: 12.5px; }
  .loss-value { font-weight: 700; }
  line { stroke-opacity: 0.9; }
`;

function snapshotSvg(header: TraceSource['header'], exec: ExecState): string {
  const html = renderToStaticMarkup(
    createElement(NetworkView, { header, exec, focus: null, onFocus: () => undefined }),
  );
  const svg = html
    .slice(html.indexOf('<svg'), html.indexOf('</svg>') + 6)
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/var\(--surface\)/g, '#ffffff')
    .replace(/var\(--text\)/g, '#000000');
  const open = svg.indexOf('>') + 1;
  return `${svg.slice(0, open)}<style>${PRINT_CSS}</style>${svg.slice(open)}`;
}

function dumpState(exec: ExecState, header: TraceSource['header']): (string | number)[][] {
  const rows: (string | number)[][] = [];
  exec.sample?.x.data.forEach((v, i) => rows.push(['input', i + 1, '', v, '', '']));
  for (const l of header.model.layers) {
    const s = exec.sample?.layers[l.name];
    const n = l.outShape[0];
    for (let i = 0; i < n; i++)
      rows.push([
        l.name,
        i + 1,
        s?.z?.data[i] ?? '',
        s?.a?.data[i] ?? '',
        s?.gradZ?.data[i] ?? '',
        exec.params[`${l.name}.b`]?.value.data[i] ?? '',
      ]);
  }
  return rows;
}

async function svgToPdf(files: string[]): Promise<void> {
  const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const page = await browser.newPage();
  for (const f of files) {
    const svg = (await import('node:fs')).readFileSync(resolve(OUT, `${f}.svg`), 'utf8');
    await page.setContent(
      `<html><body style="margin:0">${svg.replace('<svg ', '<svg style="width:760px;height:480px" ')}</body></html>`,
    );
    await page.pdf({
      path: resolve(OUT, `${f}.pdf`),
      width: '760px',
      height: '480px',
      printBackground: true,
      pageRanges: '1',
    });
  }
  await browser.close();
}

async function main(): Promise<void> {
  // ---------------------------------------------------------------- execution snapshots (XOR experiment)
  const exp = experimentById('xor-mlp');
  const { store } = TraceStore.generate(exp.config, resolveDataset(exp.dataset));
  const src = storeSource(store);
  const e = 40;
  const epoch = src.range(src.header.epochStarts[e], src.header.epochStarts[e + 1]);
  const fwd = epoch.find((i) => i.kind === 'COMPUTE_LOSS')!.id;
  const bwd = epoch.find((i) => i.kind === 'BACKWARD_LAYER_END' && i.path.layer === 'L1')!.id;
  for (const [name, cursor] of [
    ['forward-pass', fwd],
    ['backward-pass', bwd],
  ] as const) {
    const exec = reconstructState(src, cursor);
    writeFileSync(resolve(OUT, `${name}.svg`), snapshotSvg(src.header, exec) + '\n');
    csv(`${name}.csv`, ['layer', 'unit', 'z', 'a', 'dL_dz', 'bias'], dumpState(exec, src.header));
  }
  await svgToPdf(['forward-pass', 'backward-pass']);

  // ---------------------------------------------------------------- loss curve (XOR experiment)
  const losses: (string | number)[][] = [];
  for (let k = 0; k + 1 < src.header.epochStarts.length; k++) {
    const end = src.get(src.header.epochStarts[k + 1] - 1);
    const ev = src.get(src.header.epochStarts[k + 1] - 2);
    losses.push([
      k + 1,
      end.results.meanLoss.item(),
      ev.results.loss.item(),
      ev.results.accuracy?.item() ?? '',
    ]);
  }
  csv('loss-curve.csv', ['epoch', 'train_loss_running', 'eval_loss', 'eval_accuracy'], losses);

  // ---------------------------------------------------------------- parity overlay (identical seeds)
  await initTf();
  const xorRun = runParity(exp.config, resolveDataset(exp.dataset));
  const cnnArch = ARCHITECTURES.find((a) => a.id === 'cnn')!;
  const cnnRun = runParity({ ...cnnArch.config, epochs: 25 }, cnnArch.data());
  csv(
    'parity-overlay.csv',
    ['model', 'step', 'dlvizlab_loss', 'tfjs_loss', 'abs_diff', 'max_param_abs_diff'],
    [
      ...xorRun.steps.map((s) => [
        'xor-mlp',
        s.step,
        s.oursLoss,
        s.tfLoss,
        Math.abs(s.oursLoss - s.tfLoss),
        s.maxParamAbs,
      ]),
      ...cnnRun.steps.map((s) => [
        'cnn',
        s.step,
        s.oursLoss,
        s.tfLoss,
        Math.abs(s.oursLoss - s.tfLoss),
        s.maxParamAbs,
      ]),
    ],
  );

  // ---------------------------------------------------------------- vanishing gradients (COULD item)
  const depth = 8;
  const rows: (string | number)[][] = [];
  for (const act of ['sigmoid', 'relu'] as const) {
    const cfg: TrainConfig = {
      seed: 5,
      epochs: 1,
      batchSize: 16,
      shuffle: true,
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 0.1 },
      model: {
        inputShape: [2],
        layers: [
          ...Array.from({ length: depth }, () => ({ type: 'dense' as const, units: 8, activation: act })),
          { type: 'dense' as const, units: 1, activation: 'sigmoid' as const },
        ],
      },
    };
    const s = new TrainingSession(cfg, D.circles(64, 3));
    const r = s.runEpoch();
    s.model.params.forEach((p, k) => {
      if (p.role === 'weight') rows.push([act, Number(p.layer.slice(1)), r.gradNorms[k]]);
    });
  }
  csv('vanishing-gradients.csv', ['activation', 'layer', 'mean_weight_grad_norm'], rows);

  execFileSync('python3', [resolve(OUT, 'plot.py')], { stdio: 'inherit' });
  console.log('figures written');
}

void main();

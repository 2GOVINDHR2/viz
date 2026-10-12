#!/usr/bin/env node
/**
 * Independent NPM trace verifier.
 *
 * Re-derives every instruction's results from the results of the instructions
 * it references, using its own implementation of each instruction's semantics
 * (docs/NPM-SPEC.md §4). It imports nothing from the DL-VizLab sources, so
 * agreement shows the trace is self-contained: a consumer needs only the trace
 * and the specification, never the engine.
 *
 * Usage: node tools/npm-verify.mjs trace.json   (exit code 1 on any mismatch)
 */
import { readFileSync } from 'node:fs';

const EPS = 1e-7;
const dec = (v) =>
  v === 'NaN' ? NaN : v === 'Infinity' ? Infinity : v === '-Infinity' ? -Infinity : v === '-0' ? -0 : v;
const T = (shape, data) => ({ shape, data });
const decT = (e) => T(e.shape, e.data.map(dec));
const size = (s) => s.reduce((a, b) => a * b, 1);
const sigm = (x) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)));
const ACT = {
  linear: [(x) => x, () => 1],
  sigmoid: [sigm, (_z, a) => a * (1 - a)],
  tanh: [Math.tanh, (_z, a) => 1 - a * a],
  relu: [(x) => (x > 0 ? x : 0), (z) => (z > 0 ? 1 : 0)],
};

function softmaxRows(t) {
  const k = t.shape.at(-1);
  const out = [];
  for (let r = 0; r < t.data.length / k; r++) {
    const row = t.data.slice(r * k, r * k + k);
    const m = Math.max(...row);
    const e = row.map((v) => Math.exp(v - m));
    const s = e.reduce((a, b) => a + b, 0);
    out.push(...e.map((v) => v / s));
  }
  return T(t.shape, out);
}

function matmul(a, b, ta = false, tb = false) {
  const [m, k] = ta ? [a.shape[1], a.shape[0]] : a.shape;
  const n = tb ? b.shape[0] : b.shape[1];
  const A = (i, p) => (ta ? a.data[p * a.shape[1] + i] : a.data[i * a.shape[1] + p]);
  const B = (p, j) => (tb ? b.data[j * b.shape[1] + p] : b.data[p * b.shape[1] + j]);
  const out = new Array(m * n).fill(0);
  for (let i = 0; i < m; i++)
    for (let j = 0; j < n; j++) for (let p = 0; p < k; p++) out[i * n + j] += A(i, p) * B(p, j);
  return T([m, n], out);
}

/** Visits every (output cell, input cell, kernel cell) triple of a padded, strided correlation. */
function convVisit(xs, ws, stride, pad, visit) {
  const [N, C, H, W] = xs;
  const [F, , KH, KW] = ws;
  const OH = Math.floor((H + 2 * pad - KH) / stride) + 1;
  const OW = Math.floor((W + 2 * pad - KW) / stride) + 1;
  for (let n = 0; n < N; n++)
    for (let f = 0; f < F; f++)
      for (let i = 0; i < OH; i++)
        for (let j = 0; j < OW; j++)
          for (let c = 0; c < C; c++)
            for (let u = 0; u < KH; u++)
              for (let v = 0; v < KW; v++) {
                const r = i * stride + u - pad,
                  q = j * stride + v - pad;
                if (r >= 0 && r < H && q >= 0 && q < W)
                  visit(
                    ((n * F + f) * OH + i) * OW + j,
                    ((n * C + c) * H + r) * W + q,
                    ((f * C + c) * KH + u) * KW + v,
                  );
              }
  return [N, F, OH, OW];
}

function poolVisit(xs, size, stride, visit) {
  const [N, C, H, W] = xs;
  const OH = Math.floor((H - size) / stride) + 1,
    OW = Math.floor((W - size) / stride) + 1;
  for (let nc = 0; nc < N * C; nc++)
    for (let i = 0; i < OH; i++)
      for (let j = 0; j < OW; j++) {
        const cells = [];
        for (let u = 0; u < size; u++)
          for (let v = 0; v < size; v++) cells.push((nc * H + i * stride + u) * W + j * stride + v);
        visit((nc * OH + i) * OW + j, cells);
      }
  return [N, C, OH, OW];
}

function lossValue(kind, p, y) {
  let s = 0;
  if (kind === 'mse') {
    p.data.forEach((v, i) => (s += (v - y.data[i]) ** 2));
    return s / p.data.length;
  }
  if (kind === 'bce') {
    p.data.forEach((v, i) => {
      const q = Math.min(Math.max(v, EPS), 1 - EPS);
      s += y.data[i] * Math.log(q) + (1 - y.data[i]) * Math.log(1 - q);
    });
    return -s / p.data.length;
  }
  const k = p.shape.at(-1),
    rows = p.data.length / k;
  for (let r = 0; r < rows; r++) {
    const row = p.data.slice(r * k, r * k + k),
      m = Math.max(...row);
    const lse = m + Math.log(row.reduce((a, v) => a + Math.exp(v - m), 0));
    row.forEach((v, j) => (s += y.data[r * k + j] * (v - lse)));
  }
  return -s / rows;
}

function lossGrad(kind, p, y) {
  const n = p.data.length;
  if (kind === 'mse')
    return T(
      p.shape,
      p.data.map((v, i) => (2 * (v - y.data[i])) / n),
    );
  if (kind === 'bce')
    return T(
      p.shape,
      p.data.map((q, i) => (q < EPS || q > 1 - EPS ? 0 : (-y.data[i] / q + (1 - y.data[i]) / (1 - q)) / n)),
    );
  const k = p.shape.at(-1),
    rows = n / k,
    s = softmaxRows(p);
  return T(
    p.shape,
    s.data.map((v, i) => {
      const r = Math.floor(i / k);
      let ys = 0;
      for (let j = 0; j < k; j++) ys += y.data[r * k + j];
      return (v * ys - y.data[i]) / rows;
    }),
  );
}

const ops = {
  activate: (fn, z) => (fn === 'softmax' ? softmaxRows(z) : T(z.shape, z.data.map(ACT[fn][0]))),
  addBias: (x, b) => {
    const inner = size(x.shape.slice(2));
    return T(
      x.shape,
      x.data.map((v, i) => v + b.data[Math.floor(i / inner) % x.shape[1]]),
    );
  },
  conv: (x, w, s, p) => {
    const out = [];
    const shape = convVisit(
      x.shape,
      w.shape,
      s,
      p,
      (o, xi, wi) => (out[o] = (out[o] ?? 0) + x.data[xi] * w.data[wi]),
    );
    return T(
      shape,
      Array.from({ length: size(shape) }, (_, i) => out[i] ?? 0),
    );
  },
  pool: (x, mode, sz, st) => {
    const out = [];
    const shape = poolVisit(
      x.shape,
      sz,
      st,
      (o, cells) =>
        (out[o] =
          mode === 'max'
            ? Math.max(...cells.map((c) => x.data[c]))
            : cells.reduce((a, c) => a + x.data[c], 0) / cells.length),
    );
    return T(shape, out);
  },
};

/** Forward pass of the whole model, used to check EVAL_END against the current parameters. */
function forwardModel(header, params, x) {
  let h = x,
    z = x;
  header.config.model.layers.forEach((lc, i) => {
    const L = `L${i + 1}`;
    if (lc.type === 'dense') {
      z = ops.addBias(matmul(h, params[`${L}.W`]), params[`${L}.b`]);
      h = ops.activate(lc.activation, z);
    } else if (lc.type === 'conv2d') {
      z = ops.addBias(ops.conv(h, params[`${L}.W`], lc.stride ?? 1, lc.padding ?? 0), params[`${L}.b`]);
      h = ops.activate(lc.activation, z);
    } else if (lc.type === 'pool') h = ops.pool(h, lc.mode, lc.size, lc.stride ?? lc.size);
    else h = T([h.shape[0], size(h.shape.slice(1))], h.data);
  });
  return { out: h, logits: z };
}

export function verifyTrace(trace, { tolerance = 1e-9 } = {}) {
  const errors = [];
  const vals = new Map();
  const params = {};
  const header = trace.header;
  const lossKind = header.config.loss;
  const close = (a, b) =>
    Math.abs(a - b) <= tolerance * Math.max(1, Math.abs(a), Math.abs(b)) ||
    (Number.isNaN(a) && Number.isNaN(b));
  let epochOrder = null,
    epochLoss = 0,
    batchLosses = [],
    gradNormSums = {};
  const l2 = (t) => Math.sqrt(t.data.reduce((a, v) => a + v * v, 0));
  trace.instructions.forEach((ins, idx) => {
    if (ins.id !== idx) errors.push(`instruction at position ${idx} has id ${ins.id}`);
    const res = Object.fromEntries(Object.entries(ins.results).map(([k, v]) => [k, decT(v)]));
    const opd = (role) => {
      const o = ins.operands.find((x) => x.role === role);
      return o && vals.get(o.ref)?.[o.slot];
    };
    const all = (role) => ins.operands.filter((o) => o.role === role).map((o) => vals.get(o.ref)[o.slot]);
    for (const o of ins.operands)
      if (o.ref >= ins.id || !vals.get(o.ref)?.[o.slot])
        errors.push(`#${ins.id} operand ${o.ref}.${o.slot} unresolved`);
    const expect = (slot, t) => {
      const got = res[slot];
      if (!got || got.shape.join() !== t.shape.join())
        return errors.push(`#${ins.id} ${ins.kind}.${slot}: shape [${got?.shape}] vs expected [${t.shape}]`);
      const bad = got.data.findIndex((v, i) => !close(v, t.data[i]));
      if (bad >= 0)
        errors.push(`#${ins.id} ${ins.kind}.${slot}[${bad}]: ${got.data[bad]} vs expected ${t.data[bad]}`);
    };
    const m = ins.meta;
    const scalar = (v) => T([], [v]);
    switch (ins.kind) {
      case 'INIT_PARAM':
        params[m.param] = res.value;
        break;
      case 'MATMUL':
        expect('out', matmul(opd('input'), opd('weight')));
        break;
      case 'ADD_BIAS':
        expect('out', ops.addBias(opd('input'), opd('bias')));
        break;
      case 'CONV2D':
        expect('out', ops.conv(opd('input'), opd('kernel'), m.stride, m.padding));
        break;
      case 'ACTIVATE':
        expect('out', ops.activate(m.fn, opd('preactivation')));
        break;
      case 'POOL':
        expect('out', ops.pool(opd('input'), m.mode, m.size, m.stride));
        break;
      case 'FLATTEN': {
        const x = opd('input');
        expect('out', T([x.shape[0], size(x.shape.slice(1))], x.data));
        break;
      }
      case 'COMPUTE_LOSS':
        expect(
          'loss',
          scalar(lossValue(m.loss, opd(m.loss === 'cce' ? 'logits' : 'prediction'), opd('target'))),
        );
        break;
      case 'GRAD_INIT':
        expect('grad', lossGrad(m.loss, opd(m.wrt === 'logits' ? 'logits' : 'prediction'), opd('target')));
        break;
      case 'GRAD_ACTIVATE': {
        const g = opd('upstream'),
          z = opd('preactivation'),
          a = opd('activation');
        if (m.fn === 'softmax') {
          const k = a.shape.at(-1);
          expect(
            'grad',
            T(
              a.shape,
              a.data.map((s, i) => {
                const r = Math.floor(i / k) * k;
                let dot = 0;
                for (let j = 0; j < k; j++) dot += g.data[r + j] * a.data[r + j];
                return s * (g.data[i] - dot);
              }),
            ),
          );
        } else
          expect(
            'grad',
            T(
              g.shape,
              g.data.map((v, i) => v * ACT[m.fn][1](z.data[i], a.data[i])),
            ),
          );
        break;
      }
      case 'GRAD_BIAS': {
        const g = opd('upstream');
        const C = g.shape[1],
          inner = size(g.shape.slice(2));
        const out = new Array(C).fill(0);
        g.data.forEach((v, i) => (out[Math.floor(i / inner) % C] += v));
        expect('grad', T([C], out));
        break;
      }
      case 'GRAD_MATMUL_W':
        expect('grad', matmul(opd('input'), opd('upstream'), true, false));
        break;
      case 'GRAD_MATMUL_X':
        expect('grad', matmul(opd('upstream'), opd('weight'), false, true));
        break;
      case 'GRAD_CONV2D': {
        const g = opd('upstream'),
          x = opd('input'),
          w = opd('kernel');
        const dW = new Array(size(w.shape)).fill(0),
          dX = new Array(size(x.shape)).fill(0);
        convVisit(x.shape, w.shape, m.stride, m.padding, (o, xi, wi) => {
          dW[wi] += g.data[o] * x.data[xi];
          dX[xi] += g.data[o] * w.data[wi];
        });
        expect('dW', T(w.shape, dW));
        if (res.dX) expect('dX', T(x.shape, dX));
        break;
      }
      case 'GRAD_POOL': {
        const g = opd('upstream'),
          x = opd('input'),
          out = new Array(size(x.shape)).fill(0);
        poolVisit(x.shape, m.size, m.stride, (o, cells) => {
          if (m.mode === 'max') {
            let best = cells[0];
            for (const c of cells) if (x.data[c] > x.data[best]) best = c;
            out[best] += g.data[o];
          } else for (const c of cells) out[c] += g.data[o] / cells.length;
        });
        expect('grad', T(x.shape, out));
        break;
      }
      case 'GRAD_FLATTEN': {
        const g = opd('upstream');
        if (size(res.grad.shape) !== g.data.length) errors.push(`#${ins.id} GRAD_FLATTEN size`);
        expect('grad', T(res.grad.shape, g.data));
        break;
      }
      case 'LOSS_REDUCE': {
        const ls = all('sample loss');
        expect('loss', scalar(ls.reduce((a, t) => a + t.data[0], 0) / ls.length));
        epochLoss += res.loss.data[0] * ls.length;
        batchLosses.push(res.loss.data[0]);
        break;
      }
      case 'GRAD_ACCUMULATE': {
        gradNormSums[m.param] = (gradNormSums[m.param] ?? 0) + l2(res.grad);
        const gs = all('sample gradient');
        expect(
          'grad',
          T(
            gs[0].shape,
            gs[0].data.map((_, i) => gs.reduce((a, t) => a + t.data[i], 0) / gs.length),
          ),
        );
        break;
      }
      case 'OPTIMIZER_STATE': {
        const g = opd('mean gradient'),
          prev = opd('previous velocity');
        expect(
          'velocity',
          T(
            g.shape,
            g.data.map((v, i) => m.momentum * (prev ? prev.data[i] : 0) + v),
          ),
        );
        break;
      }
      case 'COMPUTE_UPDATE': {
        const src = opd('velocity') ?? opd('mean gradient');
        expect(
          'delta',
          T(
            src.shape,
            src.data.map((v) => -m.lr * v),
          ),
        );
        break;
      }
      case 'APPLY_UPDATE': {
        const p = opd('parameter'),
          d = opd('step');
        expect(
          'value',
          T(
            p.shape,
            p.data.map((v, i) => v + d.data[i]),
          ),
        );
        params[m.param] = res.value;
        break;
      }
      case 'EPOCH_BEGIN': {
        epochOrder = res.order.data;
        epochLoss = 0;
        batchLosses = [];
        gradNormSums = {};
        if ([...epochOrder].sort((a, b) => a - b).some((v, i) => v !== i))
          errors.push(`#${ins.id} order is not a permutation`);
        break;
      }
      case 'BATCH_BEGIN': {
        const B = header.config.batchSize;
        expect(
          'indices',
          T([res.indices.data.length], epochOrder.slice(ins.path.batch * B, ins.path.batch * B + B)),
        );
        break;
      }
      case 'LOAD_INPUT': {
        if (!header.dataset.xs) break;
        const xs = decT(header.dataset.xs),
          ys = decT(header.dataset.ys),
          k = m.datasetIndex;
        const rx = size(xs.shape.slice(1)),
          ry = size(ys.shape.slice(1));
        expect('x', T([1, ...xs.shape.slice(1)], xs.data.slice(k * rx, (k + 1) * rx)));
        expect('y', T([1, ...ys.shape.slice(1)], ys.data.slice(k * ry, (k + 1) * ry)));
        break;
      }
      case 'EVAL_END': {
        if (!header.dataset.xs) break;
        const xs = decT(header.dataset.xs),
          ys = decT(header.dataset.ys);
        const { out, logits } = forwardModel(header, params, xs);
        expect('loss', scalar(lossValue(lossKind, lossKind === 'cce' ? logits : out, ys)));
        break;
      }
      case 'EPOCH_END': {
        expect('meanLoss', scalar(epochLoss / header.dataset.n));
        expect('batchLosses', T([batchLosses.length], batchLosses));
        expect(
          'gradNorms',
          T(
            [m.params.length],
            m.params.map((p) => gradNormSums[p] / batchLosses.length),
          ),
        );
        expect(
          'paramNorms',
          T(
            [m.params.length],
            m.params.map((p) => l2(params[p])),
          ),
        );
        break;
      }
      default:
        break;
    }
    vals.set(ins.id, res);
  });
  return errors;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const trace = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const errors = verifyTrace(trace);
  for (const e of errors.slice(0, 50)) console.error(e);
  console.log(
    errors.length
      ? `FAILED: ${errors.length} mismatches`
      : `OK: ${trace.instructions.length} instructions re-derived independently`,
  );
  process.exit(errors.length ? 1 : 0);
}

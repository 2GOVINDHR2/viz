/**
 * Pure tensor operations (no gradient tracking). Every op validates shapes and
 * throws ShapeError rather than producing NaN from mismatched dimensions
 * (legacy defect D3).
 */
import { type Shape, ShapeError, Tensor, shapeSize, shapesEqual, stridesOf } from './tensor';

// ---------------------------------------------------------------- broadcasting

export function broadcastShapes(a: Shape, b: Shape): number[] {
  const rank = Math.max(a.length, b.length);
  const out = new Array<number>(rank);
  for (let i = 0; i < rank; i++) {
    const da = a[a.length - rank + i] ?? 1;
    const db = b[b.length - rank + i] ?? 1;
    if (da !== db && da !== 1 && db !== 1) {
      throw new ShapeError(`cannot broadcast [${a}] with [${b}]`);
    }
    out[i] = da === 1 ? db : da;
  }
  return out;
}

/** Strides of `shape` viewed inside `outShape`, with 0 on broadcast axes. */
function broadcastStrides(shape: Shape, outShape: Shape): number[] {
  const s = stridesOf(shape);
  const offset = outShape.length - shape.length;
  return outShape.map((d, i) => {
    const j = i - offset;
    if (j < 0) return 0;
    return shape[j] === 1 && d !== 1 ? 0 : s[j];
  });
}

function binary(a: Tensor, b: Tensor, f: (x: number, y: number) => number): Tensor {
  if (shapesEqual(a.shape, b.shape)) {
    const out = new Float64Array(a.size);
    for (let i = 0; i < out.length; i++) out[i] = f(a.data[i], b.data[i]);
    return Tensor.adopt(a.shape, out);
  }
  const shape = broadcastShapes(a.shape, b.shape);
  const n = shapeSize(shape);
  const out = new Float64Array(n);
  const sa = broadcastStrides(a.shape, shape);
  const sb = broadcastStrides(b.shape, shape);
  const idx = new Array<number>(shape.length).fill(0);
  let ia = 0;
  let ib = 0;
  for (let k = 0; k < n; k++) {
    out[k] = f(a.data[ia], b.data[ib]);
    for (let d = shape.length - 1; d >= 0; d--) {
      idx[d]++;
      ia += sa[d];
      ib += sb[d];
      if (idx[d] < shape[d]) break;
      ia -= sa[d] * shape[d];
      ib -= sb[d] * shape[d];
      idx[d] = 0;
    }
  }
  return Tensor.adopt(shape, out);
}

/** Sums `t` over the axes that broadcasting expanded, recovering `shape`. */
export function reduceToShape(t: Tensor, shape: Shape): Tensor {
  if (shapesEqual(t.shape, shape)) return t;
  const out = new Float64Array(shapeSize(shape));
  const so = broadcastStrides(shape, t.shape);
  const idx = new Array<number>(t.shape.length).fill(0);
  let io = 0;
  for (let k = 0; k < t.size; k++) {
    out[io] += t.data[k];
    for (let d = t.shape.length - 1; d >= 0; d--) {
      idx[d]++;
      io += so[d];
      if (idx[d] < t.shape[d]) break;
      io -= so[d] * t.shape[d];
      idx[d] = 0;
    }
  }
  return Tensor.adopt(shape, out);
}

export const add = (a: Tensor, b: Tensor): Tensor => binary(a, b, (x, y) => x + y);
export const sub = (a: Tensor, b: Tensor): Tensor => binary(a, b, (x, y) => x - y);
export const mul = (a: Tensor, b: Tensor): Tensor => binary(a, b, (x, y) => x * y);
export const div = (a: Tensor, b: Tensor): Tensor => binary(a, b, (x, y) => x / y);

// ------------------------------------------------------------------- unary

export function map(a: Tensor, f: (x: number) => number): Tensor {
  const out = new Float64Array(a.size);
  for (let i = 0; i < out.length; i++) out[i] = f(a.data[i]);
  return Tensor.adopt(a.shape, out);
}

export const scale = (a: Tensor, k: number): Tensor => map(a, (x) => x * k);
export const neg = (a: Tensor): Tensor => map(a, (x) => -x);
export const exp = (a: Tensor): Tensor => map(a, Math.exp);
export const log = (a: Tensor): Tensor => map(a, Math.log);
export const square = (a: Tensor): Tensor => map(a, (x) => x * x);

/** Numerically stable logistic: never evaluates exp of a large positive number. */
export function sigmoidScalar(x: number): number {
  if (x >= 0) return 1 / (1 + Math.exp(-x));
  const e = Math.exp(x);
  return e / (1 + e);
}
export const sigmoid = (a: Tensor): Tensor => map(a, sigmoidScalar);
export const tanh = (a: Tensor): Tensor => map(a, Math.tanh);
export const relu = (a: Tensor): Tensor => map(a, (x) => (x > 0 ? x : 0));
export const clip = (a: Tensor, lo: number, hi: number): Tensor =>
  map(a, (x) => (x < lo ? lo : x > hi ? hi : x));

// ------------------------------------------------------------------ reductions

export function sumAll(a: Tensor): Tensor {
  let s = 0;
  for (let i = 0; i < a.size; i++) s += a.data[i];
  return Tensor.scalar(s);
}

export function meanAll(a: Tensor): Tensor {
  if (a.size === 0) throw new ShapeError('mean of empty tensor');
  return Tensor.scalar(sumAll(a).item() / a.size);
}

// ---------------------------------------------------------------- linear algebra

export function matmul(a: Tensor, b: Tensor): Tensor {
  if (a.rank !== 2 || b.rank !== 2)
    throw new ShapeError(`matmul needs rank-2 operands, got [${a.shape}] and [${b.shape}]`);
  const [m, k] = a.shape;
  const [k2, n] = b.shape;
  if (k !== k2) throw new ShapeError(`matmul inner dimensions differ: [${a.shape}] x [${b.shape}]`);
  const out = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let p = 0; p < k; p++) {
      const av = a.data[i * k + p];
      if (av === 0) continue;
      const bo = p * n;
      const oo = i * n;
      for (let j = 0; j < n; j++) out[oo + j] += av * b.data[bo + j];
    }
  }
  return Tensor.adopt([m, n], out);
}

export function transpose2d(a: Tensor): Tensor {
  if (a.rank !== 2) throw new ShapeError(`transpose2d needs rank 2, got [${a.shape}]`);
  const [m, n] = a.shape;
  const out = new Float64Array(m * n);
  for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) out[j * m + i] = a.data[i * n + j];
  return Tensor.adopt([n, m], out);
}

// ----------------------------------------------------------------- bias (axis 1)

/** x: [N, C, ...spatial], b: [C]. Adds b[c] to every element of channel c. */
export function addBias(x: Tensor, b: Tensor): Tensor {
  if (x.rank < 2 || b.rank !== 1 || x.shape[1] !== b.shape[0]) {
    throw new ShapeError(`addBias needs x [N, C, ...] and b [C]; got [${x.shape}] and [${b.shape}]`);
  }
  const [n, c] = x.shape;
  const inner = x.size / (n * c);
  const out = new Float64Array(x.size);
  for (let i = 0; i < n; i++)
    for (let ch = 0; ch < c; ch++) {
      const base = (i * c + ch) * inner;
      const bv = b.data[ch];
      for (let s = 0; s < inner; s++) out[base + s] = x.data[base + s] + bv;
    }
  return Tensor.adopt(x.shape, out);
}

/** Inverse of addBias' broadcast: sums over every axis except 1. */
export function sumToChannels(g: Tensor): Tensor {
  const [n, c] = g.shape;
  const inner = g.size / (n * c);
  const out = new Float64Array(c);
  for (let i = 0; i < n; i++)
    for (let ch = 0; ch < c; ch++) {
      const base = (i * c + ch) * inner;
      let s = 0;
      for (let k = 0; k < inner; k++) s += g.data[base + k];
      out[ch] += s;
    }
  return Tensor.adopt([c], out);
}

// --------------------------------------------------------------------- softmax

/** Softmax over the last axis using the max-subtraction trick. */
export function softmax(a: Tensor): Tensor {
  if (a.rank < 1) throw new ShapeError('softmax needs rank >= 1');
  const k = a.shape[a.rank - 1];
  const rows = a.size / k;
  const out = new Float64Array(a.size);
  for (let r = 0; r < rows; r++) {
    const o = r * k;
    let m = -Infinity;
    for (let j = 0; j < k; j++) m = Math.max(m, a.data[o + j]);
    let s = 0;
    for (let j = 0; j < k; j++) {
      const e = Math.exp(a.data[o + j] - m);
      out[o + j] = e;
      s += e;
    }
    for (let j = 0; j < k; j++) out[o + j] /= s;
  }
  return Tensor.adopt(a.shape, out);
}

/** log-softmax over the last axis via log-sum-exp; finite for any finite input. */
export function logSoftmax(a: Tensor): Tensor {
  const k = a.shape[a.rank - 1];
  const rows = a.size / k;
  const out = new Float64Array(a.size);
  for (let r = 0; r < rows; r++) {
    const o = r * k;
    let m = -Infinity;
    for (let j = 0; j < k; j++) m = Math.max(m, a.data[o + j]);
    let s = 0;
    for (let j = 0; j < k; j++) s += Math.exp(a.data[o + j] - m);
    const lse = m + Math.log(s);
    for (let j = 0; j < k; j++) out[o + j] = a.data[o + j] - lse;
  }
  return Tensor.adopt(a.shape, out);
}

// ----------------------------------------------------------------- convolution

export interface Conv2dGeometry {
  stride: number;
  padding: number;
}

export function conv2dOutputSize(inSize: number, kernel: number, stride: number, padding: number): number {
  const span = inSize + 2 * padding - kernel;
  if (span < 0) throw new ShapeError(`kernel ${kernel} larger than padded input ${inSize + 2 * padding}`);
  return Math.floor(span / stride) + 1;
}

function checkConv(x: Tensor, w: Tensor): void {
  if (x.rank !== 4 || w.rank !== 4)
    throw new ShapeError(`conv2d needs x [N,C,H,W] and w [F,C,KH,KW]; got [${x.shape}], [${w.shape}]`);
  if (x.shape[1] !== w.shape[1])
    throw new ShapeError(`conv2d channel mismatch: x has ${x.shape[1]}, w expects ${w.shape[1]}`);
}

/**
 * Cross-correlation (the deep-learning "convolution"):
 * y[n,f,i,j] = Σ_c Σ_u Σ_v x[n,c, i·s + u − p, j·s + v − p] · w[f,c,u,v]
 * with zero padding outside the input.
 */
export function conv2d(x: Tensor, w: Tensor, { stride, padding }: Conv2dGeometry): Tensor {
  checkConv(x, w);
  const [N, C, H, W] = x.shape;
  const [F, , KH, KW] = w.shape;
  const OH = conv2dOutputSize(H, KH, stride, padding);
  const OW = conv2dOutputSize(W, KW, stride, padding);
  const out = new Float64Array(N * F * OH * OW);
  for (let n = 0; n < N; n++)
    for (let f = 0; f < F; f++)
      for (let i = 0; i < OH; i++)
        for (let j = 0; j < OW; j++) {
          let s = 0;
          for (let c = 0; c < C; c++)
            for (let u = 0; u < KH; u++) {
              const r = i * stride + u - padding;
              if (r < 0 || r >= H) continue;
              for (let v = 0; v < KW; v++) {
                const q = j * stride + v - padding;
                if (q < 0 || q >= W) continue;
                s += x.data[((n * C + c) * H + r) * W + q] * w.data[((f * C + c) * KH + u) * KW + v];
              }
            }
          out[((n * F + f) * OH + i) * OW + j] = s;
        }
  return Tensor.adopt([N, F, OH, OW], out);
}

/** ∂L/∂x: scatter each output gradient back through the window that produced it. */
export function conv2dBackwardInput(
  gy: Tensor,
  w: Tensor,
  xShape: Shape,
  { stride, padding }: Conv2dGeometry,
): Tensor {
  const [N, C, H, W] = xShape;
  const [F, , KH, KW] = w.shape;
  const [, , OH, OW] = gy.shape;
  const gx = new Float64Array(shapeSize(xShape));
  for (let n = 0; n < N; n++)
    for (let f = 0; f < F; f++)
      for (let i = 0; i < OH; i++)
        for (let j = 0; j < OW; j++) {
          const g = gy.data[((n * F + f) * OH + i) * OW + j];
          if (g === 0) continue;
          for (let c = 0; c < C; c++)
            for (let u = 0; u < KH; u++) {
              const r = i * stride + u - padding;
              if (r < 0 || r >= H) continue;
              for (let v = 0; v < KW; v++) {
                const q = j * stride + v - padding;
                if (q < 0 || q >= W) continue;
                gx[((n * C + c) * H + r) * W + q] += g * w.data[((f * C + c) * KH + u) * KW + v];
              }
            }
        }
  return Tensor.adopt(xShape, gx);
}

/** ∂L/∂w: correlate the input with the output gradient. */
export function conv2dBackwardFilter(
  gy: Tensor,
  x: Tensor,
  wShape: Shape,
  { stride, padding }: Conv2dGeometry,
): Tensor {
  const [N, C, H, W] = x.shape;
  const [F, , KH, KW] = wShape;
  const [, , OH, OW] = gy.shape;
  const gw = new Float64Array(shapeSize(wShape));
  for (let n = 0; n < N; n++)
    for (let f = 0; f < F; f++)
      for (let i = 0; i < OH; i++)
        for (let j = 0; j < OW; j++) {
          const g = gy.data[((n * F + f) * OH + i) * OW + j];
          if (g === 0) continue;
          for (let c = 0; c < C; c++)
            for (let u = 0; u < KH; u++) {
              const r = i * stride + u - padding;
              if (r < 0 || r >= H) continue;
              for (let v = 0; v < KW; v++) {
                const q = j * stride + v - padding;
                if (q < 0 || q >= W) continue;
                gw[((f * C + c) * KH + u) * KW + v] += g * x.data[((n * C + c) * H + r) * W + q];
              }
            }
        }
  return Tensor.adopt(wShape, gw);
}

// --------------------------------------------------------------------- pooling

export interface Pool2dGeometry {
  size: number;
  stride: number;
}

/**
 * Max pooling (no padding). Also returns, for every output cell, the flat input
 * index that won, so backward routes the gradient to exactly that element.
 * Ties go to the first element in row-major window order (TF and PyTorch agree).
 */
export function maxPool2d(x: Tensor, { size, stride }: Pool2dGeometry): { out: Tensor; argmax: Int32Array } {
  if (x.rank !== 4) throw new ShapeError(`maxPool2d needs [N,C,H,W], got [${x.shape}]`);
  const [N, C, H, W] = x.shape;
  const OH = conv2dOutputSize(H, size, stride, 0);
  const OW = conv2dOutputSize(W, size, stride, 0);
  const out = new Float64Array(N * C * OH * OW);
  const argmax = new Int32Array(out.length);
  for (let nc = 0; nc < N * C; nc++)
    for (let i = 0; i < OH; i++)
      for (let j = 0; j < OW; j++) {
        let best = -Infinity;
        let bestIdx = -1;
        for (let u = 0; u < size; u++)
          for (let v = 0; v < size; v++) {
            const idx = (nc * H + i * stride + u) * W + j * stride + v;
            if (x.data[idx] > best || bestIdx < 0) {
              best = x.data[idx];
              bestIdx = idx;
            }
          }
        const o = (nc * OH + i) * OW + j;
        out[o] = best;
        argmax[o] = bestIdx;
      }
  return { out: Tensor.adopt([N, C, OH, OW], out), argmax };
}

export function maxPool2dBackward(gy: Tensor, argmax: Int32Array, xShape: Shape): Tensor {
  const gx = new Float64Array(shapeSize(xShape));
  for (let o = 0; o < gy.size; o++) gx[argmax[o]] += gy.data[o];
  return Tensor.adopt(xShape, gx);
}

export function avgPool2d(x: Tensor, { size, stride }: Pool2dGeometry): Tensor {
  if (x.rank !== 4) throw new ShapeError(`avgPool2d needs [N,C,H,W], got [${x.shape}]`);
  const [N, C, H, W] = x.shape;
  const OH = conv2dOutputSize(H, size, stride, 0);
  const OW = conv2dOutputSize(W, size, stride, 0);
  const out = new Float64Array(N * C * OH * OW);
  const k = size * size;
  for (let nc = 0; nc < N * C; nc++)
    for (let i = 0; i < OH; i++)
      for (let j = 0; j < OW; j++) {
        let s = 0;
        for (let u = 0; u < size; u++)
          for (let v = 0; v < size; v++) s += x.data[(nc * H + i * stride + u) * W + j * stride + v];
        out[(nc * OH + i) * OW + j] = s / k;
      }
  return Tensor.adopt([N, C, OH, OW], out);
}

export function avgPool2dBackward(gy: Tensor, xShape: Shape, { size, stride }: Pool2dGeometry): Tensor {
  const [N, C, H, W] = xShape;
  const [, , OH, OW] = gy.shape;
  const gx = new Float64Array(shapeSize(xShape));
  const k = size * size;
  for (let nc = 0; nc < N * C; nc++)
    for (let i = 0; i < OH; i++)
      for (let j = 0; j < OW; j++) {
        const g = gy.data[(nc * OH + i) * OW + j] / k;
        for (let u = 0; u < size; u++)
          for (let v = 0; v < size; v++) gx[(nc * H + i * stride + u) * W + j * stride + v] += g;
      }
  return Tensor.adopt(xShape, gx);
}

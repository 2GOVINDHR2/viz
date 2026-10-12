/**
 * Built-in differentiable ops. Each registerOp call pairs a forward
 * computation with its analytic backward rule; tests/gradcheck verifies every
 * rule against central finite differences.
 */
import * as T from '../tensor/ops';
import { Tensor, ShapeError, shapesEqual } from '../tensor/tensor';
import { numAttr, registerOp } from './registry';

/** Epsilon used by probability-form binary cross-entropy (matches Keras/TF.js). */
export const BCE_EPSILON = 1e-7;

// ------------------------------------------------------------ elementwise binary

registerOp({
  name: 'add',
  arity: 2,
  forward: ([a, b]) => ({ value: T.add(a, b) }),
  backward: ({ grad, inputs: [a, b] }) => [T.reduceToShape(grad, a.shape), T.reduceToShape(grad, b.shape)],
});

registerOp({
  name: 'sub',
  arity: 2,
  forward: ([a, b]) => ({ value: T.sub(a, b) }),
  backward: ({ grad, inputs: [a, b] }) => [
    T.reduceToShape(grad, a.shape),
    T.reduceToShape(T.neg(grad), b.shape),
  ],
});

registerOp({
  name: 'mul',
  arity: 2,
  forward: ([a, b]) => ({ value: T.mul(a, b) }),
  backward: ({ grad, inputs: [a, b] }) => [
    T.reduceToShape(T.mul(grad, b), a.shape),
    T.reduceToShape(T.mul(grad, a), b.shape),
  ],
});

registerOp({
  name: 'div',
  arity: 2,
  forward: ([a, b]) => ({ value: T.div(a, b) }),
  backward: ({ grad, inputs: [a, b] }) => [
    T.reduceToShape(T.div(grad, b), a.shape),
    T.reduceToShape(T.neg(T.div(T.mul(grad, a), T.square(b))), b.shape),
  ],
});

// ------------------------------------------------------------------- unary

registerOp({
  name: 'neg',
  arity: 1,
  forward: ([a]) => ({ value: T.neg(a) }),
  backward: ({ grad }) => [T.neg(grad)],
});

registerOp({
  name: 'exp',
  arity: 1,
  forward: ([a]) => ({ value: T.exp(a) }),
  backward: ({ grad, output }) => [T.mul(grad, output)],
});

registerOp({
  name: 'log',
  arity: 1,
  forward: ([a]) => ({ value: T.log(a) }),
  backward: ({ grad, inputs: [a] }) => [T.div(grad, a)],
});

registerOp({
  name: 'square',
  arity: 1,
  forward: ([a]) => ({ value: T.square(a) }),
  backward: ({ grad, inputs: [a] }) => [T.mul(grad, T.scale(a, 2))],
});

// Activations. The derivative is expressed through the output where that is the
// textbook form (σ' = σ(1−σ), tanh' = 1 − tanh²), which is also what the
// explainer shows the learner.

registerOp({
  name: 'linear',
  arity: 1,
  forward: ([a]) => ({ value: a }),
  backward: ({ grad }) => [grad],
});

registerOp({
  name: 'sigmoid',
  arity: 1,
  forward: ([a]) => ({ value: T.sigmoid(a) }),
  backward: ({ grad, output }) => [
    T.mul(
      grad,
      T.map(output, (s) => s * (1 - s)),
    ),
  ],
});

registerOp({
  name: 'tanh',
  arity: 1,
  forward: ([a]) => ({ value: T.tanh(a) }),
  backward: ({ grad, output }) => [
    T.mul(
      grad,
      T.map(output, (t) => 1 - t * t),
    ),
  ],
});

// ReLU'(0) is taken as 0, the convention of TF.js and PyTorch.
registerOp({
  name: 'relu',
  arity: 1,
  forward: ([a]) => ({ value: T.relu(a) }),
  backward: ({ grad, inputs: [a] }) => [
    T.mul(
      grad,
      T.map(a, (x) => (x > 0 ? 1 : 0)),
    ),
  ],
});

registerOp({
  name: 'softmax',
  arity: 1,
  forward: ([a]) => ({ value: T.softmax(a) }),
  // Jacobian-vector product of softmax: s ⊙ (g − Σ_j g_j s_j), row-wise.
  backward: ({ grad, output }) => {
    const k = output.shape[output.rank - 1];
    const out = new Float64Array(output.size);
    for (let r = 0; r < output.size / k; r++) {
      const o = r * k;
      let dot = 0;
      for (let j = 0; j < k; j++) dot += grad.data[o + j] * output.data[o + j];
      for (let j = 0; j < k; j++) out[o + j] = output.data[o + j] * (grad.data[o + j] - dot);
    }
    return [Tensor.adopt(output.shape, out)];
  },
});

registerOp({
  name: 'clip',
  arity: 1,
  forward: ([a], attrs) => ({ value: T.clip(a, numAttr(attrs, 'lo'), numAttr(attrs, 'hi')) }),
  backward: ({ grad, inputs: [a], attrs }) => {
    const lo = numAttr(attrs, 'lo');
    const hi = numAttr(attrs, 'hi');
    return [
      T.mul(
        grad,
        T.map(a, (x) => (x >= lo && x <= hi ? 1 : 0)),
      ),
    ];
  },
});

// ------------------------------------------------------------------ reductions

registerOp({
  name: 'sum',
  arity: 1,
  forward: ([a]) => ({ value: T.sumAll(a) }),
  backward: ({ grad, inputs: [a] }) => [Tensor.full(a.shape, grad.item())],
});

registerOp({
  name: 'mean',
  arity: 1,
  forward: ([a]) => ({ value: T.meanAll(a) }),
  backward: ({ grad, inputs: [a] }) => [Tensor.full(a.shape, grad.item() / a.size)],
});

// --------------------------------------------------------------- linear algebra

// y = x·W with x [N, in] and W [in, out]:
//   ∂L/∂x = ∂L/∂y · Wᵀ      ∂L/∂W = xᵀ · ∂L/∂y
registerOp({
  name: 'matmul',
  arity: 2,
  forward: ([x, w]) => ({ value: T.matmul(x, w) }),
  backward: ({ grad, inputs: [x, w] }) => [
    T.matmul(grad, T.transpose2d(w)),
    T.matmul(T.transpose2d(x), grad),
  ],
});

registerOp({
  name: 'addBias',
  arity: 2,
  forward: ([x, b]) => ({ value: T.addBias(x, b) }),
  backward: ({ grad }) => [grad, T.sumToChannels(grad)],
});

registerOp({
  name: 'reshape',
  arity: 1,
  forward: ([a], attrs) => {
    const shape = String(attrs.shape)
      .split(',')
      .map((s) => Number(s));
    return { value: a.reshape(shape) };
  },
  backward: ({ grad, inputs: [a] }) => [grad.reshape(a.shape)],
});

// ----------------------------------------------------------------- convolution

registerOp({
  name: 'conv2d',
  arity: 2,
  forward: ([x, w], attrs) => ({
    value: T.conv2d(x, w, { stride: numAttr(attrs, 'stride'), padding: numAttr(attrs, 'padding') }),
  }),
  backward: ({ grad, inputs: [x, w], attrs }) => {
    const geom = { stride: numAttr(attrs, 'stride'), padding: numAttr(attrs, 'padding') };
    return [T.conv2dBackwardInput(grad, w, x.shape, geom), T.conv2dBackwardFilter(grad, x, w.shape, geom)];
  },
});

registerOp({
  name: 'maxPool2d',
  arity: 1,
  forward: ([x], attrs) => {
    const { out, argmax } = T.maxPool2d(x, {
      size: numAttr(attrs, 'size'),
      stride: numAttr(attrs, 'stride'),
    });
    return { value: out, saved: argmax };
  },
  backward: ({ grad, inputs: [x], saved }) => [T.maxPool2dBackward(grad, saved as Int32Array, x.shape)],
});

registerOp({
  name: 'avgPool2d',
  arity: 1,
  forward: ([x], attrs) => ({
    value: T.avgPool2d(x, { size: numAttr(attrs, 'size'), stride: numAttr(attrs, 'stride') }),
  }),
  backward: ({ grad, inputs: [x], attrs }) => [
    T.avgPool2dBackward(grad, x.shape, { size: numAttr(attrs, 'size'), stride: numAttr(attrs, 'stride') }),
  ],
});

// ---------------------------------------------------------------------- losses
//
// Losses take (prediction, target) and return a scalar. The target is never
// differentiated. Reductions follow Keras/TF.js so parity tests compare like
// with like: MSE and BCE average over every element; categorical
// cross-entropy sums over classes and averages over rows.

function checkPair(name: string, p: Tensor, y: Tensor): void {
  if (!shapesEqual(p.shape, y.shape))
    throw new ShapeError(`${name}: prediction [${p.shape}] vs target [${y.shape}]`);
}

registerOp({
  name: 'mseLoss',
  arity: 2,
  nonDifferentiable: [1],
  forward: ([p, y]) => {
    checkPair('mseLoss', p, y);
    return { value: T.meanAll(T.square(T.sub(p, y))) };
  },
  backward: ({ grad, inputs: [p, y] }) => [T.scale(T.sub(p, y), (2 * grad.item()) / p.size), null],
});

// Probability-form BCE with the probability clipped to [ε, 1−ε]. Outside the
// clip range the gradient is zero, exactly as clipByValue's gradient in TF.js.
registerOp({
  name: 'bceLoss',
  arity: 2,
  nonDifferentiable: [1],
  forward: ([p, y]) => {
    checkPair('bceLoss', p, y);
    let s = 0;
    for (let i = 0; i < p.size; i++) {
      const q = Math.min(Math.max(p.data[i], BCE_EPSILON), 1 - BCE_EPSILON);
      s += y.data[i] * Math.log(q) + (1 - y.data[i]) * Math.log(1 - q);
    }
    return { value: Tensor.scalar(-s / p.size) };
  },
  backward: ({ grad, inputs: [p, y] }) => {
    const k = grad.item() / p.size;
    const out = new Float64Array(p.size);
    for (let i = 0; i < p.size; i++) {
      const q = p.data[i];
      if (q < BCE_EPSILON || q > 1 - BCE_EPSILON) continue;
      out[i] = k * (-y.data[i] / q + (1 - y.data[i]) / (1 - q));
    }
    return [Tensor.adopt(p.shape, out), null];
  },
});

// Softmax and categorical cross-entropy fused on logits z:
//   L = −(1/N) Σ_n Σ_j y_nj · log softmax(z_n)_j
//   ∂L/∂z_nj = (softmax(z_n)_j · Σ_k y_nk − y_nj) / N
// For one-hot targets this is the familiar (p − y)/N. Fusing avoids log(0)
// and is the single correct place the softmax Jacobian is applied — the
// standalone softmax op is never also on this gradient path.
registerOp({
  name: 'softmaxCrossEntropy',
  arity: 2,
  nonDifferentiable: [1],
  forward: ([z, y]) => {
    checkPair('softmaxCrossEntropy', z, y);
    const ls = T.logSoftmax(z);
    const rows = z.size / z.shape[z.rank - 1];
    let s = 0;
    for (let i = 0; i < z.size; i++) s += y.data[i] * ls.data[i];
    return { value: Tensor.scalar(-s / rows) };
  },
  backward: ({ grad, inputs: [z, y] }) => {
    const k = z.shape[z.rank - 1];
    const rows = z.size / k;
    const p = T.softmax(z);
    const out = new Float64Array(z.size);
    const g = grad.item() / rows;
    for (let r = 0; r < rows; r++) {
      let ySum = 0;
      for (let j = 0; j < k; j++) ySum += y.data[r * k + j];
      for (let j = 0; j < k; j++) out[r * k + j] = g * (p.data[r * k + j] * ySum - y.data[r * k + j]);
    }
    return [Tensor.adopt(z.shape, out), null];
  },
});

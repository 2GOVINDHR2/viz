/**
 * Worked extension (docs/NPM-SPEC.md §7): adding Layer Normalisation to the
 * Neural Program Model through its four registration points. Nothing outside
 * this file is modified.
 */
import { registerOp } from '../src/core/autodiff';
import { registerLayer } from '../src/core/layers/extensions';
import { registerInstructionKind, registerOpMapping } from '../src/core/npm';
import { Tensor } from '../src/core/tensor/tensor';
import { registerExplainer, tex } from '../src/explain';
import { registerVisualMapping } from '../src/views/registry';

const EPS = 1e-5;

/** Row-wise statistics of x [N, F]: normalised values and 1/σ per row. */
function normalise(x: Tensor): { xhat: Float64Array; inv: Float64Array } {
  const [n, f] = x.shape;
  const xhat = new Float64Array(x.size);
  const inv = new Float64Array(n);
  for (let r = 0; r < n; r++) {
    let mu = 0;
    for (let j = 0; j < f; j++) mu += x.data[r * f + j] / f;
    let v = 0;
    for (let j = 0; j < f; j++) v += (x.data[r * f + j] - mu) ** 2 / f;
    inv[r] = 1 / Math.sqrt(v + EPS);
    for (let j = 0; j < f; j++) xhat[r * f + j] = (x.data[r * f + j] - mu) * inv[r];
  }
  return { xhat, inv };
}

// ① Gradient rule: y = γ ⊙ x̂ + β with x̂ = (x − μ)/σ, per row.
registerOp({
  name: 'layerNorm',
  arity: 3,
  forward: ([x, g, b]) => {
    const { xhat } = normalise(x);
    const f = x.shape[1];
    return {
      value: Tensor.from(
        x.shape,
        xhat.map((v, i) => g.data[i % f] * v + b.data[i % f]),
      ),
    };
  },
  backward: ({ grad, inputs: [x, g] }) => {
    const [n, f] = x.shape;
    const { xhat, inv } = normalise(x);
    const dx = new Float64Array(x.size);
    const dg = new Float64Array(f);
    const db = new Float64Array(f);
    for (let r = 0; r < n; r++) {
      let m1 = 0;
      let m2 = 0;
      for (let j = 0; j < f; j++) {
        const k = r * f + j;
        const dxh = grad.data[k] * g.data[j];
        m1 += dxh / f;
        m2 += (dxh * xhat[k]) / f;
        dg[j] += grad.data[k] * xhat[k];
        db[j] += grad.data[k];
      }
      for (let j = 0; j < f; j++) {
        const k = r * f + j;
        dx[k] = inv[r] * (grad.data[k] * g.data[j] - m1 - xhat[k] * m2);
      }
    }
    return [Tensor.from(x.shape, dx), Tensor.from([f], dg), Tensor.from([f], db)];
  },
});

// ② Instruction kinds, op mapping and the layer that uses them.
registerInstructionKind({
  kind: 'LAYER_NORM',
  phase: 'forward',
  results: ['out'],
  summary: 'Normalise each example’s features to zero mean and unit variance, then scale and shift.',
  symbolic: (i) => `a = γ ⊙ (x − μ)/σ + β  (${i.path.layer})`,
});
registerInstructionKind({
  kind: 'GRAD_LAYER_NORM',
  phase: 'backward',
  results: ['dGamma', 'dBeta'],
  summary: 'Gradients of layer normalisation for its input, scale and shift.',
  symbolic: (i) => `∂ℓ/∂γ, ∂ℓ/∂β${i.results.dX ? ', ∂ℓ/∂x' : ''}  (${i.path.layer})`,
});
registerOpMapping({
  op: 'layerNorm',
  forwardKind: 'LAYER_NORM',
  forwardRoles: ['input', 'gamma', 'beta'],
  backward: [
    {
      kind: 'GRAD_LAYER_NORM',
      slots: [
        { slot: 'dX', input: 0 },
        { slot: 'dGamma', input: 1 },
        { slot: 'dBeta', input: 2 },
      ],
      operands: [
        { source: { from: 'upstream' }, role: 'upstream' },
        { source: { from: 'input', index: 0 }, role: 'input' },
      ],
    },
  ],
});
registerLayer({
  kind: 'layerNorm',
  outShape: (inShape) => [...inShape],
  params: (inShape) => [
    { role: 'gamma', shape: [inShape[0]], init: 'ones' },
    { role: 'beta', shape: [inShape[0]], init: 'zeros' },
  ],
  forward: (tape, x, p, _options, meta) => tape.apply('layerNorm', [x, p('gamma'), p('beta')], {}, meta),
});

// ③ Explainers.
registerExplainer('LAYER_NORM', (i) => ({
  general: 'a_j = \\gamma_j\\,\\frac{x_j - \\mu}{\\sqrt{\\sigma^2 + \\epsilon}} + \\beta_j',
  substituted: `a_1 = ${tex(i.results.out.data[0])}`,
  sentence:
    'Layer normalisation rescales this example’s features to a common range, which keeps later layers’ inputs well-conditioned; γ and β let the network undo it where useful.',
}));
registerExplainer('GRAD_LAYER_NORM', (i) => ({
  general:
    '\\frac{\\partial \\ell}{\\partial \\gamma_j} = \\sum \\frac{\\partial \\ell}{\\partial a_j}\\,\\hat x_j,\\quad \\frac{\\partial \\ell}{\\partial \\beta_j} = \\sum \\frac{\\partial \\ell}{\\partial a_j}',
  substituted: `\\frac{\\partial \\ell}{\\partial \\gamma_1} = ${tex(i.results.dGamma.data[0])}`,
  sentence:
    'The scale γ learns from how the normalised feature correlates with the error; the shift β from the error itself.',
}));

// ④ Visual mappings.
registerVisualMapping('LAYER_NORM', {
  flow: 'forward',
  target: 'units',
  valueSlot: 'out',
  label: 'Forward · layer norm',
});
registerVisualMapping('GRAD_LAYER_NORM', {
  flow: 'backward',
  target: 'units',
  valueSlot: 'dGamma',
  label: 'Backward · layer norm',
});

/**
 * Central-difference gradient checking.
 *
 * The scalar checked is L = Σ f(x) ⊙ R for a random fixed tensor R, so every
 * element of every output contributes with a distinct weight. Checking plain
 * Σ f(x) would let an op whose gradient is wrong only in the off-diagonal
 * Jacobian (e.g. softmax) pass.
 */
import { Tape, backward, type Var } from '../../src/core/autodiff';
import { Rng } from '../../src/core/rng/rng';
import { Tensor } from '../../src/core/tensor/tensor';

export interface CheckResult {
  id: string;
  elements: number;
  maxAbs: number;
  maxRel: number;
}

const H = 1e-6;

/** Tolerance on max relative deviation (float64, h = 1e-6 central differences). */
export const GRADCHECK_REL_TOL = 1e-5;

function relErr(a: number, n: number): number {
  return Math.abs(a - n) / Math.max(Math.abs(a), Math.abs(n), 1e-7);
}

/**
 * `build` receives leaf Vars for `inputs` and must return a Var; only the
 * inputs flagged differentiable are checked.
 */
export function gradcheck(
  id: string,
  inputs: Tensor[],
  build: (tape: Tape, vars: Var[]) => Var,
  differentiable: boolean[] = inputs.map(() => true),
  seed = 7,
): CheckResult {
  const rng = new Rng(seed);
  const evalAt = (xs: Tensor[]): { value: Var; tape: Tape; vars: Var[] } => {
    const tape = new Tape();
    const vars = xs.map((x, i) => tape.leaf(x, differentiable[i]));
    return { value: build(tape, vars), tape, vars };
  };
  const base = evalAt(inputs);
  const outShape = base.value.value.shape;
  const R = Tensor.from(
    outShape,
    Array.from({ length: base.value.value.size }, () => rng.uniform(0.5, 1.5) * (rng.next() < 0.5 ? -1 : 1)),
  );
  const scalarAt = (xs: Tensor[]): number => {
    const out = evalAt(xs).value.value;
    let s = 0;
    for (let i = 0; i < out.size; i++) s += out.data[i] * R.data[i];
    return s;
  };
  const grads = backward(base.tape, base.value, R);

  let maxAbs = 0;
  let maxRel = 0;
  let elements = 0;
  inputs.forEach((x, k) => {
    if (!differentiable[k]) return;
    const analytic = grads.get(base.vars[k].id) ?? Tensor.zeros(x.shape);
    for (let i = 0; i < x.size; i++) {
      const plus = Float64Array.from(x.data);
      const minus = Float64Array.from(x.data);
      plus[i] += H;
      minus[i] -= H;
      const xp = inputs.map((t, j) => (j === k ? Tensor.from(x.shape, plus) : t));
      const xm = inputs.map((t, j) => (j === k ? Tensor.from(x.shape, minus) : t));
      const numeric = (scalarAt(xp) - scalarAt(xm)) / (2 * H);
      const a = analytic.data[i];
      maxAbs = Math.max(maxAbs, Math.abs(a - numeric));
      maxRel = Math.max(maxRel, relErr(a, numeric));
      elements++;
    }
  });
  return { id, elements, maxAbs, maxRel };
}

export function randomTensor(rng: Rng, shape: number[], lo = -1, hi = 1): Tensor {
  const n = shape.reduce((a, b) => a * b, 1);
  return Tensor.from(
    shape,
    Array.from({ length: n }, () => rng.uniform(lo, hi)),
  );
}

/** Values bounded away from zero, for ops with a kink or pole there (ReLU, division, log). */
export function awayFromZero(rng: Rng, shape: number[], min = 0.1, max = 1.5): Tensor {
  const n = shape.reduce((a, b) => a * b, 1);
  return Tensor.from(
    shape,
    Array.from({ length: n }, () => rng.uniform(min, max) * (rng.next() < 0.5 ? -1 : 1)),
  );
}

export function oneHotRows(rng: Rng, rows: number, k: number): Tensor {
  const v = new Array<number>(rows * k).fill(0);
  for (let r = 0; r < rows; r++) v[r * k + rng.int(k)] = 1;
  return Tensor.from([rows, k], v);
}

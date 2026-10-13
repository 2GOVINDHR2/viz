import { afterAll, describe, expect, it } from 'vitest';
import { registeredOps, type Tape, type Var } from '../../src/core/autodiff';
import { Rng } from '../../src/core/rng/rng';
import { Tensor } from '../../src/core/tensor/tensor';
import { recordResults } from '../support/report';
import {
  GRADCHECK_REL_TOL,
  awayFromZero,
  gradcheck,
  oneHotRows,
  randomTensor,
  type CheckResult,
} from './harness';

const rng = new Rng(2026);

/** Distinct, well-separated values so a finite-difference nudge never changes a max-pool winner. */
function separated(shape: number[]): Tensor {
  const n = shape.reduce((a, b) => a * b, 1);
  const perm = rng.permutation(n);
  return Tensor.from(
    shape,
    perm.map((p) => (p - n / 2) * 0.1 + rng.uniform(-0.01, 0.01)),
  );
}

interface Case {
  op: string;
  label: string;
  inputs: () => Tensor[];
  build: (tape: Tape, v: Var[]) => Var;
  differentiable?: boolean[];
}

const unary = (op: string, input: () => Tensor, label = 'shape [3,4]'): Case => ({
  op,
  label,
  inputs: () => [input()],
  build: (t, [a]) => t.apply(op, [a]),
});

const cases: Case[] = [
  {
    op: 'add',
    label: 'same shape [3,4]',
    inputs: () => [randomTensor(rng, [3, 4]), randomTensor(rng, [3, 4])],
    build: (t, v) => t.apply('add', v),
  },
  {
    op: 'add',
    label: 'broadcast [3,4]+[4]',
    inputs: () => [randomTensor(rng, [3, 4]), randomTensor(rng, [4])],
    build: (t, v) => t.apply('add', v),
  },
  {
    op: 'add',
    label: 'broadcast [2,1,3]+[4,1]',
    inputs: () => [randomTensor(rng, [2, 1, 3]), randomTensor(rng, [4, 1])],
    build: (t, v) => t.apply('add', v),
  },
  {
    op: 'sub',
    label: 'broadcast [3,4]-[3,1]',
    inputs: () => [randomTensor(rng, [3, 4]), randomTensor(rng, [3, 1])],
    build: (t, v) => t.apply('sub', v),
  },
  {
    op: 'mul',
    label: 'broadcast [3,4]*[1,4]',
    inputs: () => [randomTensor(rng, [3, 4]), randomTensor(rng, [1, 4])],
    build: (t, v) => t.apply('mul', v),
  },
  {
    op: 'div',
    label: 'broadcast [3,4]/[4]',
    inputs: () => [randomTensor(rng, [3, 4]), awayFromZero(rng, [4], 0.5, 2)],
    build: (t, v) => t.apply('div', v),
  },
  unary('neg', () => randomTensor(rng, [3, 4])),
  unary('exp', () => randomTensor(rng, [3, 4])),
  unary('log', () => randomTensor(rng, [3, 4], 0.2, 3)),
  unary('square', () => randomTensor(rng, [3, 4])),
  unary('linear', () => randomTensor(rng, [3, 4])),
  unary('sigmoid', () => randomTensor(rng, [3, 4], -4, 4)),
  unary('tanh', () => randomTensor(rng, [3, 4], -3, 3)),
  unary('relu', () => awayFromZero(rng, [3, 4])),
  unary('softmax', () => randomTensor(rng, [3, 5], -3, 3), 'rows [3,5]'),
  {
    op: 'clip',
    label: 'away from bounds',
    inputs: () => [awayFromZero(rng, [3, 4], 0.1, 2)],
    build: (t, [a]) => t.apply('clip', [a], { lo: -1.05, hi: 1.05 }),
  },
  unary('sum', () => randomTensor(rng, [3, 4])),
  unary('mean', () => randomTensor(rng, [3, 4])),
  {
    op: 'matmul',
    label: '[3,4]x[4,2]',
    inputs: () => [randomTensor(rng, [3, 4]), randomTensor(rng, [4, 2])],
    build: (t, v) => t.apply('matmul', v),
  },
  {
    op: 'addBias',
    label: 'dense [3,4]+[4]',
    inputs: () => [randomTensor(rng, [3, 4]), randomTensor(rng, [4])],
    build: (t, v) => t.apply('addBias', v),
  },
  {
    op: 'addBias',
    label: 'conv [2,3,4,4]+[3]',
    inputs: () => [randomTensor(rng, [2, 3, 4, 4]), randomTensor(rng, [3])],
    build: (t, v) => t.apply('addBias', v),
  },
  {
    op: 'reshape',
    label: '[2,3,2,2] -> [2,12]',
    inputs: () => [randomTensor(rng, [2, 3, 2, 2])],
    build: (t, [a]) => t.apply('reshape', [a], { shape: '2,12' }),
  },
  ...[
    { s: 1, p: 0, label: 'stride 1 pad 0' },
    { s: 1, p: 1, label: 'stride 1 pad 1' },
    { s: 2, p: 0, label: 'stride 2 pad 0' },
    { s: 2, p: 1, label: 'stride 2 pad 1' },
    { s: 3, p: 2, label: 'stride 3 pad 2 (non-dividing)' },
  ].map(({ s, p, label }): Case => ({
    op: 'conv2d',
    label: `x[2,2,7,6] w[3,2,3,3] ${label}`,
    inputs: () => [randomTensor(rng, [2, 2, 7, 6]), randomTensor(rng, [3, 2, 3, 3])],
    build: (t, v) => t.apply('conv2d', v, { stride: s, padding: p }),
  })),
  {
    op: 'maxPool2d',
    label: '2x2 stride 2',
    inputs: () => [separated([2, 2, 6, 6])],
    build: (t, [a]) => t.apply('maxPool2d', [a], { size: 2, stride: 2 }),
  },
  {
    op: 'maxPool2d',
    label: '3x3 stride 2 (overlapping)',
    inputs: () => [separated([1, 2, 7, 7])],
    build: (t, [a]) => t.apply('maxPool2d', [a], { size: 3, stride: 2 }),
  },
  {
    op: 'avgPool2d',
    label: '2x2 stride 2',
    inputs: () => [randomTensor(rng, [2, 2, 6, 6])],
    build: (t, [a]) => t.apply('avgPool2d', [a], { size: 2, stride: 2 }),
  },
  {
    op: 'avgPool2d',
    label: '3x3 stride 1 (overlapping)',
    inputs: () => [randomTensor(rng, [1, 2, 5, 5])],
    build: (t, [a]) => t.apply('avgPool2d', [a], { size: 3, stride: 1 }),
  },
  {
    op: 'mseLoss',
    label: 'multi-output [3,4]',
    inputs: () => [randomTensor(rng, [3, 4]), randomTensor(rng, [3, 4])],
    build: (t, v) => t.apply('mseLoss', v),
    differentiable: [true, false],
  },
  {
    op: 'bceLoss',
    label: 'multi-output [3,2]',
    inputs: () => [randomTensor(rng, [3, 2], 0.05, 0.95), randomTensor(rng, [3, 2], 0, 1)],
    build: (t, v) => t.apply('bceLoss', v),
    differentiable: [true, false],
  },
  {
    op: 'softmaxCrossEntropy',
    label: 'one-hot [4,3]',
    inputs: () => [randomTensor(rng, [4, 3], -3, 3), oneHotRows(rng, 4, 3)],
    build: (t, v) => t.apply('softmaxCrossEntropy', v),
    differentiable: [true, false],
  },
  {
    op: 'softmaxCrossEntropy',
    label: 'soft labels [2,4]',
    inputs: () => [
      randomTensor(rng, [2, 4], -3, 3),
      Tensor.from([2, 4], [0.1, 0.2, 0.3, 0.4, 0.5, 0.5, 0, 0]),
    ],
    build: (t, v) => t.apply('softmaxCrossEntropy', v),
    differentiable: [true, false],
  },
];

const results: CheckResult[] = [];

describe('gradcheck: every registered op', () => {
  it('has at least one gradcheck case for every registered op', () => {
    const covered = new Set(cases.map((c) => c.op));
    const missing = registeredOps().filter((op) => !covered.has(op));
    expect(missing).toEqual([]);
  });

  for (const c of cases) {
    it(`${c.op} — ${c.label}`, () => {
      const inputs = c.inputs();
      const r = gradcheck(`op:${c.op} — ${c.label}`, inputs, c.build, c.differentiable);
      results.push(r);
      expect(r.elements).toBeGreaterThan(0);
      expect(r.maxRel).toBeLessThan(GRADCHECK_REL_TOL);
    });
  }

  afterAll(() => recordResults('gradcheck', results));
});

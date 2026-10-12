import { describe, expect, it } from 'vitest';
import * as T from '../../src/core/tensor/ops';
import { ShapeError, Tensor } from '../../src/core/tensor/tensor';

const t = (shape: number[], v: number[]) => Tensor.from(shape, v);

describe('tensor', () => {
  it('copies its input so callers cannot mutate it afterwards', () => {
    const src = [1, 2, 3];
    const x = Tensor.from([3], src);
    src[0] = 99;
    expect(x.toArray()).toEqual([1, 2, 3]);
  });

  it('rejects mismatched sizes and bad dimensions', () => {
    expect(() => Tensor.from([2, 2], [1, 2, 3])).toThrow(ShapeError);
    expect(() => Tensor.from([-1], [])).toThrow(ShapeError);
    expect(() => t([2], [1, 2]).at(2)).toThrow(ShapeError);
  });

  it('broadcasts like NumPy', () => {
    expect(T.add(t([2, 3], [1, 2, 3, 4, 5, 6]), t([3], [10, 20, 30])).toArray()).toEqual([
      11, 22, 33, 14, 25, 36,
    ]);
    expect(T.add(t([2, 1], [1, 2]), t([1, 3], [10, 20, 30])).toArray()).toEqual([11, 21, 31, 12, 22, 32]);
    expect(() => T.add(t([2, 3], [0, 0, 0, 0, 0, 0]), t([2], [0, 0]))).toThrow(ShapeError);
  });

  it('reduceToShape inverts broadcasting by summation', () => {
    const g = t([2, 3], [1, 2, 3, 4, 5, 6]);
    expect(T.reduceToShape(g, [3]).toArray()).toEqual([5, 7, 9]);
    expect(T.reduceToShape(g, [2, 1]).toArray()).toEqual([6, 15]);
  });

  it('matmul matches a hand computation and validates inner dimensions', () => {
    const a = t([2, 2], [1, 2, 3, 4]);
    const b = t([2, 2], [5, 6, 7, 8]);
    expect(T.matmul(a, b).toArray()).toEqual([19, 22, 43, 50]);
    expect(() => T.matmul(a, t([3, 1], [1, 2, 3]))).toThrow(ShapeError);
  });

  it('softmax and log-softmax are stable for large logits', () => {
    const z = t([1, 3], [1000, 1001, 1002]);
    const p = T.softmax(z).toArray();
    expect(p.reduce((a, b) => a + b)).toBeCloseTo(1, 12);
    expect(T.logSoftmax(z).toArray().every(Number.isFinite)).toBe(true);
  });

  it('sigmoid never overflows', () => {
    expect(T.sigmoid(t([2], [-1000, 1000])).toArray()).toEqual([0, 1]);
  });

  it('conv2d matches a hand-worked 3x3 example with padding and stride', () => {
    // x = 1..9 in a 3x3 grid, single 2x2 kernel of ones, stride 1, no padding.
    const x = t([1, 1, 3, 3], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const w = t([1, 1, 2, 2], [1, 1, 1, 1]);
    expect(T.conv2d(x, w, { stride: 1, padding: 0 }).toArray()).toEqual([12, 16, 24, 28]);
    // With padding 1 and stride 2 the windows are centred on corners: top-left sees only x[0,0].
    expect(T.conv2d(x, w, { stride: 2, padding: 1 }).toArray()).toEqual([1, 5, 11, 28]);
  });

  it('max pooling routes gradient only to the winning element', () => {
    const x = t([1, 1, 2, 4], [1, 9, 3, 2, 4, 0, 8, 1]);
    const { out, argmax } = T.maxPool2d(x, { size: 2, stride: 2 });
    expect(out.toArray()).toEqual([9, 8]);
    const g = T.maxPool2dBackward(t([1, 1, 1, 2], [10, 20]), argmax, x.shape);
    expect(g.toArray()).toEqual([0, 10, 0, 0, 0, 0, 20, 0]);
  });
});

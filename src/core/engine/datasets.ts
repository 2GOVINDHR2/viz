/**
 * Synthetic datasets generated from the seeded PRNG, so they are bundled by
 * construction and never downloaded (P6). Labels are encoded to match the
 * output layer: `binary` gives [N, 1] in {0, 1}; `onehot` gives [N, K].
 */
import { Rng } from '../rng/rng';
import { Tensor } from '../tensor/tensor';
import type { Dataset } from './data';

export type LabelEncoding = 'binary' | 'onehot';

function encode(labels: number[], k: number, enc: LabelEncoding): Tensor {
  if (enc === 'binary') {
    if (k !== 2) throw new Error('binary encoding needs exactly two classes');
    return Tensor.from([labels.length, 1], labels);
  }
  const v = new Array<number>(labels.length * k).fill(0);
  labels.forEach((l, i) => (v[i * k + l] = 1));
  return Tensor.from([labels.length, k], v);
}

/** The four canonical XOR points. */
export function xor(enc: LabelEncoding = 'binary'): Dataset {
  return {
    name: 'xor',
    xs: Tensor.from([4, 2], [0, 0, 0, 1, 1, 0, 1, 1]),
    ys: encode([0, 1, 1, 0], 2, enc),
    classes: ['0', '1'],
  };
}

/** Noisy XOR: points around the four corners of [−1, 1]², labelled by sign(x·y) < 0. */
export function xorClusters(n: number, seed: number, noise = 0.25, enc: LabelEncoding = 'binary'): Dataset {
  const rng = new Rng(seed);
  const xs: number[] = [];
  const labels: number[] = [];
  for (let i = 0; i < n; i++) {
    const cx = i % 2 === 0 ? -1 : 1;
    const cy = Math.floor(i / 2) % 2 === 0 ? -1 : 1;
    xs.push(cx + rng.normal(0, noise), cy + rng.normal(0, noise));
    labels.push(cx * cy < 0 ? 1 : 0);
  }
  return {
    name: 'xor-clusters',
    xs: Tensor.from([n, 2], xs),
    ys: encode(labels, 2, enc),
    classes: ['same sign', 'opposite sign'],
  };
}

export function gaussians(n: number, seed: number, separation = 2, enc: LabelEncoding = 'binary'): Dataset {
  const rng = new Rng(seed);
  const xs: number[] = [];
  const labels: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % 2;
    const m = (c === 0 ? -1 : 1) * (separation / 2);
    xs.push(m + rng.normal(0, 0.6), m + rng.normal(0, 0.6));
    labels.push(c);
  }
  return { name: 'gaussians', xs: Tensor.from([n, 2], xs), ys: encode(labels, 2, enc), classes: ['A', 'B'] };
}

export function circles(n: number, seed: number, enc: LabelEncoding = 'binary'): Dataset {
  const rng = new Rng(seed);
  const xs: number[] = [];
  const labels: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % 2;
    const r = (c === 0 ? 0.5 : 1.2) + rng.normal(0, 0.12);
    const t = rng.uniform(0, 2 * Math.PI);
    xs.push(r * Math.cos(t), r * Math.sin(t));
    labels.push(c);
  }
  return {
    name: 'circles',
    xs: Tensor.from([n, 2], xs),
    ys: encode(labels, 2, enc),
    classes: ['inner', 'outer'],
  };
}

export function spiral(n: number, k: number, seed: number, enc: LabelEncoding = 'onehot'): Dataset {
  const rng = new Rng(seed);
  const xs: number[] = [];
  const labels: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % k;
    const t = (Math.floor(i / k) / Math.ceil(n / k)) * 1.0;
    const r = 0.1 + t;
    const a = (c * 2 * Math.PI) / k + t * 4 + rng.normal(0, 0.2);
    xs.push(r * Math.cos(a), r * Math.sin(a));
    labels.push(c);
  }
  return {
    name: 'spiral',
    xs: Tensor.from([n, 2], xs),
    ys: encode(labels, k, enc),
    classes: Array.from({ length: k }, (_, i) => `arm ${i + 1}`),
  };
}

/** 1-D regression points on y = a·x + b with Gaussian noise, for the gradient-descent experiment. */
export function line(n: number, seed: number, a = 2, b = -1, noise = 0.1): Dataset {
  const rng = new Rng(seed);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = rng.uniform(-1, 1);
    xs.push(x);
    ys.push(a * x + b + rng.normal(0, noise));
  }
  return { name: 'line', xs: Tensor.from([n, 1], xs), ys: Tensor.from([n, 1], ys) };
}

/**
 * Tiny single-channel images of horizontal, vertical and diagonal bars with
 * noise. Used for CNN gradient/parity tests and as a fast CNN warm-up.
 */
export function bars(n: number, size: number, seed: number): Dataset {
  const rng = new Rng(seed);
  const xs: number[] = [];
  const labels: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = i % 3;
    const pos = rng.int(size);
    for (let r = 0; r < size; r++)
      for (let q = 0; q < size; q++) {
        const on = c === 0 ? r === pos : c === 1 ? q === pos : (r + pos) % size === q;
        xs.push((on ? 1 : 0) + rng.normal(0, 0.1));
      }
    labels.push(c);
  }
  return {
    name: 'bars',
    xs: Tensor.from([n, 1, size, size], xs),
    ys: encode(labels, 3, 'onehot'),
    classes: ['horizontal', 'vertical', 'diagonal'],
  };
}

/** Decodes the bundled reduced-MNIST asset into a Dataset (pixels scaled to [0, 1], one-hot labels). */
import type { Dataset } from '../../core/engine/data';
import { Tensor } from '../../core/tensor/tensor';
import * as M from './mnist-subset';

function bytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function split(images: string, labels: string, limitPerClass?: number): { xs: Tensor; ys: Tensor } {
  const px = bytes(images);
  const lb = bytes(labels);
  const k = M.MNIST_CLASSES.length;
  // Classes are interleaved in the asset, so a prefix stays balanced.
  const n = limitPerClass ? Math.min(lb.length, limitPerClass * k) : lb.length;
  const xs = new Float64Array(n * 784);
  for (let i = 0; i < n * 784; i++) xs[i] = px[i] / 255;
  const ys = new Float64Array(n * k);
  for (let i = 0; i < n; i++) ys[i * k + lb[i]] = 1;
  return { xs: Tensor.adopt([n, 1, 28, 28], xs), ys: Tensor.adopt([n, k], ys) };
}

export function loadMnist(trainPerClass?: number, testPerClass?: number): Dataset {
  const train = split(M.MNIST_TRAIN_IMAGES, M.MNIST_TRAIN_LABELS, trainPerClass);
  return {
    name: 'mnist-012',
    xs: train.xs,
    ys: train.ys,
    classes: M.MNIST_CLASSES.map((c) => `digit ${c}`),
    test: split(M.MNIST_TEST_IMAGES, M.MNIST_TEST_LABELS, testPerClass),
  };
}

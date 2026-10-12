/**
 * Seeded weight initialisers. Fan-in/fan-out follow Keras: for a dense kernel
 * [in, out] they are (in, out); for a conv kernel [F, C, KH, KW] they are
 * (C·KH·KW, F·KH·KW).
 */
import { type Shape, Tensor, shapeSize } from '../tensor/tensor';
import type { Rng } from './rng';

export type InitializerName = 'glorotUniform' | 'glorotNormal' | 'heUniform' | 'heNormal' | 'zeros';

export function fans(shape: Shape): { fanIn: number; fanOut: number } {
  if (shape.length === 2) return { fanIn: shape[0], fanOut: shape[1] };
  if (shape.length === 4) {
    const receptive = shape[2] * shape[3];
    return { fanIn: shape[1] * receptive, fanOut: shape[0] * receptive };
  }
  const n = shapeSize(shape);
  return { fanIn: n, fanOut: n };
}

export function initialize(name: InitializerName, shape: Shape, rng: Rng): Tensor {
  const n = shapeSize(shape);
  const { fanIn, fanOut } = fans(shape);
  const values = new Float64Array(n);
  switch (name) {
    case 'zeros':
      break;
    case 'glorotUniform': {
      const limit = Math.sqrt(6 / (fanIn + fanOut));
      for (let i = 0; i < n; i++) values[i] = rng.uniform(-limit, limit);
      break;
    }
    case 'glorotNormal': {
      const std = Math.sqrt(2 / (fanIn + fanOut));
      for (let i = 0; i < n; i++) values[i] = rng.normal(0, std);
      break;
    }
    case 'heUniform': {
      const limit = Math.sqrt(6 / fanIn);
      for (let i = 0; i < n; i++) values[i] = rng.uniform(-limit, limit);
      break;
    }
    case 'heNormal': {
      const std = Math.sqrt(2 / fanIn);
      for (let i = 0; i < n; i++) values[i] = rng.normal(0, std);
      break;
    }
  }
  return Tensor.adopt(shape, values);
}

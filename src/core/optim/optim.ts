/**
 * Optimisers. Momentum uses the accumulator form shared by TF.js and PyTorch:
 *   v ← μ·v + g,   Δ = −η·v
 * which equals the "velocity" form v ← μ·v − η·g for a constant learning rate.
 */
import { add, scale } from '../tensor/ops';
import { Tensor } from '../tensor/tensor';

export type OptimizerConfig =
  { type: 'sgd'; lr: number } | { type: 'momentum'; lr: number; momentum: number };

export interface UpdateResult {
  /** Optimiser state after this step (velocity for momentum), or null for plain SGD. */
  state: Tensor | null;
  delta: Tensor;
}

export function computeUpdate(opt: OptimizerConfig, grad: Tensor, state: Tensor | null): UpdateResult {
  switch (opt.type) {
    case 'sgd':
      return { state: null, delta: scale(grad, -opt.lr) };
    case 'momentum': {
      const v = add(scale(state ?? Tensor.zeros(grad.shape), opt.momentum), grad);
      return { state: v, delta: scale(v, -opt.lr) };
    }
  }
}

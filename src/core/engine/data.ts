import { ShapeError, Tensor, shapeSize } from '../tensor/tensor';

/** A supervised dataset held as two dense tensors with a leading sample axis. */
export interface Dataset {
  name: string;
  /** [N, ...inputShape] */
  xs: Tensor;
  /** [N, outputs] — one-hot rows for classification with softmax, 0/1 for sigmoid, real values for regression. */
  ys: Tensor;
  /** Optional class names, used by explanations. */
  classes?: string[];
  /** Held-out examples, never trained on; evaluated at every epoch end to show generalisation. */
  test?: { xs: Tensor; ys: Tensor };
}

export function datasetSize(d: Dataset): number {
  return d.xs.shape[0];
}

export function validateDataset(d: Dataset, inputShape: readonly number[], outputs: number): void {
  const n = d.xs.shape[0];
  const xShape = d.xs.shape.slice(1);
  if (xShape.length !== inputShape.length || xShape.some((v, i) => v !== inputShape[i])) {
    throw new ShapeError(`dataset ${d.name}: inputs are [${xShape}] but the model expects [${inputShape}]`);
  }
  if (d.ys.shape[0] !== n || d.ys.shape[1] !== outputs) {
    throw new ShapeError(
      `dataset ${d.name}: targets are [${d.ys.shape}] but the model needs [${n}, ${outputs}]`,
    );
  }
}

/** Rows `indices` of `t`, keeping the leading axis. */
export function gatherRows(t: Tensor, indices: readonly number[]): Tensor {
  const row = shapeSize(t.shape.slice(1));
  const out = new Float64Array(indices.length * row);
  indices.forEach((idx, i) => out.set(t.data.subarray(idx * row, (idx + 1) * row), i * row));
  return Tensor.adopt([indices.length, ...t.shape.slice(1)], out);
}

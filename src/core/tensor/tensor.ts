/**
 * Immutable n-dimensional array of float64 values in row-major order.
 *
 * Immutability is the defence against legacy defect D4 (tensors needed by a
 * backward rule being mutated after the forward pass): the constructor copies
 * its input and no method writes to `data`. Callers receive the backing array
 * for fast reads; writing to it is a contract violation that the determinism
 * tests would expose.
 */
export type Shape = readonly number[];

export class ShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShapeError';
  }
}

export function shapeSize(shape: Shape): number {
  let n = 1;
  for (const d of shape) n *= d;
  return n;
}

export function shapesEqual(a: Shape, b: Shape): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

export function stridesOf(shape: Shape): number[] {
  const strides = new Array<number>(shape.length);
  let s = 1;
  for (let i = shape.length - 1; i >= 0; i--) {
    strides[i] = s;
    s *= shape[i];
  }
  return strides;
}

function validateShape(shape: Shape): void {
  for (const d of shape) {
    if (!Number.isInteger(d) || d < 0) throw new ShapeError(`invalid dimension ${d} in shape [${shape}]`);
  }
}

export class Tensor {
  readonly shape: Shape;
  readonly data: Float64Array;
  readonly size: number;

  private constructor(shape: Shape, data: Float64Array) {
    this.shape = Object.freeze([...shape]);
    this.data = data;
    this.size = data.length;
  }

  /** Copies `values`, so the caller may keep mutating its own buffer. */
  static from(shape: Shape, values: ArrayLike<number>): Tensor {
    validateShape(shape);
    const n = shapeSize(shape);
    if (values.length !== n) {
      throw new ShapeError(`shape [${shape}] needs ${n} values, got ${values.length}`);
    }
    return new Tensor(shape, Float64Array.from(values));
  }

  /**
   * Takes ownership of `buffer` without copying. Only for freshly allocated
   * buffers inside op implementations that never touch them again.
   */
  static adopt(shape: Shape, buffer: Float64Array): Tensor {
    validateShape(shape);
    if (buffer.length !== shapeSize(shape)) {
      throw new ShapeError(`shape [${shape}] needs ${shapeSize(shape)} values, got ${buffer.length}`);
    }
    return new Tensor(shape, buffer);
  }

  static scalar(v: number): Tensor {
    return new Tensor([], Float64Array.of(v));
  }

  static zeros(shape: Shape): Tensor {
    validateShape(shape);
    return new Tensor(shape, new Float64Array(shapeSize(shape)));
  }

  static full(shape: Shape, v: number): Tensor {
    validateShape(shape);
    return new Tensor(shape, new Float64Array(shapeSize(shape)).fill(v));
  }

  get rank(): number {
    return this.shape.length;
  }

  /** Value at a multi-index; bounds-checked because silent out-of-range reads are a correctness bug. */
  at(...index: number[]): number {
    if (index.length !== this.shape.length) {
      throw new ShapeError(`index of rank ${index.length} into tensor of rank ${this.shape.length}`);
    }
    let offset = 0;
    let stride = 1;
    for (let i = this.shape.length - 1; i >= 0; i--) {
      const k = index[i];
      if (k < 0 || k >= this.shape[i] || !Number.isInteger(k)) {
        throw new ShapeError(`index ${k} out of range for axis ${i} of size ${this.shape[i]}`);
      }
      offset += k * stride;
      stride *= this.shape[i];
    }
    return this.data[offset];
  }

  item(): number {
    if (this.size !== 1) throw new ShapeError(`item() on tensor of size ${this.size}`);
    return this.data[0];
  }

  toArray(): number[] {
    return Array.from(this.data);
  }

  reshape(shape: Shape): Tensor {
    validateShape(shape);
    if (shapeSize(shape) !== this.size) {
      throw new ShapeError(`cannot reshape [${this.shape}] to [${shape}]`);
    }
    // Sharing is safe because tensors are never written after construction.
    return new Tensor(shape, this.data);
  }
}

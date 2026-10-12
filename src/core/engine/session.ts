/**
 * The training loop.
 *
 * Execution is per sample with gradient accumulation: within a mini-batch of
 * size B each sample gets its own forward pass, loss and backward pass, and
 * the update uses the mean of the B per-sample gradients. This is
 * mathematically identical to a batched forward/backward on the mean loss
 * (verified against TF.js in tests/parity) and is what makes "sample" a real
 * level of execution granularity in the Neural Program Model.
 *
 * The session never mutates a tensor; parameters are replaced by new tensors
 * on every update, so a checkpoint is just a set of references.
 */
import { Tape, backward, type BackwardStep, type Var } from '../autodiff';
import { buildModel, forward, layerActivation, type Model, type ModelConfig } from '../layers/model';
import { applyLoss, fusesSoftmax, validatePairing, type LossName } from '../losses/losses';
import { computeUpdate, type OptimizerConfig } from '../optim/optim';
import { initialize } from '../rng/init';
import { Rng, type RngState } from '../rng/rng';
import { add, scale } from '../tensor/ops';
import { Tensor } from '../tensor/tensor';
import { type Dataset, datasetSize, gatherRows, validateDataset } from './data';

export interface TrainConfig {
  model: ModelConfig;
  loss: LossName;
  optimizer: OptimizerConfig;
  batchSize: number;
  epochs: number;
  seed: number;
  shuffle: boolean;
  /** Resolution of the decision-boundary grid evaluated at each epoch end (2-D inputs only); 0 disables. */
  boundaryGrid?: number;
}

/** Progress through an epoch; everything endEpoch() needs, so a resumed session reports identical summaries. */
export interface EpochProgress {
  order: readonly number[];
  batch: number;
  lossSum: number;
  batchLosses: readonly number[];
  gradNormSums: readonly number[];
  epochCheckpoint: Checkpoint;
}

export interface Checkpoint {
  /** Index of the epoch about to start. */
  epoch: number;
  params: ReadonlyMap<string, Tensor>;
  optState: ReadonlyMap<string, Tensor | null>;
  rng: RngState;
  /** Present when the checkpoint was taken between batches of an epoch. */
  inEpoch: EpochProgress | null;
}

export interface SampleRecord {
  index: number;
  x: Tensor;
  y: Tensor;
  tape: Tape;
  output: Var;
  logits: Var;
  loss: Var;
  backwardSteps: BackwardStep[];
  /** Per-parameter gradient of this sample's loss. */
  grads: ReadonlyMap<string, Tensor>;
  /** Leaf Vars that held the parameters during this sample, by parameter name. */
  paramVars: ReadonlyMap<string, Var>;
}

export interface ParamUpdate {
  name: string;
  /** Mean of the per-sample gradients in the batch. */
  grad: Tensor;
  state: Tensor | null;
  delta: Tensor;
  before: Tensor;
  after: Tensor;
}

export interface BatchRecord {
  epoch: number;
  batch: number;
  indices: number[];
  samples: SampleRecord[];
  loss: number;
  updates: ParamUpdate[];
}

export interface EvalResult {
  loss: number;
  accuracy: number | null;
  n: number;
  /** Row-major grid of predicted probability of class 1 (or first output) over `bounds`. */
  boundary?: { resolution: number; bounds: [number, number, number, number]; values: number[] };
}

export interface EpochRecord {
  epoch: number;
  order: readonly number[];
  checkpoint: Checkpoint;
  meanLoss: number;
  /** Loss of every batch, in order. */
  batchLosses: number[];
  /** Per parameter (model order): mean over batches of the L2 norm of the batch-mean gradient. */
  gradNorms: number[];
  /** Per parameter (model order): L2 norm at the end of the epoch. */
  paramNorms: number[];
  eval: EvalResult;
}

export interface SessionObserver {
  onEpochBegin?(epoch: number, order: readonly number[], checkpoint: Checkpoint): void;
  onBatchBegin?(epoch: number, batch: number, indices: readonly number[]): void;
  onSample?(epoch: number, batch: number, sampleInBatch: number, rec: SampleRecord): void;
  onBatchEnd?(rec: BatchRecord): void;
  onEpochEnd?(rec: EpochRecord): void;
}

export class TrainingSession {
  readonly config: TrainConfig;
  readonly data: Dataset;
  readonly model: Model;
  private params = new Map<string, Tensor>();
  private optState = new Map<string, Tensor | null>();
  private rng: Rng;
  private epochIndex = 0;
  private current: {
    order: readonly number[];
    batch: number;
    lossSum: number;
    batchLosses: number[];
    gradNormSums: number[];
    checkpoint: Checkpoint;
  } | null = null;

  constructor(config: TrainConfig, data: Dataset, from?: Checkpoint) {
    this.config = config;
    this.data = data;
    this.model = buildModel(config.model);
    const out = this.model.layers[this.model.layers.length - 1];
    validatePairing(config.loss, out ? layerActivation(out) : null);
    validateDataset(data, config.model.inputShape, this.model.outputShape[0]);
    if (config.batchSize < 1 || !Number.isInteger(config.batchSize))
      throw new Error('batchSize must be a positive integer');
    if (from) {
      this.rng = Rng.fromState(from.rng);
      this.params = new Map(from.params);
      this.optState = new Map(from.optState);
      this.epochIndex = from.epoch;
      if (from.inEpoch) {
        const e = from.inEpoch;
        this.current = {
          order: e.order,
          batch: e.batch,
          lossSum: e.lossSum,
          batchLosses: [...e.batchLosses],
          gradNormSums: [...e.gradNormSums],
          checkpoint: e.epochCheckpoint,
        };
      }
    } else {
      this.rng = new Rng(config.seed);
      // Initialisation consumes the RNG in declaration order, so the same seed
      // always yields the same weights regardless of what happens later.
      for (const p of this.model.params) {
        this.params.set(p.name, initialize(p.init, p.shape, this.rng));
        this.optState.set(p.name, null);
      }
    }
  }

  get epoch(): number {
    return this.epochIndex;
  }

  get done(): boolean {
    return this.epochIndex >= this.config.epochs;
  }

  parameters(): ReadonlyMap<string, Tensor> {
    return this.params;
  }

  /**
   * Snapshot sufficient to resume execution exactly here. Mid-epoch it also
   * records the epoch's sample order and progress, so time travel can restart
   * at any batch boundary rather than only at epoch starts.
   */
  checkpoint(): Checkpoint {
    const cur = this.current;
    return {
      epoch: this.epochIndex,
      params: new Map(this.params),
      optState: new Map(this.optState),
      rng: this.rng.state(),
      inEpoch: cur
        ? {
            order: cur.order,
            batch: cur.batch,
            lossSum: cur.lossSum,
            batchLosses: [...cur.batchLosses],
            gradNormSums: [...cur.gradNormSums],
            epochCheckpoint: cur.checkpoint,
          }
        : null,
    };
  }

  /** Runs one sample's forward, loss and backward pass with the current parameters. */
  runSample(index: number): SampleRecord {
    const tape = new Tape();
    const x = gatherRows(this.data.xs, [index]);
    const y = gatherRows(this.data.ys, [index]);
    const paramVars = new Map<string, Var>();
    for (const p of this.model.params)
      paramVars.set(p.name, tape.leaf(this.params.get(p.name)!, true, p.name));
    const xv = tape.leaf(x, false, 'x');
    const { output, logits } = forward(this.model, tape, xv, paramVars, fusesSoftmax(this.config.loss));
    const loss = applyLoss(tape, this.config.loss, output, logits, tape.leaf(y, false, 'y'));
    const backwardSteps: BackwardStep[] = [];
    const g = backward(tape, loss, undefined, (s) => backwardSteps.push(s));
    const grads = new Map<string, Tensor>();
    for (const p of this.model.params)
      grads.set(p.name, g.get(paramVars.get(p.name)!.id) ?? Tensor.zeros(p.shape));
    return { index, x, y, tape, output, logits, loss, backwardSteps, grads, paramVars };
  }

  get batchesPerEpoch(): number {
    return Math.ceil(datasetSize(this.data) / this.config.batchSize);
  }

  /** True between beginEpoch() and endEpoch(). */
  get inEpoch(): boolean {
    return this.current !== null;
  }

  /** Index of the next batch to run within the current epoch. */
  get nextBatch(): number {
    return this.current?.batch ?? 0;
  }

  beginEpoch(observer?: SessionObserver): readonly number[] {
    if (this.done) throw new Error('training already complete');
    if (this.current) throw new Error('epoch already in progress');
    const checkpoint = this.checkpoint();
    const n = datasetSize(this.data);
    const order = this.config.shuffle ? this.rng.permutation(n) : Array.from({ length: n }, (_, i) => i);
    this.current = {
      order,
      batch: 0,
      lossSum: 0,
      batchLosses: [],
      gradNormSums: this.model.params.map(() => 0),
      checkpoint,
    };
    observer?.onEpochBegin?.(this.epochIndex, order, checkpoint);
    return order;
  }

  runBatch(observer?: SessionObserver): BatchRecord {
    const cur = this.current;
    if (!cur) throw new Error('no epoch in progress');
    if (cur.batch >= this.batchesPerEpoch) throw new Error('epoch has no batches left');
    const epoch = this.epochIndex;
    const b = cur.batch;
    const B = this.config.batchSize;
    const indices = cur.order.slice(b * B, b * B + B);
    observer?.onBatchBegin?.(epoch, b, indices);
    const samples: SampleRecord[] = [];
    const gradSum = new Map<string, Tensor>();
    indices.forEach((idx, s) => {
      const rec = this.runSample(idx);
      samples.push(rec);
      for (const [name, g] of rec.grads) {
        const prev = gradSum.get(name);
        gradSum.set(name, prev ? add(prev, g) : g);
      }
      observer?.onSample?.(epoch, b, s, rec);
    });
    const batchLoss = samples.reduce((acc, s) => acc + s.loss.value.item(), 0) / indices.length;
    cur.lossSum += batchLoss * indices.length;
    cur.batchLosses.push(batchLoss);
    const updates: ParamUpdate[] = this.model.params.map((p) => {
      const grad = scale(gradSum.get(p.name)!, 1 / indices.length);
      const { state, delta } = computeUpdate(this.config.optimizer, grad, this.optState.get(p.name) ?? null);
      const before = this.params.get(p.name)!;
      const after = add(before, delta);
      return { name: p.name, grad, state, delta, before, after };
    });
    for (const u of updates) {
      this.params.set(u.name, u.after);
      this.optState.set(u.name, u.state);
    }
    updates.forEach((u, k) => (cur.gradNormSums[k] += l2(u.grad)));
    cur.batch++;
    const rec: BatchRecord = { epoch, batch: b, indices, samples, loss: batchLoss, updates };
    observer?.onBatchEnd?.(rec);
    return rec;
  }

  endEpoch(observer?: SessionObserver): EpochRecord {
    const cur = this.current;
    if (!cur) throw new Error('no epoch in progress');
    if (cur.batch < this.batchesPerEpoch) throw new Error('epoch still has batches to run');
    const rec: EpochRecord = {
      epoch: this.epochIndex,
      order: cur.order,
      checkpoint: cur.checkpoint,
      meanLoss: cur.lossSum / datasetSize(this.data),
      batchLosses: [...cur.batchLosses],
      gradNorms: cur.gradNormSums.map((v) => v / cur.batchLosses.length),
      paramNorms: this.model.params.map((p) => l2(this.params.get(p.name)!)),
      eval: this.evaluate(),
    };
    this.current = null;
    this.epochIndex++;
    observer?.onEpochEnd?.(rec);
    return rec;
  }

  runEpoch(observer?: SessionObserver): EpochRecord {
    this.beginEpoch(observer);
    while (this.nextBatch < this.batchesPerEpoch) this.runBatch(observer);
    return this.endEpoch(observer);
  }

  /** Predictions for a batch of inputs with the current parameters (no gradients). */
  predict(xs: Tensor): Tensor {
    const tape = new Tape();
    const pm = new Map<string, Var>();
    for (const [k, v] of this.params) pm.set(k, tape.leaf(v, false));
    return forward(this.model, tape, tape.leaf(xs, false), pm, false).output.value;
  }

  evaluate(): EvalResult {
    const tape = new Tape();
    const pm = new Map<string, Var>();
    for (const [k, v] of this.params) pm.set(k, tape.leaf(v, false));
    const { output, logits } = forward(
      this.model,
      tape,
      tape.leaf(this.data.xs, false),
      pm,
      fusesSoftmax(this.config.loss),
    );
    const loss = applyLoss(
      tape,
      this.config.loss,
      output,
      logits,
      tape.leaf(this.data.ys, false),
    ).value.item();
    const result: EvalResult = {
      loss,
      accuracy: accuracy(this.config.loss, output.value, this.data.ys),
      n: datasetSize(this.data),
    };
    const res = this.config.boundaryGrid ?? 0;
    if (res > 0 && this.config.model.inputShape.length === 1 && this.config.model.inputShape[0] === 2) {
      result.boundary = this.boundary(res);
    }
    return result;
  }

  private boundary(res: number): NonNullable<EvalResult['boundary']> {
    const xs = this.data.xs.data;
    let x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (let i = 0; i < xs.length; i += 2) {
      x0 = Math.min(x0, xs[i]);
      x1 = Math.max(x1, xs[i]);
      y0 = Math.min(y0, xs[i + 1]);
      y1 = Math.max(y1, xs[i + 1]);
    }
    const padX = (x1 - x0) * 0.15 || 0.5;
    const padY = (y1 - y0) * 0.15 || 0.5;
    const bounds: [number, number, number, number] = [x0 - padX, x1 + padX, y0 - padY, y1 + padY];
    const pts = new Float64Array(res * res * 2);
    for (let r = 0; r < res; r++)
      for (let c = 0; c < res; c++) {
        const k = (r * res + c) * 2;
        pts[k] = bounds[0] + ((bounds[1] - bounds[0]) * (c + 0.5)) / res;
        pts[k + 1] = bounds[2] + ((bounds[3] - bounds[2]) * (r + 0.5)) / res;
      }
    const pred = this.predict(Tensor.adopt([res * res, 2], pts));
    const k = pred.shape[1];
    // For softmax outputs report P(class 1) so a two-class softmax and a sigmoid render alike.
    const values = Array.from({ length: res * res }, (_, i) => pred.data[i * k + (k > 1 ? 1 : 0)]);
    return { resolution: res, bounds, values };
  }
}

function l2(t: Tensor): number {
  let s = 0;
  for (let i = 0; i < t.size; i++) s += t.data[i] * t.data[i];
  return Math.sqrt(s);
}

export function accuracy(loss: LossName, pred: Tensor, ys: Tensor): number | null {
  if (loss === 'mse') return null;
  const n = pred.shape[0];
  const k = pred.shape[1];
  let correct = 0;
  for (let i = 0; i < n; i++) {
    if (k === 1) {
      if (pred.data[i] >= 0.5 === ys.data[i] >= 0.5) correct++;
    } else {
      let pi = 0,
        yi = 0;
      for (let j = 1; j < k; j++) {
        if (pred.data[i * k + j] > pred.data[i * k + pi]) pi = j;
        if (ys.data[i * k + j] > ys.data[i * k + yi]) yi = j;
      }
      if (pi === yi) correct++;
    }
  }
  return correct / n;
}

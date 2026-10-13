/**
 * TF.js oracle shared by the parity test and the figure generator: trains the
 * same architecture from the same initial weights on the same batch order,
 * independently, in TF.js (float32, its own autodiff), and reports per-step
 * deviations from our engine. TF.js is used only under tests/ and scripts/.
 */
import * as tf from '@tensorflow/tfjs';
import type { Dataset } from '../../src/core/engine/data';
import { type BatchRecord, type TrainConfig, TrainingSession } from '../../src/core/engine/session';
import type { ModelConfig } from '../../src/core/layers/model';
import type { LossName } from '../../src/core/losses/losses';
import { Tensor } from '../../src/core/tensor/tensor';

/** |ours − tfjs| ≤ ABS + REL·|tfjs|. Float32 rounding over ≥100 accumulated steps dominates. */
export const PARITY = { ABS: 1e-4, REL: 1e-3, MIN_STEPS: 100 };

export interface ParityStep {
  step: number;
  epoch: number;
  oursLoss: number;
  tfLoss: number;
  maxParamAbs: number;
}

export interface ParityResult {
  steps: ParityStep[];
  params: number;
  movement: number;
  maxLossAbs: number;
  maxLossRel: number;
  maxParamAbs: number;
  maxParamRel: number;
  failures: number;
}

export async function initTf(): Promise<void> {
  await tf.setBackend('cpu');
  await tf.ready();
}

export function toTf(t: Tensor): tf.Tensor {
  return tf.tensor(Array.from(t.data), [...t.shape], 'float32');
}

/** Our conv kernel [F, C, KH, KW] → TF [KH, KW, C, F]. */
function kernelToTf(t: Tensor): tf.Tensor {
  return tf.transpose(toTf(t), [2, 3, 1, 0]);
}
function kernelFromTf(t: tf.Tensor): Float32Array {
  return tf.transpose(t, [3, 2, 0, 1]).dataSync() as Float32Array;
}

function tfForward(
  model: ModelConfig,
  x: tf.Tensor,
  vars: Map<string, tf.Variable>,
): { out: tf.Tensor; logits: tf.Tensor } {
  // Our layout is NCHW; TF.js CPU kernels are NHWC. Convert at the boundaries
  // and flatten in channel-major order so feature ordering matches ours.
  let h: tf.Tensor = x.rank === 4 ? tf.transpose(x, [0, 2, 3, 1]) : x;
  let logits = h;
  model.layers.forEach((lc, i) => {
    const name = `L${i + 1}`;
    if (lc.type === 'dense' || lc.type === 'conv2d') {
      const W = vars.get(`${name}.W`)!;
      const b = vars.get(`${name}.b`)!;
      const z =
        lc.type === 'dense'
          ? tf.add(tf.matMul(h as tf.Tensor2D, W as tf.Tensor2D), b)
          : tf.add(
              tf.conv2d(h as tf.Tensor4D, W as unknown as tf.Tensor4D, lc.stride ?? 1, lc.padding ?? 0),
              b,
            );
      logits = z;
      h =
        lc.activation === 'relu'
          ? tf.relu(z)
          : lc.activation === 'sigmoid'
            ? tf.sigmoid(z)
            : lc.activation === 'tanh'
              ? tf.tanh(z)
              : lc.activation === 'softmax'
                ? tf.softmax(z)
                : z;
    } else if (lc.type === 'pool') {
      const s = lc.stride ?? lc.size;
      h =
        lc.mode === 'max'
          ? tf.maxPool(h as tf.Tensor4D, lc.size, s, 'valid')
          : tf.avgPool(h as tf.Tensor4D, lc.size, s, 'valid');
    } else {
      h = tf.reshape(tf.transpose(h, [0, 3, 1, 2]), [h.shape[0], -1]);
    }
  });
  return { out: h, logits };
}

function tfLoss(loss: LossName, out: tf.Tensor, logits: tf.Tensor, y: tf.Tensor): tf.Scalar {
  if (loss === 'mse') return tf.mean(tf.square(tf.sub(out, y)));
  if (loss === 'bce') {
    const p = tf.clipByValue(out, 1e-7, 1 - 1e-7);
    return tf.neg(tf.mean(tf.add(tf.mul(y, tf.log(p)), tf.mul(tf.sub(1, y), tf.log(tf.sub(1, p))))));
  }
  return tf.div(tf.neg(tf.sum(tf.mul(y, tf.logSoftmax(logits)))), logits.shape[0]!) as tf.Scalar;
}

function dev(ours: number, ref: number): { abs: number; rel: number; ok: boolean } {
  const abs = Math.abs(ours - ref);
  return {
    abs,
    rel: abs / Math.max(Math.abs(ref), 1e-12),
    ok: abs <= PARITY.ABS + PARITY.REL * Math.abs(ref),
  };
}

export function runParity(config: TrainConfig, data: Dataset): ParityResult {
  const session = new TrainingSession(config, data);
  const vars = new Map<string, tf.Variable>();
  for (const p of session.model.params) {
    const t = session.parameters().get(p.name)!;
    vars.set(p.name, tf.variable(p.shape.length === 4 ? kernelToTf(t) : toTf(t), true, p.name));
  }
  const accum = new Map<string, tf.Tensor>();
  const opt = config.optimizer;
  const res: ParityResult = {
    steps: [],
    params: 0,
    movement: 0,
    maxLossAbs: 0,
    maxLossRel: 0,
    maxParamAbs: 0,
    maxParamRel: 0,
    failures: 0,
  };
  const onBatchEnd = (rec: BatchRecord): void => {
    let tfLossValue = NaN;
    tf.tidy(() => {
      const x = toTf(gather(data.xs, rec.indices));
      const y = toTf(gather(data.ys, rec.indices));
      const { value, grads } = tf.variableGrads(() => {
        const { out, logits } = tfForward(config.model, x, vars);
        return tfLoss(config.loss, out, logits, y);
      });
      tfLossValue = value.dataSync()[0];
      for (const [name, v] of vars) {
        const g = grads[name];
        let step: tf.Tensor;
        if (opt.type === 'sgd') step = g;
        else {
          const a = tf.add(tf.mul(accum.get(name) ?? tf.zerosLike(g), opt.momentum), g);
          const kept = tf.keep(a);
          accum.get(name)?.dispose();
          accum.set(name, kept);
          step = a;
        }
        v.assign(tf.sub(v, tf.mul(step, opt.lr)));
      }
    });
    const d = dev(rec.loss, tfLossValue);
    res.maxLossAbs = Math.max(res.maxLossAbs, d.abs);
    res.maxLossRel = Math.max(res.maxLossRel, d.rel);
    if (!d.ok) res.failures++;
    let stepParamAbs = 0;
    for (const u of rec.updates) {
      for (let i = 0; i < u.delta.size; i++) res.movement += Math.abs(u.delta.data[i]);
      const v = vars.get(u.name)!;
      const ref = u.after.rank === 4 ? kernelFromTf(v) : (v.dataSync() as Float32Array);
      for (let i = 0; i < ref.length; i++) {
        const dp = dev(u.after.data[i], ref[i]);
        stepParamAbs = Math.max(stepParamAbs, dp.abs);
        res.maxParamAbs = Math.max(res.maxParamAbs, dp.abs);
        res.maxParamRel = Math.max(res.maxParamRel, dp.rel);
        if (!dp.ok) res.failures++;
      }
    }
    res.steps.push({
      step: res.steps.length + 1,
      epoch: rec.epoch,
      oursLoss: rec.loss,
      tfLoss: tfLossValue,
      maxParamAbs: stepParamAbs,
    });
  };
  while (!session.done) session.runEpoch({ onBatchEnd });
  res.params = session.model.params.reduce((a, p) => a + p.shape.reduce((x, y) => x * y, 1), 0);
  for (const v of vars.values()) v.dispose();
  for (const a of accum.values()) a.dispose();
  return res;
}

/** Batch rows gathered by index (local, so the oracle shares no helper with the engine's data path). */
function gather(src: Tensor, idx: readonly number[]): Tensor {
  const row = src.size / src.shape[0];
  const out: number[] = [];
  for (const i of idx) for (let k = 0; k < row; k++) out.push(src.data[i * row + k]);
  return Tensor.from([idx.length, ...src.shape.slice(1)], out);
}

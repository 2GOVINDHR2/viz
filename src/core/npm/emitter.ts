/**
 * Translates a training session into NPM instructions.
 *
 * The emitter observes the session and walks each sample's autodiff tape —
 * forward entries in order, backward steps in reverse — mapping every tape op
 * to instructions through the registered op mappings (kinds.ts). It holds no
 * per-op logic, so the trace is exactly the computation that ran.
 */
import type { TapeEntry, Var } from '../autodiff';
import type {
  BatchRecord,
  Checkpoint,
  EpochRecord,
  SampleRecord,
  SessionObserver,
  TrainingSession,
} from '../engine/session';
import { Tensor } from '../tensor/tensor';
import {
  type Instruction,
  type InstructionKind,
  type MetaValue,
  type NestPath,
  type Operand,
  layerNumber,
} from './ir';
import { kindSpec, opMapping, type OperandSource } from './kinds';

/** Everything the emitter needs to continue numbering and referencing from a given point (used to regenerate segments). */
export interface EmitterState {
  nextId: number;
  /** Instruction/slot currently holding each parameter's value. */
  paramRefs: Map<string, Operand>;
  /** Instruction/slot holding each parameter's optimiser state, if any. */
  optRefs: Map<string, Operand | null>;
}

export type InstructionSink = (i: Instruction) => void;

const indicesTensor = (xs: readonly number[]): Tensor => Tensor.from([xs.length], xs);

export class NpmEmitter implements SessionObserver {
  private state: EmitterState;
  private readonly sink: InstructionSink;
  private readonly session: TrainingSession;
  private sampleLossRefs: Operand[] = [];
  private sampleGradRefs: Map<string, Operand>[] = [];

  constructor(session: TrainingSession, sink: InstructionSink, state?: EmitterState) {
    this.session = session;
    this.sink = sink;
    this.state = state ?? { nextId: 0, paramRefs: new Map(), optRefs: new Map() };
  }

  snapshot(): EmitterState {
    return {
      nextId: this.state.nextId,
      paramRefs: new Map(this.state.paramRefs),
      optRefs: new Map(this.state.optRefs),
    };
  }

  get nextId(): number {
    return this.state.nextId;
  }

  private emit(
    kind: InstructionKind,
    path: NestPath,
    operands: Operand[],
    results: Record<string, Tensor>,
    meta: Record<string, MetaValue> = {},
  ): Operand[] {
    const spec = kindSpec(kind);
    const partial = {
      id: this.state.nextId++,
      kind,
      path: { ...path, phase: spec.phase },
      operands,
      results,
      meta,
    };
    this.sink({ ...partial, symbolic: spec.symbolic(partial) });
    return Object.keys(results).map((slot) => ({ ref: partial.id, slot, role: '' }));
  }

  /** INIT_PARAM for every parameter, in declaration order. */
  emitPrologue(): void {
    const params = this.session.parameters();
    for (const p of this.session.model.params) {
      const [ref] = this.emit(
        'INIT_PARAM',
        { epoch: null, batch: null, sample: null, phase: 'init', layer: p.layer },
        [],
        { value: params.get(p.name)! },
        { param: p.name, role: p.role, initializer: p.init, shape: p.shape },
      );
      this.state.paramRefs.set(p.name, { ...ref, role: 'parameter' });
      this.state.optRefs.set(p.name, null);
    }
  }

  onEpochBegin(epoch: number, order: readonly number[], _c: Checkpoint): void {
    this.emit(
      'EPOCH_BEGIN',
      { epoch, batch: null, sample: null, phase: 'control', layer: null },
      [],
      { order: indicesTensor(order) },
      { shuffled: this.session.config.shuffle },
    );
  }

  onBatchBegin(epoch: number, batch: number, indices: readonly number[]): void {
    this.sampleLossRefs = [];
    this.sampleGradRefs = [];
    this.emit(
      'BATCH_BEGIN',
      { epoch, batch, sample: null, phase: 'control', layer: null },
      [],
      { indices: indicesTensor(indices) },
      { size: indices.length },
    );
  }

  onSample(epoch: number, batch: number, sample: number, rec: SampleRecord): void {
    const at = (phase: NestPath['phase'], layer: string | null): NestPath => ({
      epoch,
      batch,
      sample,
      phase,
      layer,
    });
    const producers = new Map<number, Operand>();
    const gradProducers = new Map<number, Operand>();
    const paramByVar = new Map<number, string>();
    for (const [name, v] of rec.paramVars) {
      producers.set(v.id, this.state.paramRefs.get(name)!);
      paramByVar.set(v.id, name);
    }
    const [xRef, yRef] = this.emit(
      'LOAD_INPUT',
      at('forward', null),
      [],
      { x: rec.x, y: rec.y },
      { datasetIndex: rec.index },
    );
    const tapeLeaves = rec.tape.entries.flatMap((e) => e.inputs.filter((v) => v.entry === null));
    for (const v of tapeLeaves) {
      if (v.name === 'x') producers.set(v.id, xRef);
      if (v.name === 'y') producers.set(v.id, yRef);
    }
    const ref = (v: Var, role: string): Operand => {
      const p = producers.get(v.id);
      if (!p) throw new Error(`no producer for value ${v.name ?? v.id}`);
      return { ref: p.ref, slot: p.slot, role };
    };
    const outputLayer = layerNumber(this.session.model.layers[this.session.model.layers.length - 1].name);

    // ---- forward and loss
    let layer: string | null = null;
    let lastOut: Operand | null = null;
    let lossRef: Operand | null = null;
    const closeForwardLayer = (): void => {
      if (layer && lastOut)
        this.emit(
          'FORWARD_LAYER_END',
          at('forward', layer),
          [{ ...lastOut, role: 'layer output' }],
          {},
          { layer },
        );
    };
    for (const e of rec.tape.entries) {
      const isLoss = e.meta.layer === 'loss';
      const entryLayer = isLoss ? null : (e.meta.layer ?? null);
      if (entryLayer !== layer) {
        closeForwardLayer();
        layer = entryLayer;
      }
      const m = opMapping(e.op);
      const meta: Record<string, MetaValue> = { ...(m.meta?.(e.attrs, e.op) ?? {}) };
      if (e.meta.onGradientPath === false) meta.fusedWithLoss = true;
      if (isLoss) meta.outputLayer = outputLayer;
      const slot = isLoss ? 'loss' : 'out';
      const [out] = this.emit(
        m.forwardKind,
        at(isLoss ? 'loss' : 'forward', entryLayer),
        e.inputs.map((v, k) => ref(v, m.forwardRoles[k] ?? `input${k}`)),
        { [slot]: e.output.value },
        meta,
      );
      producers.set(e.output.id, out);
      if (isLoss) lossRef = out;
      else lastOut = out;
    }
    if (!lossRef) throw new Error('sample tape has no loss entry');
    this.sampleLossRefs.push({ ...(lossRef as Operand), role: 'sample loss' });

    // ---- backward
    const grads = new Map<string, Operand>();
    let bLayer: string | null = null;
    let lastGrad: Operand | null = null;
    const closeBackwardLayer = (): void => {
      if (bLayer && lastGrad)
        this.emit(
          'BACKWARD_LAYER_END',
          at('backward', bLayer),
          [{ ...lastGrad, role: 'gradient' }],
          {},
          { layer: bLayer },
        );
    };
    for (const step of rec.backwardSteps) {
      const e: TapeEntry = step.entry;
      const isLoss = e.meta.layer === 'loss';
      const entryLayer = isLoss ? null : (e.meta.layer ?? null);
      if (entryLayer !== bLayer) {
        closeBackwardLayer();
        bLayer = entryLayer;
        lastGrad = null;
      }
      const m = opMapping(e.op);
      const resolve = (src: OperandSource, role: string): Operand => {
        switch (src.from) {
          case 'upstream': {
            const g = gradProducers.get(e.output.id);
            if (!g) throw new Error(`no upstream gradient for ${e.op}`);
            return { ...g, role };
          }
          case 'input':
            return ref(e.inputs[src.index], role);
          case 'output':
            return ref(e.output, role);
          case 'loss':
            return { ...(lossRef as Operand), role };
        }
      };
      for (const em of m.backward) {
        const results: Record<string, Tensor> = {};
        for (const { slot, input } of em.slots) {
          const g = step.gradInputs[input];
          if (g) results[slot] = g;
        }
        if (Object.keys(results).length === 0) continue;
        const meta: Record<string, MetaValue> = { ...(m.meta?.(e.attrs, e.op) ?? {}) };
        if (isLoss) {
          meta.wrt = e.op === 'softmaxCrossEntropy' ? 'logits' : 'output';
          meta.outputLayer = outputLayer;
        }
        const refs = this.emit(
          em.kind,
          at('backward', entryLayer),
          em.operands.map((o) => resolve(o.source, o.role)),
          results,
          meta,
        );
        const bySlot = new Map(refs.map((r) => [r.slot, r]));
        for (const { slot, input } of em.slots) {
          const r = bySlot.get(slot);
          if (!r) continue;
          const v = e.inputs[input];
          gradProducers.set(v.id, r);
          const param = paramByVar.get(v.id);
          if (param) grads.set(param, { ...r, role: 'sample gradient' });
          lastGrad = r;
        }
      }
      // ∂ℓ/∂(pre-bias value) is the upstream gradient itself.
      for (const k of m.passthrough ?? []) {
        const g = gradProducers.get(e.output.id);
        if (g) gradProducers.set(e.inputs[k].id, g);
      }
    }
    closeBackwardLayer();
    this.sampleGradRefs.push(grads);
  }

  onBatchEnd(rec: BatchRecord): void {
    const at = (phase: NestPath['phase'], layer: string | null): NestPath => ({
      epoch: rec.epoch,
      batch: rec.batch,
      sample: null,
      phase,
      layer,
    });
    this.emit(
      'LOSS_REDUCE',
      at('loss', null),
      this.sampleLossRefs,
      { loss: Tensor.scalar(rec.loss) },
      { batchSize: rec.indices.length },
    );
    const opt = this.session.config.optimizer;
    const specs = new Map(this.session.model.params.map((p) => [p.name, p]));
    for (const u of rec.updates) {
      const layer = specs.get(u.name)!.layer;
      const sampleGrads = this.sampleGradRefs.map((g) => g.get(u.name)).filter((g): g is Operand => !!g);
      const [acc] = this.emit(
        'GRAD_ACCUMULATE',
        at('update', layer),
        sampleGrads,
        { grad: u.grad },
        { param: u.name, batchSize: rec.indices.length },
      );
      let stepSource: Operand = { ...acc, role: 'mean gradient' };
      if (opt.type === 'momentum' && u.state) {
        const prev = this.state.optRefs.get(u.name);
        const operands = [
          { ...acc, role: 'mean gradient' },
          ...(prev ? [{ ...prev, role: 'previous velocity' }] : []),
        ];
        const [vel] = this.emit(
          'OPTIMIZER_STATE',
          at('update', layer),
          operands,
          { velocity: u.state },
          { param: u.name, momentum: opt.momentum },
        );
        this.state.optRefs.set(u.name, vel);
        stepSource = { ...vel, role: 'velocity' };
      }
      const [delta] = this.emit(
        'COMPUTE_UPDATE',
        at('update', layer),
        [stepSource],
        { delta: u.delta },
        { param: u.name, lr: opt.lr, optimizer: opt.type },
      );
      const [value] = this.emit(
        'APPLY_UPDATE',
        at('update', layer),
        [
          { ...this.state.paramRefs.get(u.name)!, role: 'parameter' },
          { ...delta, role: 'step' },
        ],
        { value: u.after },
        { param: u.name },
      );
      this.state.paramRefs.set(u.name, { ...value, role: 'parameter' });
    }
    this.emit('BATCH_END', at('control', null), [], {}, { loss: rec.loss });
  }

  onEpochEnd(rec: EpochRecord): void {
    const path: NestPath = { epoch: rec.epoch, batch: null, sample: null, phase: 'eval', layer: null };
    this.emit('EVAL_BEGIN', path, [], {}, { n: rec.eval.n });
    const results: Record<string, Tensor> = { loss: Tensor.scalar(rec.eval.loss) };
    const meta: Record<string, MetaValue> = { n: rec.eval.n };
    if (rec.eval.accuracy !== null) results.accuracy = Tensor.scalar(rec.eval.accuracy);
    if (rec.eval.boundary) {
      const b = rec.eval.boundary;
      results.boundary = Tensor.from([b.resolution, b.resolution], b.values);
      meta.bounds = [...b.bounds];
    }
    this.emit('EVAL_END', path, [], results, meta);
    const names = this.session.model.params.map((p) => p.name);
    this.emit(
      'EPOCH_END',
      { ...path, phase: 'control' },
      [],
      {
        meanLoss: Tensor.scalar(rec.meanLoss),
        batchLosses: Tensor.from([rec.batchLosses.length], rec.batchLosses),
        gradNorms: Tensor.from([names.length], rec.gradNorms),
        paramNorms: Tensor.from([names.length], rec.paramNorms),
      },
      { params: names },
    );
  }
}

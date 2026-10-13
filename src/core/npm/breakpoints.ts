/**
 * Breakpoints: predicates on instructions that stop a run.
 *
 * Gradient-magnitude breakpoints are evaluated on GRAD_ACCUMULATE — the
 * batch-mean gradient of one parameter tensor, i.e. the gradient the optimiser
 * actually uses — with magnitude = max |gᵢ|. "Exploding" fires when any
 * element exceeds τ; "vanishing" fires when every element of a parameter's
 * gradient is below τ, i.e. that whole layer has (almost) stopped learning.
 *
 * Two pathology breakpoints look across instructions. "deadRelu" fires at
 * EPOCH_END when some unit of a ReLU layer received an exactly-zero bias
 * gradient in every batch of that epoch: its ReLU was inactive (z ≤ 0) for
 * every training example, so none of its incoming weights can change. It needs
 * the whole epoch, so it only fires for epochs whose EPOCH_BEGIN the search
 * passed. "lossIncrease" fires at EPOCH_END when the mean loss grew by more
 * than a factor over the previous epoch — the signature of a learning rate
 * that is too large.
 */
import type { Instruction, InstructionKind } from './ir';
import type { TraceSource } from './source';
import { walk } from './navigator';

export type Breakpoint =
  | { type: 'kind'; kinds: InstructionKind[] }
  | { type: 'layer'; layer: string }
  | { type: 'epoch'; epoch: number }
  | { type: 'nonFinite' }
  | { type: 'gradAbove'; threshold: number; param?: string }
  | { type: 'gradBelow'; threshold: number; param?: string }
  | { type: 'weightSignChange'; param?: string }
  | { type: 'lossPlateau'; minImprovement: number }
  | { type: 'deadRelu' }
  | { type: 'lossIncrease'; factor: number };

export interface BreakHit {
  id: number;
  breakpoint: Breakpoint;
  /** One sentence for the learner: why execution stopped here. */
  reason: string;
}

const maxAbs = (data: Float64Array): number => {
  let m = 0;
  for (const v of data) m = Math.max(m, Math.abs(v));
  return m;
};

function hasNonFinite(ins: Instruction): string | null {
  for (const [slot, t] of Object.entries(ins.results))
    for (const v of t.data) if (!Number.isFinite(v)) return slot;
  return null;
}

/** Per-search memory for breakpoints that span instructions: which ReLU units have had a non-zero gradient this epoch. */
interface Scan {
  epochSeen: boolean;
  alive: Map<string, Uint8Array>;
}

function reluBias(src: TraceSource, param: unknown): string | null {
  const name = String(param);
  if (!name.endsWith('.b')) return null;
  const layer = src.header.model.layers.find((l) => l.name === name.slice(0, -2));
  return layer && 'activation' in layer && layer.activation === 'relu' ? layer.name : null;
}

function trackRelu(src: TraceSource, ins: Instruction, scan: Scan): string | null {
  if (ins.kind === 'EPOCH_BEGIN') {
    scan.epochSeen = true;
    scan.alive.clear();
    return null;
  }
  if (ins.kind === 'GRAD_ACCUMULATE') {
    const layer = reluBias(src, ins.meta.param);
    if (!layer) return null;
    const g = ins.results.grad.data;
    const a = scan.alive.get(layer) ?? new Uint8Array(g.length);
    for (let i = 0; i < g.length; i++) if (g[i] !== 0) a[i] = 1;
    scan.alive.set(layer, a);
    return null;
  }
  if (ins.kind !== 'EPOCH_END' || !scan.epochSeen) return null;
  for (const [layer, a] of scan.alive) {
    const dead = [...a].flatMap((v, i) => (v ? [] : [i + 1]));
    if (dead.length)
      return `${dead.length === 1 ? 'unit' : 'units'} ${dead.join(', ')} of layer ${layer.slice(1)} received no gradient during the whole epoch: ${dead.length === 1 ? 'its' : 'their'} ReLU was inactive (z ≤ 0) for every training example — a “dead” ReLU, whose incoming weights can no longer change`;
  }
  return null;
}

function check(src: TraceSource, ins: Instruction, bp: Breakpoint, scan: Scan): string | null {
  switch (bp.type) {
    case 'kind':
      return bp.kinds.includes(ins.kind) ? `reached ${ins.kind}` : null;
    case 'layer':
      return ins.path.layer === bp.layer &&
        (ins.kind === 'FORWARD_LAYER_END' || ins.kind === 'BACKWARD_LAYER_END' || ins.path.phase === 'update')
        ? `${ins.kind === 'BACKWARD_LAYER_END' ? 'backward pass' : ins.path.phase === 'update' ? 'update' : 'forward pass'} reached layer ${bp.layer.slice(1)}`
        : null;
    case 'epoch':
      return ins.kind === 'EPOCH_BEGIN' && ins.path.epoch === bp.epoch ? `epoch ${bp.epoch} begins` : null;
    case 'nonFinite': {
      const slot = hasNonFinite(ins);
      return slot
        ? `${ins.kind} produced a non-finite value (NaN or ±∞) in “${slot}” — training has numerically broken down`
        : null;
    }
    case 'gradAbove':
    case 'gradBelow': {
      if (ins.kind !== 'GRAD_ACCUMULATE' || (bp.param && ins.meta.param !== bp.param)) return null;
      const m = maxAbs(ins.results.grad.data);
      if (bp.type === 'gradAbove' && m > bp.threshold)
        return `the gradient of ${String(ins.meta.param)} reached ${m.toPrecision(3)} (above ${bp.threshold}) — it may be exploding`;
      if (bp.type === 'gradBelow' && m < bp.threshold)
        return `every element of the gradient of ${String(ins.meta.param)} is below ${bp.threshold} (largest ${m.toPrecision(3)}) — this layer has almost stopped learning`;
      return null;
    }
    case 'weightSignChange': {
      if (ins.kind !== 'APPLY_UPDATE' || (bp.param && ins.meta.param !== bp.param)) return null;
      const before = src.get(ins.operands[0].ref).results[ins.operands[0].slot];
      const after = ins.results.value;
      for (let i = 0; i < after.size; i++) {
        if (
          before.data[i] !== 0 &&
          after.data[i] !== 0 &&
          Math.sign(before.data[i]) !== Math.sign(after.data[i])
        )
          return `element ${i + 1} of ${String(ins.meta.param)} changed sign (${before.data[i].toPrecision(3)} → ${after.data[i].toPrecision(3)})`;
      }
      return null;
    }
    case 'lossPlateau': {
      if (ins.kind !== 'EPOCH_END' || !ins.path.epoch) return null;
      const prevEnd = src.header.epochStarts[ins.path.epoch] - 1;
      const prev = src.get(prevEnd).results.meanLoss.item();
      const cur = ins.results.meanLoss.item();
      return prev - cur < bp.minImprovement
        ? `the mean loss stopped decreasing (${prev.toPrecision(4)} → ${cur.toPrecision(4)})`
        : null;
    }
    case 'lossIncrease': {
      if (ins.kind !== 'EPOCH_END' || !ins.path.epoch) return null;
      const prev = src.get(src.header.epochStarts[ins.path.epoch] - 1).results.meanLoss.item();
      const cur = ins.results.meanLoss.item();
      return cur > prev * bp.factor
        ? `the mean loss rose from ${prev.toPrecision(4)} to ${cur.toPrecision(4)} over one epoch — the steps overshoot; the learning rate is probably too large`
        : null;
    }
    case 'deadRelu':
      return trackRelu(src, ins, scan);
  }
}

/** First instruction in (from, to] that triggers any breakpoint, or null. */
export function firstBreak(
  src: TraceSource,
  from: number,
  to: number,
  breakpoints: readonly Breakpoint[],
): BreakHit | null {
  if (breakpoints.length === 0) return null;
  const scan: Scan = { epochSeen: false, alive: new Map() };
  for (const ins of walk(src, from, to)) {
    for (const bp of breakpoints) {
      const reason = check(src, ins, bp, scan);
      if (reason) return { id: ins.id, breakpoint: bp, reason };
    }
  }
  return null;
}

/** Runs forward from `cursor` to the next breakpoint hit, or to the end of the trace. */
export function runToBreakpoint(
  src: TraceSource,
  cursor: number,
  breakpoints: readonly Breakpoint[],
): { cursor: number; hit: BreakHit | null } {
  const hit = firstBreak(src, cursor, src.length - 1, breakpoints);
  return hit ? { cursor: hit.id, hit } : { cursor: src.length - 1, hit: null };
}

/**
 * The engine side of the worker boundary. Pure and synchronous, so it is
 * tested directly in Node; the Web Worker only forwards messages to it.
 */
import { TraceStore } from '../npm/store';
import { type BreakHit, firstBreak, runToBreakpoint } from '../npm/breakpoints';
import { stepBackward, stepForward, clampCursor } from '../npm/navigator';
import { type TraceSource, storeSource } from '../npm/source';
import { reconstructState } from '../npm/state';
import { traceStatistics } from '../npm/stats';
import type { Dataset } from './data';
import * as D from './datasets';
import type { DatasetSpec, EpochSummary, Reply, Request } from './protocol';
import { Tensor } from '../tensor/tensor';
import '../npm';

export function resolveDataset(spec: DatasetSpec): Dataset {
  switch (spec.kind) {
    case 'xor':
      return D.xor();
    case 'xorClusters':
      return D.xorClusters(spec.n, spec.seed, spec.noise);
    case 'gaussians':
      return D.gaussians(spec.n, spec.seed, spec.separation);
    case 'circles':
      return D.circles(spec.n, spec.seed);
    case 'spiral':
      return D.spiral(spec.n, spec.classes, spec.seed);
    case 'line':
      return D.line(spec.n, spec.seed);
    case 'bars':
      return D.bars(spec.n, spec.size, spec.seed);
    case 'points':
      return {
        name: spec.name,
        xs: Tensor.from([spec.xs.length, spec.xs[0].length], spec.xs.flat()),
        ys: Tensor.from([spec.ys.length, spec.ys[0].length], spec.ys.flat()),
      };
  }
}

function move(src: TraceSource, cursor: number, hit: BreakHit | null): Reply {
  const state = reconstructState(src, cursor);
  const operands: Record<string, Tensor> = {};
  for (const o of state.current?.operands ?? [])
    operands[`${o.ref}.${o.slot}`] = src.get(o.ref).results[o.slot];
  return { op: 'move', cursor, state, hit, operands };
}

export class EngineHost {
  private src: TraceSource | null = null;
  private generationMs = 0;

  private need(): TraceSource {
    if (!this.src) throw new Error('no trace generated yet');
    return this.src;
  }

  handle(req: Request): Reply {
    switch (req.op) {
      case 'generate': {
        const { store, generationMs } = TraceStore.generate(req.config, resolveDataset(req.dataset), {
          budgetBytes: req.budgetBytes,
        });
        this.src = storeSource(store);
        this.generationMs = generationMs;
        return { op: 'generate', header: store.header, length: store.length, generationMs };
      }
      case 'range':
        return { op: 'range', instructions: this.need().range(req.from, req.to) };
      case 'advance': {
        const src = this.need();
        let cursor =
          req.direction > 0
            ? stepForward(src, req.cursor, req.granularity)
            : stepBackward(src, req.cursor, req.granularity);
        const hit = req.direction > 0 ? firstBreak(src, req.cursor, cursor, req.breakpoints) : null;
        if (hit) cursor = hit.id;
        return move(src, cursor, hit);
      }
      case 'jump': {
        const src = this.need();
        return move(src, clampCursor(src, req.cursor), null);
      }
      case 'runToBreakpoint': {
        const src = this.need();
        const { cursor, hit } = runToBreakpoint(src, req.cursor, req.breakpoints);
        return move(src, cursor, hit);
      }
      case 'epochSummaries': {
        const src = this.need();
        const starts = src.header.epochStarts;
        const summaries: EpochSummary[] = [];
        for (let e = 0; e + 1 < starts.length; e++) {
          const end = src.get(starts[e + 1] - 1);
          const ev = src.get(starts[e + 1] - 2);
          summaries.push({
            epoch: e,
            meanLoss: end.results.meanLoss.item(),
            batchLosses: Array.from(end.results.batchLosses.data),
            gradNorms: Array.from(end.results.gradNorms.data),
            paramNorms: Array.from(end.results.paramNorms.data),
            params: end.meta.params as string[],
            evalLoss: ev.results.loss.item(),
            evalAccuracy: ev.results.accuracy ? ev.results.accuracy.item() : null,
          });
        }
        return { op: 'epochSummaries', summaries };
      }
      case 'statistics': {
        const src = this.need();
        const all = (function* () {
          for (let id = 0; id < src.length;) {
            const [, end] = src.segmentBounds(id);
            yield* src.range(id, end);
            id = end;
          }
        })();
        return { op: 'statistics', statistics: traceStatistics(all), generationMs: this.generationMs };
      }
    }
  }
}

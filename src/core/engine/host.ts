/**
 * The engine side of the worker boundary. Pure and synchronous, so it is
 * tested directly in Node; the Web Worker only forwards messages to it.
 */
import { TraceStore } from '../npm/store';
import { type BreakHit, firstBreak, runToBreakpoint } from '../npm/breakpoints';
import { stepBackward, stepForward, clampCursor } from '../npm/navigator';
import { type TraceSource, storeSource } from '../npm/source';
import { epochSummaries, reconstructState } from '../npm/state';
import { traceStatistics } from '../npm/stats';
import type { Dataset } from './data';
import { TrainingSession } from './session';
import * as D from './datasets';
import type { DatasetSpec, Reply, Request } from './protocol';
import { Tensor } from '../tensor/tensor';
import '../npm';

type AssetLoader = (trainPerClass?: number, testPerClass?: number) => Dataset;
const assets = new Map<string, AssetLoader>();

/** Registers a loader for a bundled dataset asset (the worker does this before the first use). */
export function registerAsset(name: string, load: AssetLoader): void {
  assets.set(name, load);
}

export function resolveDataset(spec: DatasetSpec): Dataset {
  switch (spec.kind) {
    case 'asset': {
      const load = assets.get(spec.name);
      if (!load) throw new Error(`dataset asset ${spec.name} is not loaded`);
      return load(spec.trainPerClass, spec.testPerClass);
    }
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
      case 'epochSummaries':
        return { op: 'epochSummaries', summaries: epochSummaries(this.need()) };
      case 'paramHistory': {
        const src = this.need();
        const want = new Set(req.params);
        const current = new Map<string, number[]>();
        const points: { id: number; values: number[] }[] = [];
        let id = 0;
        while (id <= Math.min(req.cursor, src.length - 1)) {
          const [, end] = src.segmentBounds(id);
          for (const i of src.range(id, Math.min(end, req.cursor + 1))) {
            const name = String(i.meta.param);
            if ((i.kind === 'INIT_PARAM' || i.kind === 'APPLY_UPDATE') && want.has(name)) {
              current.set(name, Array.from(i.results.value.data));
              // Updates run in declaration order, so the last listed parameter closes each step.
              if (current.size === want.size && name === req.params[req.params.length - 1])
                points.push({ id: i.id, values: req.params.flatMap((p) => current.get(p) ?? []) });
            }
          }
          id = end;
        }
        return { op: 'paramHistory', points };
      }
      case 'compareRuns': {
        const data = resolveDataset(req.dataset);
        const runs = req.configs.map((c) => {
          const s = new TrainingSession(c, data);
          const losses: number[] = [];
          const weights: number[] = [];
          const first = s.model.params[0].name;
          let diverged = false;
          while (!s.done) {
            const l = s.runEpoch().eval.loss;
            losses.push(l);
            weights.push(s.parameters().get(first)!.data[0]);
            if (!Number.isFinite(l) || l > 1e6) {
              diverged = true;
              break;
            }
          }
          return { lr: c.optimizer.lr, losses, weights, diverged };
        });
        return { op: 'compareRuns', runs };
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

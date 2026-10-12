/**
 * Trace statistics (P3): how a run decomposes into individually inspectable
 * instructions, by kind and by level of the nesting hierarchy.
 */
import type { Instruction, NestPath } from './ir';
import { instructionBytes } from './store';

export const GRANULARITIES = ['operation', 'layer', 'phase', 'sample', 'batch', 'epoch'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/**
 * The key that groups consecutive instructions into one step at granularity g.
 * Two adjacent instructions belong to the same unit iff their keys are equal.
 */
export function unitKey(ins: Instruction, g: Granularity): string {
  const p: NestPath = ins.path;
  switch (g) {
    case 'operation':
      return String(ins.id);
    case 'layer':
      return `${p.epoch}/${p.batch}/${p.sample}/${p.phase}/${p.layer}`;
    case 'phase':
      return `${p.epoch}/${p.batch}/${p.sample}/${p.phase}`;
    case 'sample':
      return `${p.epoch}/${p.batch}/${p.sample}`;
    case 'batch':
      return `${p.epoch}/${p.batch}`;
    case 'epoch':
      return `${p.epoch}`;
  }
}

export interface TraceStatistics {
  instructions: number;
  byKind: Record<string, number>;
  byPhase: Record<string, number>;
  /** Number of distinct steps at each granularity. */
  unitsPerGranularity: Record<Granularity, number>;
  /** Deepest non-null nesting level used (1 = epoch … 5 = layer), plus the operation itself. */
  nestingDepth: number;
  granularityLevels: number;
  bytes: number;
  values: number;
}

/** Streams over instructions, so it works on a TraceStore range without materialising everything at once. */
export class StatsAccumulator {
  private s: TraceStatistics = {
    instructions: 0,
    byKind: {},
    byPhase: {},
    unitsPerGranularity: { operation: 0, layer: 0, phase: 0, sample: 0, batch: 0, epoch: 0 },
    nestingDepth: 0,
    granularityLevels: GRANULARITIES.length,
    bytes: 0,
    values: 0,
  };
  private lastKey: Partial<Record<Granularity, string>> = {};

  add(ins: Instruction): void {
    const s = this.s;
    s.instructions++;
    s.byKind[ins.kind] = (s.byKind[ins.kind] ?? 0) + 1;
    s.byPhase[ins.path.phase] = (s.byPhase[ins.path.phase] ?? 0) + 1;
    for (const g of GRANULARITIES) {
      const k = unitKey(ins, g);
      if (k !== this.lastKey[g]) {
        s.unitsPerGranularity[g]++;
        this.lastKey[g] = k;
      }
    }
    const p = ins.path;
    const depth =
      (p.epoch !== null ? 1 : 0) +
      (p.batch !== null ? 1 : 0) +
      (p.sample !== null ? 1 : 0) +
      1 +
      (p.layer !== null ? 1 : 0) +
      1;
    s.nestingDepth = Math.max(s.nestingDepth, depth);
    s.bytes += instructionBytes(ins);
    for (const t of Object.values(ins.results)) s.values += t.size;
  }

  result(): TraceStatistics {
    return {
      ...this.s,
      byKind: { ...this.s.byKind },
      byPhase: { ...this.s.byPhase },
      unitsPerGranularity: { ...this.s.unitsPerGranularity },
    };
  }
}

export function traceStatistics(instructions: Iterable<Instruction>): TraceStatistics {
  const acc = new StatsAccumulator();
  for (const i of instructions) acc.add(i);
  return acc.result();
}

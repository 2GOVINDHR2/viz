/**
 * Reads values for the novice screens from the trace in the engine worker.
 * Nothing here computes a network value: every number is a result the engine
 * recorded, fetched with the `range` request.
 */
import { useEffect, useState } from 'react';
import type { Instruction, TraceHeader } from '../../core/npm/ir';
import { engineRequest } from '../store';

export interface ExampleForward {
  /** Index of the example in the dataset. */
  index: number;
  x: number[];
  y: number[];
  /** Weighted sum, sum plus bias, and output of the output layer. */
  u: number | null;
  z: number | null;
  a: number | null;
}

/** The forward pass of every example in the first batch that starts at or after `from`. */
export function forwardPasses(instructions: Instruction[], outputLayer: string): ExampleForward[] {
  const out: ExampleForward[] = [];
  let cur: ExampleForward | null = null;
  for (const ins of instructions) {
    if (ins.kind === 'BATCH_END' && out.length) break;
    if (ins.kind === 'LOAD_INPUT') {
      cur = {
        index: Number(ins.meta.datasetIndex),
        x: Array.from(ins.results.x.data),
        y: Array.from(ins.results.y.data),
        u: null,
        z: null,
        a: null,
      };
      out.push(cur);
    } else if (cur && ins.path.layer === outputLayer && ins.path.phase === 'forward') {
      const v = ins.results.out?.data[0] ?? null;
      if (ins.kind === 'MATMUL') cur.u = v;
      else if (ins.kind === 'ADD_BIAS') cur.z = v;
      else if (ins.kind === 'ACTIVATE') cur.a = v;
    }
  }
  return out.sort((p, q) => p.index - q.index);
}

/** Forward values of the first batch of the first and of the last epoch; null while loading. */
export function useFirstAndLastPass(
  header: TraceHeader | null,
): { first: ExampleForward[]; last: ExampleForward[] } | null {
  const [v, setV] = useState<{ first: ExampleForward[]; last: ExampleForward[] } | null>(null);
  useEffect(() => {
    setV(null);
    if (!header) return;
    let live = true;
    const out = header.model.layers[header.model.layers.length - 1].name;
    const e = header.epochStarts;
    // One batch of a small experiment is a few hundred instructions at most.
    const span = 600;
    void Promise.all([
      engineRequest<'range'>({ op: 'range', from: 0, to: Math.min(e[1], span) }),
      engineRequest<'range'>({
        op: 'range',
        from: e[e.length - 2],
        to: Math.min(e[e.length - 1], e[e.length - 2] + span),
      }),
    ]).then(([a, b]) => {
      if (live) setV({ first: forwardPasses(a.instructions, out), last: forwardPasses(b.instructions, out) });
    });
    return () => {
      live = false;
    };
  }, [header]);
  return v;
}

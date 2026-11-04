/**
 * Two points of one run, compared (Fix Round 4, D4; ADR-066). Time travel shows one point at a time; this states
 * what is different between a pinned instruction A and the current instruction B:
 *  - **parameters:** for each, how many elements differ, and the largest change with its values at A and at B;
 *  - **activations:** for each layer, the example each point is on, and the activations that differ.
 *
 * A pure function of two reconstructed states: nothing is recomputed, so what it reports is what the trace holds at
 * those two points.
 */
import type { TraceHeader } from '../../core/npm/ir';
import type { ExecState } from '../../core/npm/state';

export interface ParamChange {
  name: string;
  elements: number;
  changed: number;
  /** The element that changed most (0-based), its values at A and B; null when nothing changed. */
  largest: { index: number; a: number; b: number } | null;
}

export interface LayerChange {
  layer: string;
  /** Activations of the layer's output at A and at B, when both points have them. */
  a: number[] | null;
  b: number[] | null;
  changed: number;
}

export interface Comparison {
  from: number;
  to: number;
  params: ParamChange[];
  /** The example each point is on (dataset index), or null outside an example. */
  exampleA: number | null;
  exampleB: number | null;
  layers: LayerChange[];
}

export function compareStates(header: TraceHeader, A: ExecState | null, B: ExecState | null): Comparison {
  const params: ParamChange[] = header.model.params.map((p) => {
    const a = A?.params[p.name]?.value.data;
    const b = B?.params[p.name]?.value.data;
    const n = p.shape.reduce((x, y) => x * y, 1);
    if (!a || !b) return { name: p.name, elements: n, changed: a || b ? n : 0, largest: null };
    let changed = 0;
    let best: ParamChange['largest'] = null;
    for (let k = 0; k < b.length; k++) {
      const d = Math.abs(b[k] - a[k]);
      if (d > 0 || Number.isNaN(d)) {
        changed++;
        if (!best || d > Math.abs(best.b - best.a) || Number.isNaN(d)) best = { index: k, a: a[k], b: b[k] };
      }
    }
    return { name: p.name, elements: n, changed, largest: best };
  });
  const layers: LayerChange[] = header.model.layers.map((l) => {
    const a = A?.sample?.layers[l.name]?.a?.data;
    const b = B?.sample?.layers[l.name]?.a?.data;
    let changed = 0;
    if (a && b) for (let k = 0; k < Math.min(a.length, b.length); k++) if (a[k] !== b[k]) changed++;
    return { layer: l.name, a: a ? Array.from(a) : null, b: b ? Array.from(b) : null, changed };
  });
  return {
    from: A?.cursor ?? -1,
    to: B?.cursor ?? -1,
    params,
    exampleA: A?.sample?.datasetIndex ?? null,
    exampleB: B?.sample?.datasetIndex ?? null,
    layers,
  };
}

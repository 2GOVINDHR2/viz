/**
 * The illumination contract (Fix Round 2, §3.2): which part of the network
 * diagram lights up for the instruction at the cursor. It is derived from the
 * instruction's visual mapping and nesting path alone, and every view that
 * draws a network renders exactly this set, marked with `data-lit` so tests
 * can check the rendering as well as the rule.
 *
 * Every registered instruction kind has a target other than 'none', so every
 * instruction lights something: whole-network events (epoch, batch,
 * evaluation boundaries) light the network outline.
 */
import type { TraceHeader } from '../core/npm/ir';
import type { ExecState } from '../core/npm/state';
import { visualMapping } from './registry';

export interface Illumination {
  /** The input column (an example was loaded). */
  input: boolean;
  /** Layer whose incoming weights (or kernels) are lit. */
  edges: string | null;
  /** Layers whose units are lit; 'input' stands for the input column. */
  units: string[];
  /** Layer whose biases are lit. */
  bias: string | null;
  /** The loss box. */
  loss: boolean;
  /** The whole network (epoch, batch and evaluation boundaries). */
  network: boolean;
}

export const NOTHING_LIT: Illumination = {
  input: false,
  edges: null,
  units: [],
  bias: null,
  loss: false,
  network: false,
};

export function illumination(header: TraceHeader, exec: ExecState | null): Illumination {
  const ins = exec?.current;
  if (!ins) return NOTHING_LIT;
  const m = visualMapping(ins);
  const layer = ins.path.layer ?? null;
  const lit: Illumination = { ...NOTHING_LIT, units: [] };
  switch (m.target) {
    case 'input':
      lit.input = true;
      break;
    case 'edges': {
      // Initialisation and update instructions name the parameter they act on: a bias lights the bias.
      const role = typeof ins.meta.param === 'string' ? ins.meta.param.split('.').pop() : 'W';
      if (role === 'b') lit.bias = layer;
      else lit.edges = layer;
      break;
    }
    case 'units':
    case 'layer':
      if (layer) lit.units.push(layer);
      break;
    case 'bias':
      lit.bias = layer;
      break;
    case 'loss':
      lit.loss = true;
      break;
    case 'network':
      lit.network = true;
      break;
    case 'none':
      break;
  }
  // GRAD_MATMUL_X sends the error signal back along the layer's weights to the layer before it.
  if (ins.kind === 'GRAD_MATMUL_X' && layer) {
    const k = header.model.layers.findIndex((l) => l.name === layer);
    lit.edges = layer;
    lit.units = [k > 0 ? header.model.layers[k - 1].name : 'input'];
  }
  return lit;
}

export function isLit(l: Illumination): boolean {
  return l.input || l.edges !== null || l.units.length > 0 || l.bias !== null || l.loss || l.network;
}

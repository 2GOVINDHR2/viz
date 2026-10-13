/**
 * Tests the extensibility claim of docs/NPM-SPEC.md §7 by loading the worked
 * LayerNorm extension and checking it end to end: gradients, training, trace
 * emission, schema validation, explanations and visual mappings.
 */
import Ajv2020 from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import '../../examples/layernorm';
import * as D from '../../src/core/engine/datasets';
import { TraceStore, serializeTrace } from '../../src/core/npm';
import { buildTraceSchema } from '../../src/core/npm/schema';
import { Rng } from '../../src/core/rng/rng';
import { explain } from '../../src/explain';
import { visualMapping } from '../../src/views/registry';
import { GRADCHECK_REL_TOL, gradcheck, randomTensor } from '../gradcheck/harness';

describe('extension: LayerNorm via the four registration points', () => {
  it('passes a finite-difference gradient check for input, γ and β', () => {
    const rng = new Rng(4);
    const r = gradcheck(
      'layerNorm',
      [randomTensor(rng, [3, 5]), randomTensor(rng, [5], 0.5, 1.5), randomTensor(rng, [5])],
      (t, v) => t.apply('layerNorm', v),
    );
    expect(r.maxRel).toBeLessThan(GRADCHECK_REL_TOL);
  });

  it('trains inside a model and produces a schema-valid, fully explained trace', () => {
    const { store } = TraceStore.generate(
      {
        seed: 1,
        epochs: 3,
        batchSize: 4,
        shuffle: true,
        loss: 'bce',
        optimizer: { type: 'sgd', lr: 0.5 },
        model: {
          inputShape: [2],
          layers: [
            { type: 'dense', units: 4, activation: 'linear' },
            { type: 'extension', kind: 'layerNorm' },
            { type: 'dense', units: 1, activation: 'sigmoid' },
          ],
        },
      },
      D.xorClusters(16, 2),
    );
    const trace = store.toTrace();
    const kinds = new Set(trace.instructions.map((i) => i.kind));
    expect(kinds.has('LAYER_NORM')).toBe(true);
    expect(kinds.has('GRAD_LAYER_NORM')).toBe(true);
    expect(trace.instructions.some((i) => i.kind === 'APPLY_UPDATE' && i.meta.param === 'L2.gamma')).toBe(
      true,
    );

    const validate = new Ajv2020({ strict: false }).compile(buildTraceSchema());
    expect(validate(JSON.parse(serializeTrace(trace)))).toBe(true);

    for (const ins of trace.instructions) {
      const ctx = {
        header: trace.header,
        value: (o: { ref: number; slot: string }) => trace.instructions[o.ref].results[o.slot],
        focus: 0,
        verbosity: 'novice' as const,
      };
      expect(explain(ins, ctx).sentence.length).toBeGreaterThan(10);
      expect(visualMapping(ins).label.length).toBeGreaterThan(0);
    }
  });
});

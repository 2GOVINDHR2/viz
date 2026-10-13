import { describe, expect, it } from 'vitest';
import { EngineHost } from '../../src/core/engine/host';
import { fromWire, toWire, type Reply } from '../../src/core/engine/protocol';
import { Tensor } from '../../src/core/tensor/tensor';

const config = {
  seed: 3,
  epochs: 3,
  batchSize: 2,
  shuffle: true,
  loss: 'bce' as const,
  boundaryGrid: 5,
  optimizer: { type: 'sgd' as const, lr: 0.5 },
  model: {
    inputShape: [2],
    layers: [
      { type: 'dense' as const, units: 3, activation: 'tanh' as const },
      { type: 'dense' as const, units: 1, activation: 'sigmoid' as const },
    ],
  },
};

/** Round-trips through the wire encoding, as the worker boundary does. */
const viaWire = (r: Reply): Reply => fromWire<Reply>(structuredClone(toWire(r)));

describe('engine host (worker side)', () => {
  it('generates, navigates, reports statistics and epoch summaries across the wire encoding', () => {
    const h = new EngineHost();
    const g = viaWire(h.handle({ op: 'generate', config, dataset: { kind: 'xor' } }));
    expect(g.op === 'generate' && g.length > 100).toBe(true);
    const m = viaWire(
      h.handle({ op: 'advance', cursor: -1, granularity: 'epoch', direction: 1, breakpoints: [] }),
    );
    expect(m.op).toBe('move');
    if (m.op !== 'move') return;
    expect(m.state.params['L1.W'].value).toBeInstanceOf(Tensor);
    // The first epoch-level step completes the prologue (INIT_PARAM only); the next one would run epoch 0.
    expect(m.state.current?.kind).toBe('INIT_PARAM');
    const hit = viaWire(
      h.handle({
        op: 'advance',
        cursor: m.cursor,
        granularity: 'epoch',
        direction: 1,
        breakpoints: [{ type: 'kind', kinds: ['GRAD_INIT'] }],
      }),
    );
    expect(hit.op === 'move' && hit.hit?.reason).toBe('reached GRAD_INIT');
    const s = viaWire(h.handle({ op: 'epochSummaries' }));
    expect(s.op === 'epochSummaries' && s.summaries.length).toBe(3);
    const st = viaWire(h.handle({ op: 'statistics' }));
    expect(st.op === 'statistics' && st.statistics.instructions).toBe(g.op === 'generate' ? g.length : -1);
  });

  it('errors clearly when used before a trace exists', () => {
    expect(() => new EngineHost().handle({ op: 'jump', cursor: 0 })).toThrow(/no trace/);
  });
});

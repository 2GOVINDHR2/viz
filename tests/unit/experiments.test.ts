import { describe, expect, it } from 'vitest';
import { resolveDataset } from '../../src/core/engine/host';
import { TrainingSession } from '../../src/core/engine/session';
import { EXPERIMENTS } from '../../src/experiments/registry';

describe('experiments', () => {
  for (const e of EXPERIMENTS) {
    it(`${e.id}: trains to 100 % accuracy within its configured epochs (the demo shows real learning)`, () => {
      const s = new TrainingSession(e.config, resolveDataset(e.dataset));
      let last = s.runEpoch();
      const first = last.eval.loss;
      while (!s.done) last = s.runEpoch();
      expect(last.eval.accuracy).toBe(1);
      expect(last.eval.loss).toBeLessThan(first / 3);
    });
  }
});

/**
 * TF.js parity: for every planned architecture, losses at every step and every
 * parameter after every step must agree with an independent TF.js training run
 * within PARITY tolerance (see oracle.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { recordResults } from '../support/report';
import { ARCHITECTURES } from './architectures';
import { PARITY, initTf, runParity } from './oracle';

const rows: Record<string, unknown>[] = [];

beforeAll(initTf);

describe('TF.js parity for every planned architecture', () => {
  for (const arch of ARCHITECTURES) {
    it(`${arch.id}: ${arch.experiment}`, () => {
      const data = arch.data();
      const stepsPerEpoch = Math.ceil(data.xs.shape[0] / arch.config.batchSize);
      const epochs = Math.ceil(PARITY.MIN_STEPS / stepsPerEpoch);
      const r = runParity({ ...arch.config, epochs }, data);
      const last = r.steps.at(-1)!;
      rows.push({
        id: arch.id,
        experiment: arch.experiment,
        steps: r.steps.length,
        params: r.params,
        movement: r.movement,
        maxLossAbs: r.maxLossAbs,
        maxLossRel: r.maxLossRel,
        maxParamAbs: r.maxParamAbs,
        maxParamRel: r.maxParamRel,
        finalLossOurs: last.oursLoss,
        finalLossTf: last.tfLoss,
        pass: r.failures === 0,
      });
      expect(r.steps.length).toBeGreaterThanOrEqual(PARITY.MIN_STEPS);
      expect(r.failures).toBe(0);
      // Agreement is only meaningful if training actually changed the parameters.
      expect(r.movement).toBeGreaterThan(1e-2);
    });
  }

  afterAll(() => recordResults('parity', rows as { id: string }[]));
});

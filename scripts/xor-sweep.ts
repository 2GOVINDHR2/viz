/**
 * Chooses the XOR experiment's defaults by sweep rather than by hand (legacy
 * defect D5: the inherited XOR demo plateaued at ln 2). For each setting, 20
 * seeds are trained and we record how often the network solves XOR (100 %
 * accuracy and evaluation loss < 0.1) and the median epoch at which it does.
 * Output: reports/xor-sweep.json.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as D from '../src/core/engine/datasets';
import { TrainingSession, type TrainConfig } from '../src/core/engine/session';

const rows: unknown[] = [];
for (const hidden of [2, 3, 4]) {
  for (const act of ['tanh', 'sigmoid'] as const) {
    for (const opt of [
      { type: 'sgd', lr: 0.5 },
      { type: 'sgd', lr: 1 },
      { type: 'sgd', lr: 2 },
      { type: 'momentum', lr: 0.5, momentum: 0.9 },
    ] as const) {
      const epochsToSolve: number[] = [];
      let solved = 0;
      for (let seed = 1; seed <= 20; seed++) {
        const cfg: TrainConfig = {
          seed,
          epochs: 400,
          batchSize: 4,
          shuffle: true,
          loss: 'bce',
          optimizer: opt,
          model: {
            inputShape: [2],
            layers: [
              { type: 'dense', units: hidden, activation: act },
              { type: 'dense', units: 1, activation: 'sigmoid' },
            ],
          },
        };
        const s = new TrainingSession(cfg, D.xor());
        while (!s.done) {
          const r = s.runEpoch();
          if (r.eval.accuracy === 1 && r.eval.loss < 0.1) {
            solved++;
            epochsToSolve.push(r.epoch + 1);
            break;
          }
        }
      }
      const sorted = [...epochsToSolve].sort((a, b) => a - b);
      const row = {
        hidden,
        activation: act,
        optimizer: opt,
        solved,
        of: 20,
        medianEpochs: sorted[Math.floor(sorted.length / 2)] ?? null,
        maxEpochs: sorted.at(-1) ?? null,
      };
      rows.push(row);
      console.log(JSON.stringify(row));
    }
  }
}
writeFileSync(
  resolve(import.meta.dirname, '../reports/xor-sweep.json'),
  JSON.stringify(rows, null, 2) + '\n',
);

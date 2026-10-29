/**
 * The two independent consumers of the NPM (NPM-SPEC §10; Fix Round 3, B3.3), run against the current trace
 * format in CI:
 *  - the committed sample traces are exactly what the current engine and serialiser produce, so the consumers
 *    are tested on the current format rather than on a stale file;
 *  - the verifier (tools/npm-verify.mjs) re-derives every instruction of both samples;
 *  - the replay consumer (tools/npm-replay.mjs), run as a separate process, groups instructions into exactly
 *    the steps the application's navigator takes, at every granularity;
 *  - neither imports anything but the Node standard library.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as D from '../../src/core/engine/datasets';
import { deserializeTrace, memorySource, serializeTrace, stepForward, TraceStore } from '../../src/core/npm';
import { GRANULARITIES } from '../../src/core/npm/stats';
// @ts-expect-error — plain-JS tool with no type declarations, by design (it must not share code with src/).
import { verifyTrace } from '../../tools/npm-verify.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const SAMPLES = ['xor-mlp', 'cnn-bars'] as const;
const read = (f: string): string => readFileSync(resolve(ROOT, f), 'utf8');

describe('sample traces are in the current format', () => {
  // The same configurations as scripts/gen-sample-trace.ts.
  const regenerated: Record<(typeof SAMPLES)[number], () => string> = {
    'xor-mlp': () =>
      serializeTrace(
        TraceStore.generate(
          {
            seed: 42,
            epochs: 2,
            batchSize: 2,
            shuffle: true,
            loss: 'bce',
            optimizer: { type: 'sgd', lr: 0.5 },
            boundaryGrid: 8,
            model: {
              inputShape: [2],
              layers: [
                { type: 'dense', units: 2, activation: 'tanh' },
                { type: 'dense', units: 1, activation: 'sigmoid' },
              ],
            },
          },
          D.xor(),
          { generator: 'dl-vizlab sample (scripts/gen-sample-trace.ts)' },
        ).store.toTrace(),
      ) + '\n',
    'cnn-bars': () =>
      serializeTrace(
        TraceStore.generate(
          {
            seed: 7,
            epochs: 1,
            batchSize: 2,
            shuffle: true,
            loss: 'cce',
            optimizer: { type: 'momentum', lr: 0.1, momentum: 0.9 },
            model: {
              inputShape: [1, 6, 6],
              layers: [
                { type: 'conv2d', filters: 2, kernel: 3, padding: 1, activation: 'relu' },
                { type: 'pool', mode: 'max', size: 2 },
                { type: 'flatten' },
                { type: 'dense', units: 3, activation: 'softmax' },
              ],
            },
          },
          D.bars(4, 6, 3),
          { generator: 'dl-vizlab sample (scripts/gen-sample-trace.ts)' },
        ).store.toTrace(),
      ) + '\n',
  };
  for (const s of SAMPLES)
    it(`samples/${s}.trace.json is byte-identical to a fresh run (npm run samples regenerates it)`, () => {
      expect(read(`samples/${s}.trace.json`) === regenerated[s]()).toBe(true);
    });
});

describe('the verifier re-derives every instruction of the samples', () => {
  for (const s of SAMPLES)
    it(s, () => {
      expect(verifyTrace(JSON.parse(read(`samples/${s}.trace.json`)))).toEqual([]);
    });
});

describe('the replay consumer steps exactly as the navigator does', () => {
  for (const s of SAMPLES)
    for (const g of GRANULARITIES)
      it(`${s} at ${g} granularity`, () => {
        const file = `samples/${s}.trace.json`;
        const r = spawnSync(
          process.execPath,
          ['tools/npm-replay.mjs', file, '--granularity', g, '--limit', '1000000'],
          {
            cwd: ROOT,
            encoding: 'utf8',
            maxBuffer: 1 << 28,
          },
        );
        expect(r.status).toBe(0);
        const ends = [...r.stdout.matchAll(/^step \d+: \d+ instructions? \(#\d+–#(\d+)\)$/gm)].map((m) =>
          Number(m[1]),
        );
        const src = memorySource(deserializeTrace(read(file)));
        const want: number[] = [];
        for (let c = -1; ;) {
          const n = stepForward(src, c, g);
          if (n === c) break;
          want.push(n);
          c = n;
        }
        expect(ends).toEqual(want);
      });
});

describe('the consumers import nothing from the application', () => {
  for (const f of ['tools/npm-verify.mjs', 'tools/npm-replay.mjs'])
    it(f, () => {
      const imports = [...read(f).matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
      expect(imports.every((m) => m.startsWith('node:'))).toBe(true);
      expect(read(f)).not.toMatch(/require\(|import\(/);
    });
});

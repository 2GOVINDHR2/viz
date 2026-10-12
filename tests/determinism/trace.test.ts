import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { TraceStore, serializeTrace } from '../../src/core/npm';
import { ARCHITECTURES } from '../parity/architectures';
import { recordResults } from '../support/report';

const hash = (s: string): string => createHash('sha256').update(s).digest('hex');
const rows: {
  id: string;
  instructions: number;
  bytes: number;
  sha256: string;
  repeats: number;
  identical: boolean;
  seedSensitive: boolean;
}[] = [];

describe('trace determinism: same seed and configuration ⇒ byte-identical trace', () => {
  for (const a of ARCHITECTURES) {
    it(a.id, () => {
      const run = (seed: number): string =>
        serializeTrace(
          TraceStore.generate({ ...a.config, seed, epochs: 2, boundaryGrid: 5 }, a.data()).store.toTrace(),
        );
      const first = run(a.config.seed);
      const hashes = [first, run(a.config.seed), run(a.config.seed)].map(hash);
      const other = hash(run(a.config.seed + 1));
      rows.push({
        id: a.id,
        instructions: JSON.parse(first).instructions.length,
        bytes: first.length,
        sha256: hashes[0],
        repeats: 3,
        identical: new Set(hashes).size === 1,
        seedSensitive: other !== hashes[0],
      });
      expect(new Set(hashes).size).toBe(1);
      expect(other).not.toBe(hashes[0]);
    });
  }
  afterAll(() => recordResults('trace-hash', rows));
});

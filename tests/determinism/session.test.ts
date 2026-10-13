import { afterAll, describe, expect, it } from 'vitest';
import { TrainingSession } from '../../src/core/engine/session';
import { Rng } from '../../src/core/rng/rng';
import { ARCHITECTURES } from '../parity/architectures';
import { recordResults } from '../support/report';

/** Every parameter's float64 bytes plus every batch loss, as one hex digest input. */
function fingerprint(
  arch: (typeof ARCHITECTURES)[number],
  seed: number,
  epochs = 3,
): { losses: number[]; bytes: string } {
  const s = new TrainingSession({ ...arch.config, seed, epochs }, arch.data());
  const losses: number[] = [];
  while (!s.done) s.runEpoch({ onBatchEnd: (b) => losses.push(b.loss) });
  const parts: string[] = [];
  for (const [name, t] of s.parameters())
    parts.push(name + ':' + Buffer.from(t.data.buffer, t.data.byteOffset, t.data.byteLength).toString('hex'));
  return { losses, bytes: parts.join('|') };
}

const rows: {
  id: string;
  repeats: number;
  identical: boolean;
  seedSensitive: boolean;
  resumeIdentical: boolean;
}[] = [];

describe('determinism', () => {
  it('the PRNG reproduces the same stream from the same seed and restores from captured state', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const xs = Array.from({ length: 1000 }, () => a.next());
    expect(Array.from({ length: 1000 }, () => b.next())).toEqual(xs);
    const c = new Rng(42);
    for (let i = 0; i < 500; i++) c.next();
    const d = Rng.fromState(c.state());
    expect(Array.from({ length: 500 }, () => d.next())).toEqual(xs.slice(500));
    expect(new Rng(43).next()).not.toBe(xs[0]);
  });

  it('PRNG output is uniform enough to be a sane initialiser source', () => {
    const r = new Rng(1);
    const n = 20000;
    let sum = 0;
    let sq = 0;
    for (let i = 0; i < n; i++) {
      const v = r.normal();
      sum += v;
      sq += v * v;
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.03);
    expect(Math.abs(sq / n - 1)).toBeLessThan(0.05);
  });

  for (const arch of ARCHITECTURES) {
    it(`${arch.id}: same seed ⇒ bit-identical parameters and losses across repeated runs; resume from checkpoint is identical`, () => {
      const runs = [0, 1, 2].map(() => fingerprint(arch, arch.config.seed));
      const identical = runs.every(
        (r) => r.bytes === runs[0].bytes && r.losses.every((l, i) => Object.is(l, runs[0].losses[i])),
      );
      const other = fingerprint(arch, arch.config.seed + 1);
      const seedSensitive = other.bytes !== runs[0].bytes;

      // Run 3 epochs straight vs. 1 epoch, checkpoint, and resume a fresh session from it.
      const straight = new TrainingSession({ ...arch.config, epochs: 3 }, arch.data());
      while (!straight.done) straight.runEpoch();
      const first = new TrainingSession({ ...arch.config, epochs: 3 }, arch.data());
      first.runEpoch();
      const resumed = new TrainingSession({ ...arch.config, epochs: 3 }, arch.data(), first.checkpoint());
      while (!resumed.done) resumed.runEpoch();
      let resumeIdentical = true;
      for (const [name, t] of straight.parameters()) {
        const u = resumed.parameters().get(name)!;
        if (!t.data.every((v, i) => Object.is(v, u.data[i]))) resumeIdentical = false;
      }
      rows.push({ id: arch.id, repeats: runs.length, identical, seedSensitive, resumeIdentical });
      expect(identical).toBe(true);
      expect(seedSensitive).toBe(true);
      expect(resumeIdentical).toBe(true);
    });
  }

  afterAll(() => recordResults('determinism', rows));
});

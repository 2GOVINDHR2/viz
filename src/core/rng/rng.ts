/**
 * Seeded pseudo-random number generator (xoshiro128**, seeded via splitmix32).
 *
 * All randomness in the core flows through this class so that the same seed
 * and configuration always yield a byte-identical trace. The state is four
 * 32-bit words and can be captured and restored, which is how checkpoints
 * resume a run mid-way without replaying it from the start.
 */
export type RngState = readonly [number, number, number, number];

function splitmix32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
}

const rotl = (x: number, k: number): number => ((x << k) | (x >>> (32 - k))) >>> 0;

export class Rng {
  private s: [number, number, number, number];

  constructor(seed: number) {
    if (!Number.isInteger(seed)) throw new Error(`seed must be an integer, got ${seed}`);
    const sm = splitmix32(seed);
    this.s = [sm(), sm(), sm(), sm()];
  }

  static fromState(state: RngState): Rng {
    const r = new Rng(0);
    r.s = [state[0] >>> 0, state[1] >>> 0, state[2] >>> 0, state[3] >>> 0];
    return r;
  }

  state(): RngState {
    return [...this.s];
  }

  nextU32(): number {
    const s = this.s;
    const result = Math.imul(rotl(Math.imul(s[1], 5) >>> 0, 7), 9) >>> 0;
    const t = (s[1] << 9) >>> 0;
    s[2] ^= s[0];
    s[3] ^= s[1];
    s[1] ^= s[2];
    s[0] ^= s[3];
    s[2] ^= t;
    s[3] = rotl(s[3], 11);
    for (let i = 0; i < 4; i++) s[i] >>>= 0;
    return result;
  }

  /** Uniform in [0, 1) with 53 bits of precision. */
  next(): number {
    const hi = this.nextU32() >>> 5; // 27 bits
    const lo = this.nextU32() >>> 6; // 26 bits
    return (hi * 67108864 + lo) / 9007199254740992;
  }

  uniform(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  /** Standard normal via Box–Muller (one value per call, the pair partner is discarded for simplicity of state). */
  normal(mean = 0, std = 1): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Integer in [0, n). Rejection sampling removes modulo bias. */
  int(n: number): number {
    if (!Number.isInteger(n) || n <= 0) throw new Error(`int(n) needs a positive integer, got ${n}`);
    const limit = Math.floor(0x100000000 / n) * n;
    let x = this.nextU32();
    while (x >= limit) x = this.nextU32();
    return x % n;
  }

  /** Fisher–Yates permutation of 0..n−1. */
  permutation(n: number): number[] {
    const p = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p;
  }
}

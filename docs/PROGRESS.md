# Progress Log

Append-only phase summaries. Read from the end backwards when resuming.

## 2026-10-12 — P0 started
- Discovered the inherited repository has no source code (see `docs/AUDIT.md`). Full rewrite.
- **A4 parallel-track schedule** (due 24 Oct 2026): concept inventory JSON and consent/information-sheet config — with P1; `docs/STUDY-PROTOCOL.md` — with P2; `analysis/` pipeline + simulation at n = 30/60/120 + `docs/RESULTS-SKELETON.md` — with P2/P3. All before P4 begins.

## 2026-10-12 — P0 complete
- **Shipped:** `docs/AUDIT.md` (no inherited source; legacy defects D1–D8 carried as requirements), strict TypeScript, ESLint with `Math.random`/`crypto` ban in `src/core/**` and TF.js import ban in `src/**`, Prettier, Vitest, CI workflow, B3 directory skeleton, all working docs.
- **Deferred:** none.
- **Defects found:** the inherited repo does not build (`src/main.tsx` missing).
- **Time:** ~0.5 h.

## 2026-10-12 — P1 complete
- **Shipped:** `src/core/tensor` (immutable float64 tensors, NumPy broadcasting, conv2d/pool with stride and padding), `src/core/autodiff` (tape + gradient-rule registry, 30 ops), `src/core/layers` (dense, conv2d, pool, flatten), `src/core/losses` (MSE, BCE, fused softmax-CCE with pairing validation), `src/core/optim` (SGD, momentum), `src/core/rng` (xoshiro128**, Glorot/He), `src/core/engine` (per-sample training session with checkpoints, synthetic datasets).
- **Evidence:** 36 op gradchecks + 9 whole-model gradchecks (max rel. dev. ≤ 1.2e-6, typically 1e-9); TF.js parity for 7 architectures over ≥100 steps (max abs. dev. ≤ 7.3e-7); determinism (bit-identical repeats, seed sensitivity, checkpoint-resume identity) for all 7; coverage 90.9 % statements on `src/core`.
- **Independent verification (hostile review):**
  - *Softmax + CE:* the fused rule is the only path; the softmax entry is tagged off-gradient-path. Test asserts ∂L/∂z = (p − y)/N to 1e-14 and equality with the composed −Σ y log softmax(z) form to 1e-12. Not double-applied.
  - *Pool backward:* hand-worked unit test checks the exact routed indices; overlapping 3×3/stride-2 windows gradchecked with well-separated values so the finite-difference nudge cannot flip a winner (a nudge that did would make the check vacuous).
  - *Conv backward:* gradchecked at (s, p) ∈ {(1,0), (1,1), (2,0), (2,1), (3,2)}, the last with a non-dividing stride so untouched border pixels must get exactly zero gradient; forward hand-checked with padding 1, stride 2.
  - *In-place mutation:* test snapshots every tape input/output, runs backward, asserts equality.
  - *Vacuous tests:* gradcheck projects outputs on a random tensor R (plain Σ would hide off-diagonal Jacobian errors); a deliberately wrong rule (missing factor 2) is shown to fail with rel. error > 0.3; parity asserts total parameter movement > 1e-2 so agreement is not between two frozen models.
  - *Found and fixed during review:* a first draft of the parity test asserted `x − x === 0` as its "parameters moved" check — vacuous; replaced by the movement assertion above.
- **Web Worker boundary:** deferred to P2/P3, where the trace stream defines the message protocol (SHOULD item; logged in KNOWN-GAPS).
- **Time:** ~1.5 h.

## 2026-10-12 — P2 complete
- **Shipped:** `src/core/npm/` — IR types (`ir.ts`), kind registry and tape-op → instruction mapping (`kinds.ts`, 30 built-in kinds), generic emitter (`emitter.ts`), memory-bounded `TraceStore` with batch-level checkpoints and LRU recomputation (`store.ts`), lossless serializer (`serialize.ts`), registry-generated JSON Schema (`schema.ts` → `schema.json`), trace grammar (`grammar.ts`), trace statistics and granularity keys (`stats.ts`). `src/explain/` — explainer registry and explainers for all 30 kinds (general LaTeX, substituted LaTeX, sentence, detail). `src/views/registry.ts` — visual-mapping registry. `src/core/layers/extensions.ts` — extension layers. `examples/layernorm.ts` — the worked extension. `docs/NPM-SPEC.md`. Sample traces `samples/xor-mlp.trace.json`, `samples/cnn-bars.trace.json`.
- **SHOULD delivered:** `tools/npm-replay.mjs`, an 86-line independent text consumer; plus `tools/npm-verify.mjs`, an independent re-derivation of every instruction from its operands.
- **Evidence:** 140 tests. For all 7 planned architectures: grammar conformance, schema validity, byte-exact round-trip, independent verification with zero mismatches, byte-identical regeneration of every segment, identical SHA-256 over 3 repeated runs and different under a changed seed. The LayerNorm extension gradchecks, trains, validates and explains without editing existing files.
- **Independent verification (hostile review):**
  - *Is the trace sufficient without the engine?* `tools/npm-verify.mjs` imports nothing from `src/` and re-derives every result — forward, loss, backward, update, evaluation loss over the embedded dataset, epoch summaries — from referenced values. It passes on every architecture and fails on a single perturbed gradient value. A gap found here: long-horizon views (gradient magnitude per layer across epochs, per-batch loss curve) would have had to stream the entire trace. **Fixed in the IR**, not in a view: `EPOCH_END` now carries `batchLosses`, `gradNorms`, `paramNorms`, carried through mid-epoch checkpoints so regeneration stays byte-identical, and checked by the verifier.
  - *Plausible-but-wrong numbers:* −0 would have been silently turned into 0 by `JSON.stringify` (not lossless). Fixed with explicit string encoding; tested together with NaN and ±∞.
  - *Vacuous tests:* the grammar test also asserts rejection of two corrupted sequences (a first draft's swap of two adjacent forward ops left the kind sequence unchanged — the test was vacuous; replaced with a swap that changes structure). The explanation test checks that substituted forms end with the instruction's own result value, not just that some string exists.
  - *Docs vs code:* NPM-SPEC §5.3 cites the P3 execution engine for stepping; at P2 exit only `unitKey` and the replay tool implement it. Tracked to P3. All tables in the spec that report data (instruction table, memory trade-off) are generated by `scripts/gen-npm-spec.ts` from real runs.
- **Time:** ~2 h.

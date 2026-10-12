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

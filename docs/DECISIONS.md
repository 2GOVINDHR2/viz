# Architecture Decision Records

Append-only. Each entry: context / options / decision / consequence.

## ADR-001 — 2026-10-12 — Working branch name
- **Context:** The build plan asks for branch `dl-vizlab-v2`. The execution environment restricts pushes to the designated branch `claude/new-session-bnlb4r`.
- **Options:** (a) push to `dl-vizlab-v2` anyway; (b) work on the designated branch.
- **Decision:** (b). `main` is left untouched, which is the substantive requirement.
- **Consequence:** All references to `dl-vizlab-v2` in the plan map to `claude/new-session-bnlb4r`. A human may rename the branch at any time.

## ADR-002 — 2026-10-12 — Inherited source is absent; full rewrite
- **Context:** The repository contains configuration and prose only (see `docs/AUDIT.md`).
- **Options:** (a) reconstruct the legacy design from its documentation; (b) build to the B3 architecture directly.
- **Decision:** (b). Legacy docs archived under `docs/legacy/`; their defect list becomes regression requirements.
- **Consequence:** No salvageable UI; the P4 vertical slice is built from scratch.

## ADR-003 — 2026-10-12 — ESLint replaces oxlint
- **Context:** B3 requires a lint rule banning `Math.random` in `src/core/**`.
- **Decision:** ESLint flat config with `no-restricted-properties` (Math.random) and `no-restricted-globals` (crypto) scoped to `src/core/**`, plus `no-explicit-any` there.
- **Consequence:** One linter; CI runs `eslint --max-warnings=0`.

## ADR-004 — 2026-10-12 — Numeric precision
- **Context:** The engine must be provably correct; TF.js (the parity oracle) computes in float32.
- **Options:** float32 to match TF.js bit-for-bit-ish; float64 for gradcheck precision.
- **Decision:** `Float64Array` throughout the engine. Finite-difference gradchecks then reach ~1e-9 relative error, making real bugs unambiguous. Parity against TF.js uses a documented tolerance that accounts for float32 accumulation.
- **Consequence:** Parity tolerances are relative (see `docs/VALIDATION-REPORT.md`); determinism is exact.

## ADR-005 — 2026-10-12 — Per-sample execution with gradient accumulation
- **Context:** The NPM must expose `sample` as a granularity level, yet mini-batch training is standard.
- **Options:** (a) batched tensor ops, with "sample" as a view-only slice; (b) a forward/loss/backward pass per sample, with gradients averaged at batch end.
- **Decision:** (b). Each sample is a real unit of execution; `GRAD_ACCUMULATE` (an added instruction, see ADR-010) averages the per-sample gradients.
- **Consequence:** Mathematically identical to batched training, which is proven twice: directly (`tests/unit/session.test.ts`) and against TF.js batched training (`tests/parity`). Costs B small ops instead of one large op, which is irrelevant at teaching scale.

## ADR-006 — 2026-10-12 — Loss reductions follow Keras/TF.js
- **Decision:** MSE and BCE are averaged over every element; categorical cross-entropy is summed over classes and averaged over rows. Batch loss is the mean of per-sample losses.
- **Consequence:** Legacy defect D1 (mean loss with an un-scaled gradient) cannot recur, because the reduction and its gradient live in one registered rule that is gradchecked on multi-output tensors.

## ADR-007 — 2026-10-12 — Activation/loss pairing is validated
- **Decision:** `cce` requires a softmax output and is computed fused on the logits; the displayed softmax is recorded off the gradient path. `bce` requires a sigmoid output and uses probability form with ε = 1e-7 clipping (as Keras/TF.js). Mis-pairings throw at session construction.
- **Consequence:** The softmax Jacobian is applied exactly once; a test asserts ∂L/∂z = (p − y)/N.

## ADR-008 — 2026-10-12 — Initialiser defaults
- **Decision:** He-uniform for ReLU layers, Glorot-uniform otherwise, zeros for biases; Keras fan conventions. He-normal is plain (not truncated) normal.

## ADR-009 — 2026-10-12 — TF.js parity tolerance
- **Context:** Our engine is float64 with per-sample accumulation; TF.js is float32 batched.
- **Decision:** Agreement criterion |ours − tf| ≤ 1e-4 + 1e-3·|tf| on every batch loss and every parameter after every step, for ≥ 100 steps. Observed maxima are ~1e-7 absolute, three orders of magnitude inside the bound.
- **Consequence:** A wrong gradient anywhere moves parameters by O(η·|g|) per step and fails immediately.

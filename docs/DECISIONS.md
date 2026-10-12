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

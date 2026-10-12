# DL-VizLab — P0 Audit of the Inherited Repository

**Date:** 2026-10-12 · **Auditor:** autonomous build agent · **Commit audited:** `5631b12` ("Add files via upload"), the only commit on `main`.

## 1. Headline finding: there is no inherited source code

The repository as delivered contains **no application source, no tests, and no public assets**. `git ls-tree -r origin/main` lists exactly thirteen files:

| File | Kind |
|---|---|
| `.gitignore`, `.oxlintrc.json`, `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts` | Vite + React starter configuration |
| `README.md` | Project description; links to six `docs/*.md` files that **do not exist** |
| `AUDIT.md` (2026-08-29), `AUDIT_REPORT.md` (2026-10-01), `DOCUMENTATION.md` | Prose describing a prototype |

`index.html` loads `/src/main.tsx`, which is absent, so the inherited repository **does not build**. The three prose documents describe in detail a codebase (`src/core/mathops.ts`, `src/execution/controller.ts`, `src/program/builders.ts`, ten experiments, four test files) that was never committed. Git history contains a single commit, so the code was not deleted later — it was never uploaded.

**Consequence.** "The architecture as it actually is" is: an empty Vite/React scaffold. Every claim in the legacy documents about passing tests, verified gradients and working experiments is **unverifiable** and must be treated as unsupported. The legacy documents themselves say their checks could not run (WSL 1 / Windows Node mismatch), and the 2026-08-29 audit's "70/70 pass" refers to a state that is not in this repository.

The legacy documents were moved, unchanged, to `docs/legacy/` to preserve provenance.

## 2. Architecture as described by the legacy documents (not present)

For the record, and because it informs design decisions, the described prototype had:

1. `src/core` — flat row-major tensors, a mutable named tensor store, activations, losses, hand-written dense forward/backward (`matmulRow`, `denseGradients`) and SGD.
2. `src/program` — a per-experiment op list: `INPUT`, `MATMUL`, `BIAS_ADD`, `ACTIVATE`, `LOSS`, `GRAD`, `UPDATE`.
3. `src/execution` — a mutable `ExecutionController` with a cursor, a growing record list and per-op parameter snapshots.
4. `src/explanation` — deterministic prose generated from op records.
5. `src/state/useLab.ts`, `src/components`, `src/viz` — a single React hook owning state; hand-written SVG network graph and charts.

This is a reasonable sketch of the CS-OLabs idea, but its IR is a hand-built list of ops per experiment rather than a trace emitted by a general autodiff engine, which means each new architecture needed bespoke builder code and backward rules were written by hand per layer — the main source of risk the brief warns about.

## 3. Component verdicts

| Component | Verdict | Reason |
|---|---|---|
| `src/core` (tensor, activations, losses, mathops) | **REWRITE** | Absent. Must also be replaced on merit: no autodiff, no conv/pool, dense-only, hand-written backprop. |
| `src/program` (op IR, builders) | **REWRITE** | Absent. Superseded by the Neural Program Model emitted from the autodiff tape (P2). |
| `src/execution` (controller, trace) | **REWRITE** | Absent. Described design mixed op-index and record-index (legacy audit P0 defect); replaced by checkpoint + recompute time travel (P3). |
| `src/explanation` | **REWRITE** | Absent. Re-created as a per-instruction-kind explainer registry (P2/P4). |
| `src/experiments` (10 experiments) | **REWRITE** | Absent. Re-created as declarative definitions (P6). Experiment list and the XOR lesson learned (online SGD with lr = 1 plateaus at ln 2) are retained as requirements. |
| `src/state`, `src/components`, `src/viz` | **REWRITE** | Absent. New UI uses Zustand + D3 scales + SVG/Canvas per B3. |
| `README.md` | **REWRITE** | Links to six non-existent documents; describes unverified behaviour. |
| `AUDIT.md`, `AUDIT_REPORT.md`, `DOCUMENTATION.md` | **DELETE from root (archived to `docs/legacy/`)** | Describe absent code; retained only as design history. |
| `index.html` | **KEEP (edited)** | Correct Vite entry; title fixed. |
| `vite.config.ts` | **REFACTOR** | Add relative `base` for static hosting, worker format, Vitest config. |
| `tsconfig*.json` | **REFACTOR** | Not `strict`; tests and scripts were not type-checked. |
| `.oxlintrc.json` | **DELETE** | B3 requires ESLint with a `Math.random` ban; oxlint cannot express that restriction as cleanly. |
| `package.json` | **REFACTOR** | Missing Zustand, D3, KaTeX, ESLint, Prettier, coverage, TF.js (test-only oracle), Playwright. |
| `.gitignore` | **KEEP (extended)** | Starter content is fine. |

## 4. Numerical defect hunt

Because no engine source exists, no defect can be located by file and line. The table below lists every numerical defect **reported in the legacy documents**, with the cited (now non-existent) location, and states how the rewrite prevents each class. These are carried as regression requirements into P1.

| # | Defect (as reported) | Legacy location cited | Class | Prevention in rewrite |
|---|---|---|---|---|
| D1 | Mean-reduced loss over output elements, but output gradient not divided by output count — wrong gradient for any multi-output model | `src/core/losses.ts` / `outputActivationGrad` (AUDIT_REPORT §9) | Wrong gradient formula | Losses are composed from autodiff primitives (`mean` has its own backward rule); finite-difference gradcheck on multi-output MSE/BCE/CCE. |
| D2 | Sigmoid + BCE computed as separate derivative product, clamped probabilities — numerically unstable; clamp makes gradient zero outside (ε, 1−ε) | `src/core/losses.ts` (AUDIT_REPORT §9) | Unstable softmax/CE-style pairing | BCE and CCE are offered in fused logit form (`sigmoidBCEWithLogits`, `softmaxCrossEntropy`) with stable log-sum-exp; probability-form BCE is also available, gradchecked away from the clamp. |
| D3 | `matmulRow` / `denseGradients` do not validate shapes; silently produce `NaN` | `src/core/mathops.ts` (AUDIT_REPORT §9) | Silent plausible-but-wrong output | Every tensor op validates shapes and throws `ShapeError`. |
| D4 | `Engine.get()` returns a mutable tensor; views can mutate values still needed for backward | `src/core/engine.ts` (AUDIT_REPORT §9) | In-place mutation of tensors needed for backward | Tensors are immutable by construction (`Float64Array` copied on construction, no mutating methods; frozen shape); tests assert forward inputs are byte-identical after backward. |
| D5 | XOR (2-2-1, online SGD, lr = 1, sigmoid) plateaus at ln 2 ≈ 0.693 | `src/experiments/xor.ts` (AUDIT.md C1) | Optimisation defaults, not maths | XOR defaults chosen by a recorded sweep; parity test against TF.js confirms the trajectory is the true SGD trajectory, not a bug. |
| D6 | Initialisation seeded but scale ad hoc (no Xavier/He) | `src/experiments/*` | Un-principled initialisation | Seeded Glorot/He initialisers in `src/core/rng`. |
| D7 | No convolution; any `digitData()` "CNN data" was unused | `src/experiments/datasets.ts` | Missing capability | Conv2d/pool implemented with gradchecks for stride and padding. |
| D8 | Step-back truncated records by op index while records grew across cycles | `src/execution/controller.ts` (AUDIT_REPORT §1) | State-reconstruction defect | Time travel by checkpoint + deterministic recomputation, verified by state equality tests. |

Off-by-one in convolution indexing, wrong pooling routing and missing bias updates could not be assessed — the code does not exist. They are tested for explicitly in P1 instead.

## 5. Dependency and tooling assessment against B3

| B3 requirement | Inherited state | Action |
|---|---|---|
| TypeScript `strict: true` | Not strict | Enabled; tests/scripts now type-checked via `tsconfig.node.json`. |
| React 18+ | React 19.2 | Keep. |
| Vite | Vite 8 | Keep. |
| Zustand | Absent | Added. |
| D3 for scales/layout/axes | Absent | Added modular `d3-scale`, `d3-shape`, `d3-array` (not the full bundle). |
| KaTeX (P4 explanation) | Absent | Added. |
| Own tensor + autodiff | Absent | Built in P1. |
| TF.js only in tests | Absent | `@tensorflow/tfjs` added as **devDependency**; ESLint/CI check ensures it is never imported from `src/`. |
| Vitest | Vitest 4 (no tests) | Keep; coverage via `@vitest/coverage-v8`. |
| ESLint incl. `Math.random` ban in core | oxlint, no ban | Replaced with ESLint flat config + `no-restricted-properties` on `src/core/**`. |
| Prettier | Absent | Added. |
| GitHub Actions CI | Absent | Added `.github/workflows/ci.yml`. |
| E2E | Absent | Playwright (uses pre-installed Chromium). |

## 6. Baseline

| Metric | Value |
|---|---|
| Source LOC (`src/**`) | 0 (directory absent) |
| Test count | 0 |
| Runtime dependencies | 2 (`react`, `react-dom`) |
| Dev dependencies | 7 |
| Installed packages (lockfile) | 99 |
| Builds | No (`/src/main.tsx` missing) |

## 7. Verdict

Full rewrite, as the brief anticipated — but forced by absence rather than chosen on merit. The inherited documents are valuable only as a list of pitfalls (D1–D8) and as a description of the ten-experiment curriculum, which P6 reproduces.

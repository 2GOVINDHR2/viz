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

## 2026-10-12 — A4 parallel track delivered (ahead of the 24 October deadline)
- **Shipped:** `src/study/config/concept-inventory.json` (20 core + 5 transfer items, four options each, every distractor tagged with the misconception it encodes, concept and Bloom tags: 4 recall / 9 understand / 7 apply; keys of all 12 numerical items recomputed by the engine in `tests/unit/inventory.test.ts`); `src/study/config/consent.json` (information sheet, consent statements, withdrawal and debrief text with explicit `[[PLACEHOLDERS]]`); `docs/STUDY-PROTOCOL.md`; `docs/DATA-DICTIONARY.md`; `analysis/` (`analysis.py`, `stats.py`, `simulate.py`, `validate.py`, `test_analysis.py`, pinned `requirements.txt`); `docs/RESULTS-SKELETON.md` generated from the n = 60 simulated run.
- **Validation:** pipeline produces all 16 tables and 6 figures without error at n = 30, 60, 120; every caption watermarked (checked by `validate.py`); 16 hand-worked statistical tests pass, including SUS polarity reversal, ANCOVA Type II SS equal to a by-hand nested-model comparison, partial vs. classical η², Hedges' g, Cronbach's α, Holm, Dunn, and the automatic switch to Kruskal–Wallis when Levene fails.
- **Independent verification (P8 items, done early):** assumption checks run *before* and determine the primary test (`run()` computes `checks` first; `primary` labels follow from it); partial η² uses SS_effect + SS_error, verified by hand; SUS polarity verified with five response patterns including acquiescence (all 5s → 50).
- **Human actions needed:** fill `[DECIDE]` items in the protocol and `[[PLACEHOLDERS]]` in consent; pilot and content-review the inventory (KNOWN-GAPS).

## 2026-10-12 — P3 complete
- **Shipped:** `src/core/npm/source.ts` (TraceSource over a store or an in-memory trace), `navigator.ts` (six-granularity stepping, backward stepping, jump, segment-bounded scanning), `breakpoints.ts` (kind, layer, epoch, NaN/∞, gradient above/below τ, weight sign change, loss plateau — each with a learner-facing reason), `state.ts` (state reconstruction at any cursor), `src/core/engine/protocol.ts` + `host.ts` + `src/ui/engine.worker.ts` (Web Worker boundary — the P1 SHOULD item, now delivered), trace statistics via `stats.ts` and the host's `statistics` op.
- **Evidence:** 206 TypeScript tests. For all 7 architectures × 6 granularities: one forward step per unit, landing on unit ends, identical over store and in-memory sources, backward stepping the exact inverse. State at every sample boundary of a CNN run, reconstructed while stepping back through a 30 kB cache (forcing recomputation), is identical to the full-trace state. Trace SHA-256 identical across repeated seeded runs (CI). Breakpoints: NaN caught with lr = 1e200; vanishing-gradient breakpoint fires on the deep sigmoid stack's first layer and not on a shallow tanh net.
- **Spec alignment:** NPM-SPEC §5.3/§5.4 rewritten to describe exactly the implemented semantics (mid-unit forward step completes the unit).
- **Time:** ~1 h.

## 2026-10-12 — P4 complete (review package)
- **Shipped:** vertical slice (React + Zustand; all computation in a Web Worker): Neural Execution View rendered only from the trace state (activation values printed and colour-coded, weight sign by colour *and* dash, magnitude by thickness, current instruction highlighted via its visual mapping, persistent text mode indicator FORWARD / BACKWARD / UPDATE with icon and border pattern); controls (six granularities, step back/forward, run/pause with speed, reset, scrubber, run-to-breakpoint, five breakpoint toggles); Explanation Module (KaTeX general and substituted formulas, sentence, simple/detailed); keyboard operation; text-equivalent state summary (aria-live). Two experiments end to end: single neuron (AND) and 2-4-1 MLP on XOR (defaults from a 480-run sweep, `reports/xor-sweep.json`).
- **Evidence documents (generated):** `docs/VALIDATION-REPORT.md`, `docs/TRACE-STATISTICS.md`, `figures/` (forward-pass, backward-pass, loss-curve, parity-overlay, vanishing-gradients — PDF + SVG + CSV each).
- **SHOULD delivered:** `docs/COMPARISON-MATRIX.md`, `docs/TASK-ANALYSIS.md` (DL-VizLab 9/12 answerable today vs 0–1/12 for Playground, CNN Explainer, GAN Lab), `docs/CURRICULUM-COVERAGE.md` (11/15 outcomes targeted). **COULD delivered:** vanishing-gradient figure (8-layer sigmoid: ~5 orders of magnitude decay; ReLU flat).
- **Tests:** 209 TypeScript (unit, gradcheck, parity, determinism), 4 Playwright e2e (incl. perf), 16 Python. Text/fill contrast ≥ 4.5:1 over the whole value range (tested).
- **Exit criteria:** public URL — *not met as specified*: the GitHub Pages workflow is ready but blocked by the push failure; a private Artifact URL exists, unverified in the viewer, and must be shared by the owner (KNOWN-GAPS). Two experiments ✓. Reports auto-generated ✓. Figures ✓. A4 ✓. Presenter summary ✓ (below).
- **For the presenter (2 November):** (1) the IR is the contribution: show `samples/xor-mlp.trace.json`, run `node tools/npm-verify.mjs` on it (an engine-independent program re-derives all 232 instructions) and `node tools/npm-replay.mjs … --granularity layer`; (2) correctness: `figures/parity-overlay.pdf` (TF.js and DL-VizLab losses coincide; deviations ~10⁻⁷) and the gradcheck table; (3) the app: XOR experiment, tick "back-propagation starts", "To breakpoint", step back and forward at layer granularity; (4) the study is designed and its analysis validated on simulated data (`docs/RESULTS-SKELETON.md`, clearly watermarked). Do not present simulated numbers as findings.
- **Next:** P5 (three views and explanation completion).
- **Time:** ~2.5 h.

## 2026-10-13 — P5 complete
- **Shipped:** View A extended: weights clickable and keyboard-focusable (up to 64 edges), dotted Δ overlays (width ∝ |Δ|) during weight updates, and an inspector giving every number the trace holds for the selected neuron (u, b, z, a, ∂ℓ/∂a, ∂ℓ/∂z, ∂ℓ/∂b, batch ḡ, with the full weighted sum) or weight (value, input, contribution, per-example and batch gradient, velocity, Δ, before → after). View B (`src/views/training/`): loss and accuracy per epoch (separate charts, crosshair readout, clickable to jump), gradient-magnitude-per-layer heatmap over epochs, weight and batch-gradient histograms per layer at the cursor, decision boundary with its 50 % contour for 2-D data, and a table view. View C (`src/views/structure/`): layer cards with shapes and parameter counts, expandable to the layer's internal steps with the current one marked, and edits (hidden layers, width, activation, learning rate, epochs) that regenerate the run and reset. Explanation Module: "what changed since the previous step" (`src/explain/diff.ts`); simple/detailed levels already present.
- **Trace additions (no new instruction kinds):** state reconstruction now reports the latest batch gradients, the latest evaluation and the completed-epoch count; `epochSummaries` reads View B's data from `EVAL_END`/`EPOCH_END`.
- **Evidence:** 147 unit tests (incl. views rendered server-side from `samples/xor-mlp.trace.json` through an in-memory source, with no engine object, at five cursors); 8 Playwright tests (incl. View B follows and moves the cursor, inspector, structure highlight, architectural edit + reset + restore). Chart series colours pass the palette validator in light and dark mode.
- **Exit criteria:** three views render from the trace alone and stay synchronised ✓; gradient-magnitude-by-layer view ✓; architectural editing resets cleanly ✓.
- **Also fixed:** `figures/loss-curve` no longer uses a dual y-axis.
- **Time:** ~1.5 h.

## 2026-10-13 — P6 complete
- **Shipped:** declarative curriculum (`src/experiments/types.ts`, `registry.ts`): 1 single neuron (learner-chosen starting weights), 2 activation functions, 3 forward propagation, 4 loss, 5 gradient descent, 6 back-propagation, 7 XOR, 8 CNN (listed, P7), D1 vanishing gradients, D2 learning-rate pathology. Each has objective, prerequisite, configuration, dataset, editable parameters (`edits.ts`), suggested breakpoints, default step size, a guided walkthrough with "Show me" actions, and 2 self-check questions with per-option feedback. Reusable panels (`src/views/panels/`): activation curve with the current z, MSE vs cross-entropy at the current ŷ, loss surface with the gradient-descent path, four learning rates side by side. Curriculum strip with locks and completion; walkthrough hide/resume persisted. Engine: `initialParams` (recorded as `initializer: 'given'`), worker ops `paramHistory` and `compareRuns`. Accuracy now depends on the output activation, not the loss.
- **Evidence:** every experiment is trained in `tests/unit/experiments.test.ts` and must show what its objective claims (e.g. XOR fails with 1 hidden unit; η = 1.1 diverges; D1 layer-1/output gradient ratio < 10⁻² and ReLU closes it by > 100×; D2 verdicts exactly too small / good / too large / divergent). Prerequisite and completion rules unit-tested; 3 new Playwright tests (locks lift after a correct self-check; walkthrough acts and resumes after reload; a chosen starting weight is used). 
- **Found and fixed:** the activation experiment diverged for the linear option at η = 0.5 (now 0.1); accuracy was missing for sigmoid outputs trained with MSE; the starting-weight slider regenerated on every key press and disabled itself (now debounced); learning-rate verdicts used an absolute threshold (now relative, ADR-022). Scientific notation now prints superscripts (1.13×10⁻⁷).
- **Exit criteria:** nine experiments end to end ✓ (CNN pending P7); prerequisites enforced ✓; walkthrough working and resumable ✓.
- **Time:** ~1.5 h.

## 2026-10-13 — P7 complete (CNN)
- **Shipped:** experiment 8, *A CNN on handwritten digits*: conv(4 filters, 3×3, ReLU) → 2×2 max-pool → flatten → dense softmax (3 classes), momentum 0.9, η = 0.05, batch 20, 3 epochs, on a reduced MNIST (digits 0/1/2, 500 train + 100 test per class, SHA-256-checked source, `docs/DATASETS.md`). Convolution View A (ADR-023): receptive field, kernels, animated sliding window (off under reduced motion), window dot product checked against the trace, feature maps forward and error maps backward, pooled maps, probabilities; clicking a feature-map cell focuses that unit. Kernel thumbnails in View C. Held-out test split recorded in `EVAL_END` and plotted in View B (ADR-025). Dataset code-split and loaded in the worker on demand (ADR-024).
- **Measured:** final epoch train accuracy 99.2 %, **test accuracy 97.0 %** (300 held-out images), test loss 0.139; whole-run generation 4.4 s in Node, 8–11 s in Chromium's worker (`reports/perf-cnn.json`); 125 791 instructions. The full trace would be ~729 MB as tensors; with batch checkpoints and LRU recomputation (ADR-010) resident memory stays ~64 MB.
- **Evidence:** CNN-on-MNIST architecture added to the TF.js parity suite and to the determinism suite (identical SHA-256 across runs); unit test requires ≥ 90 % held-out accuracy; Playwright `tests/e2e/cnn.spec.ts` (trains in the worker, kernels, window, feature maps from the trace). 251 unit tests, 12 Playwright tests pass.
- **Exit criteria:** CNN experiment end to end ✓; convolution and pooling visualised from the trace ✓; ten experiments available ✓.
- **Time:** ~1.5 h.

## 2026-10-13 — P8 complete (Study Mode)
- **Shipped:** Study Mode at `#study` (`src/study/`, ADR-026–029). Researcher screen: study id, three-condition or C1-vs-C3 design, stage time limits, one-shot manual override (recorded), loading the ethics-approved consent file (refuses to start while `[[PLACEHOLDERS]]` remain; validates structure), participant-flow counts, one-click ZIP export, delete-all. Participant flow: information sheet and per-statement opt-in → demographics (year, prior ML course, programming, familiarity) → allocation by stratified permuted blocks on familiarity → timed pre-test (20 items, randomised item and option order, no feedback, per-item latency, skip) → fixed-length intervention with countdown and automatic hand-over (C1 static pages generated from the tool, C2 TensorFlow Playground sheet with pre-configured task links, C3 the full tool with telemetry) → timed post-test (20 + 5 transfer items, new order) → SUS and raw NASA-TLX (C2, C3) → three open prompts → debrief with participant code. Withdraw on every screen after consent deletes the participant's data. Telemetry: 15 event types, 19 summary features (DATA-DICTIONARY). `npm run slides` regenerates the C1 material (42 walkthrough steps across the ten experiments, 99 screenshots from the running app, 2.8 MB, loaded only in C1).
- **Evidence:** 17 unit tests (`tests/unit/study.test.ts`): block balance per stratum, two-condition design, forms, SUS worked examples (same as the Python tests), raw TLX, recording off outside the session, every telemetry feature, CSV quoting, ZIP read back by Python, stage order per condition, time-out rows, withdrawal and refusal, **export columns identical to DATA-DICTIONARY.md in order**, no identifying columns or network calls, and a 38-participant export driven through the real store and analysed by `analysis/analysis.py`. Playwright `study.spec.ts`: all three conditions end to end in the browser, a withdrawal and a refusal, export downloaded and read with pandas (5 rows, 135 responses, 2 SUS, 2 TLX, C3 telemetry with steps, back-steps and explanation opens). Simulated-data validation re-run at n = 30/60/120 — all tables and figures produced.
- **Hostile re-check of the statistics (brief P8):** the parametric/non-parametric choice is made before either test runs (`test_assumption_failure_selects_the_nonparametric_test_before_testing`); partial η² uses SS_effect / (SS_effect + SS_error) of the covariate-adjusted model (worked example test); SUS polarity reversal checked on five hand-scored response patterns in both Python and TypeScript.
- **Found and fixed:** "What changed" listed all 784 pixels of an MNIST input (now size and range); `results.json` could contain bare `NaN` or fail on numpy booleans (now strict JSON, regression test); pooled CNN map labels wrapped.
- **Exit criteria:** full protocol runs end to end for all three conditions ✓ (automated); valid CSVs exported and data dictionary complete ✓; pipeline validated on simulated data at three sizes ✓ (and on a Study Mode export); zero PII ✓ (anonymous codes only, no identifying columns, no network access, free-text feedback flagged for screening).
- **Not yet done:** a pilot with people (KNOWN-GAPS).

## 2026-10-13 — P9 (export, polish, release)
- **Shipped:**
  - Figure export (ADR-030): the standard set from any trace, built once and used in the app's worker and in the batch CLI (`npm run figures:batch`). Vector SVG, PDF (browser print / headless Chromium), CSV of plotted numbers, colour/greyscale/high-contrast modes and editable captions. Examples are in `figures/standard/`.
  - Pathology catalogue: two new detectors, dead ReLU (whole-epoch zero bias gradient) and learning-rate divergence (epoch loss up > 10 %). All five pathologies are produced in real runs and checked against healthy controls (`docs/PATHOLOGIES.md`).
  - WCAG 2.1 AA audit (axe-core on 19 screens, plus a manual criterion review in `docs/ACCESSIBILITY.md`), with nine fixes.
  - Colour-vision test (Machado 2009). It found the backward/update mode colours indistinguishable for deuteranopes; the update colour is now amber.
  - CNN performance test, with the budgets table generated into VALIDATION-REPORT.
  - View A now grows and scrolls for deep networks (ADR-031); the overlap was found while exporting D1.
  - README, LICENSE (MIT), CITATION.cff, version 1.0.0, PAPER-NOTES and DEFINITION-OF-DONE.
- **Found and fixed:** overlapping deep-network diagram; non-keyboard feature-map picking; diagram roles hiding focusable children; kernel text contrast; missing skip link; TLX slider value not recordable at its start value; CI lacking Python dependencies.
- **Tried and rejected:** cooperative (yielding) trace generation to lower peak memory — no measurable effect, reverted.
- **Exit criteria (Part D):** see `docs/DEFINITION-OF-DONE.md`. Everything is met except (a) the live demo, which waits for the owner to enable GitHub Pages; (b) the release tag and DOI, which follow the merge. CI is green (check, e2e on Chromium and Firefox, analysis).

## 2026-10-19 — Fix Round 1

Status per item: **done**, **partly done** (with the reason) or **not done** (with the reason).

### Batch A — concept inventory and study protocol
- **A1 done.**
  - CI11's −0.4 distractor is relabelled: it computes the step with the wrong sign (η·∂L/∂w) and replaces the weight with it instead of adding.
  - Every computational distractor was re-derived. One more label was wrong: TR03 "9" is one kernel's weights, not "filters share one kernel". The TR03 "6 272" label was also made precise.
  - Tests: every `check` field is recomputed and matched to the keyed answer's text (including CI16's sequence), and every computational distractor equals the value its error produces (`tests/unit/inventory.test.ts`).
- **A2 done.**
  - The shuffle is uniform: 20 000 simulated participants, per-item χ² with Bonferroni correction plus a pooled χ² (ADR-033).
  - Different participants get different option orders.
  - Scoring goes through the UI's display→canonical mapping: always correct gives 100 %, a fixed distractor 0 %, always the first position about 25 %.
  - Reviewer copy with shuffled options and an answer key: `analysis/output/concept-inventory-review.md` (`analysis/inventory_review.py`).
- **A3 done.**
  - `docs/INVENTORY-COVERAGE.md` maps every item to C1, C2 and C3 teaching sources.
  - CI18 (overfitting) and TR05 (symmetric initialisation) are retired: IDs kept, `"retired": true` with a reason, neither administered nor scored.
  - TR04 is kept, with batch-size content added to the gradient-descent walkthrough (C1, C3) and the C2 Playground sheet (ADR-032).
- **A4 done.**
  - `cluster` field on every item. Clusters: fundamentals 7, optimisation 5, backpropagation 5, convolutional 3.
  - New item CI21 (weight sharing, with a verified `check`), so the convolutional cluster reaches three items and the pre-test stays at 20 items. The post-test is now 24 items: 20 core plus 4 transfer.
  - The pipeline reports gains by cluster (T09/F5) and by Bloom level (T10/F6) as primary, and per-concept gains as the exploratory appendix T17 with item counts.
  - LIMITATIONS, DATA-DICTIONARY, STUDY-PROTOCOL and the draft consent text updated.
- **A5 done.** STUDY-PROTOCOL §9a records the base paper's ICMR exemption precedent, why this study falls within the same clause, the requirement for a written institutional determination, and a draft manuscript paragraph with `[[APPROVAL REFERENCE]]`. Consent and information placeholders are untouched.
- **A6 partly done.** The SUS grade cut-offs now cite Sauro & Lewis (2016, ch. 8) and match a published reproduction of that table. The Bangor, Kortum & Miller (2009) adjective means could **not** be read from the primary source: the journal and every mirror were blocked by the build environment's network policy. The code and DATA-DICTIONARY now state that the paper gives means, not cut-offs. The KNOWN-GAPS entry is narrowed, not removed.

### Batch B — review package
- **B1 done.** The parity table prints final losses at full precision. The MNIST case is 1.288356e-11 in float64 and exactly 0 in TF.js float32. It is explained from a reproducible measurement (`scripts/measure-mnist-fit.ts`, `reports/mnist-fit.json`): 60 training images fitted perfectly (median log-probability margin 26.6 nats), with 50 of 60 per-example losses below float32 resolution. The caption explains why it is not a formatting artefact.
- **B2 partly done.** Not measured: this environment ships only Chromium and does not permit installing browsers. The reason is now stated in the table rows; PAPER-NOTES §4 has the ten-minute command sequence; a WebKit Playwright project was added.
- **B3 partly done.** NeuroViz verified from excerpts of the arXiv paper: scope, before/after update view, per-neuron equations, n = 31 and SUS 80.97, and the §7 future work. The author order in the brief was corrected. The paper's full text, neuroviz.org and the other tools' sites were unreachable from the build environment. Every comparison cell now carries its source (paper, inference or to-check), and PAPER-NOTES §8 records the status and the ten-minute check.
- **B4 partly done.** `docs/COMPARISON-MATRIX.md` is recoded Y/N/L with the base paper's legend, and NeuroViz's future work is mapped explicitly. The base paper was not accessible, so its eight Table 5 feature names are not copied; the document says so. `docs/THEORY-MAPPING.md` is done (constructivist; cognitive load with split attention and worked examples; experiential).
- **B5 done.** `docs/ARCHITECTURE-LINEAGE.md`: component mapping, automatic granularity and extensibility. Quotations are from the brief's summary of the base paper, flagged for checking.
- **B6 done.** Accessibility is now worded as "designed to WCAG 2.1 AA, axe-core zero violations on 19 screens plus manual review, not validated with screen-reader users" in VALIDATION-REPORT, DEFINITION-OF-DONE, ACCESSIBILITY and PAPER-NOTES (with manuscript wording). It is also a paper-facing item in LIMITATIONS.
- **B7 done.** Palette re-stepped by constrained search (ADR-034): every meaningful pair is now ΔE ≥ 15 under protanopia and deuteranopia (worst 16.1, previously 9.2). Series palettes still pass the dataviz validator, and text contrast is kept. The trade-offs (dark-theme slots changed together, crimson rejected) are recorded.
- **B8 done.** CITATION.cff lists the five authors (Swaminathan J marked `[[CONFIRM WITH GUIDE]]`, ORCIDs empty). The version is 0.9.0 in CITATION.cff, package.json, the lockfile and the README citation. PAPER-NOTES §7 covers v0.9.0 for review, v1.0.0 at submission, and Zenodo before the first tag.

### Batch C — before submission
- **C1 done.** TensorFlow Playground is vendored at commit `02469bd` into `public/playground/` by `scripts/vendor-playground.sh`. Two documented modifications: analytics stubbed, fonts local. LICENSE and NOTICE are kept, and `docs/THIRD-PARTY.md` added. C2 uses the local copy by default (`playground_source` switch for the hosted site). `tests/e2e/playground.spec.ts` shows it trains with every external request blocked.
- **C2 done.** `analysis/merge_exports.py` validates columns against the data dictionary, refuses participant-code collisions, stray rows and mixed simulated/real data, then concatenates the seven files with a row-level manifest. `analysis/test_merge.py` uses three simulated machines (zip and folder bundles), a deliberate collision and a deliberate column mismatch, and runs the pipeline on the merged export. It runs in CI.
- **C3 partly done.**
  - The suggested route (scratch buffers in im2col/scatter paths) does not exist in this engine: the convolution kernels allocate only trace-visible outputs.
  - The one non-trace per-example allocation, batch-gradient accumulation, is now done in place. Traces are byte-identical: trace hashes and parity and determinism records unchanged.
  - Measured peak tab RSS: 537–538 MB before, 519–532 MB after (three runs each); live memory unchanged at 81 MB. Kept, but the peak remains about 5 % above budget (ADR-035, KNOWN-GAPS).
- **C4 done.**
  - VALIDATION-REPORT, TRACE-STATISTICS and the NPM-SPEC tables are regenerated. `measure-engine`, `gen-trace-stats` and `gen-figures` had not registered the MNIST asset since P7, so the trace statistics and engine table had been stale since the CNN was added; this is fixed.
  - Analysis validation re-run at n = 30 / 60 / 120 with the new inventory; RESULTS-SKELETON regenerated.
  - C1 slides, example figures and README screenshots regenerated with the new palette.
  - DEFINITION-OF-DONE re-checked item by item: item 3 is now "mostly met" because of the memory peak.

### Not done by instruction
No release tag and no Pages deployment (the team's actions); no change to gradient rules, parity tolerances or determinism tests; consent placeholders untouched.

## 2026-10-19 — Fix Round 1 Supplement
- **S1 (NeuroViz citation).** Sharma, T. & Rawassizadeh, R. is used everywhere. PAPER-NOTES records that the order was verified against the authors' own BU lab listing, and tells the team to correct reference [4] in the Phase II Design and Solution document.
- **S2 (SUS).**
  - `stats.py` keeps two labelled schemes: the nearest Bangor et al. (2009) adjective anchor (means, not bands) and the Sauro & Lewis curved grade. DATA-DICTIONARY documents both, and the T11 note distinguishes them (ADR-036).
  - The KNOWN-GAPS entry is resolved, with a caveat that Table 3 still needs a spot-check.
- **S3 (base paper).**
  - COMPARISON-MATRIX now starts with Table 5's eight rows in the paper's order and wording, then the DL-specific rows. Columns are DL-VizLab, TF Playground, CNN Explainer, GAN Lab and NeuroViz, with Y/N/L throughout. The IDE (N) and extension (L) rows that carry the contribution argument are stated.
  - THEORY-MAPPING is rebuilt in Table 1's exact three-column form, including the split-attention and worked-example effects.
  - The two verified quotations are in ARCHITECTURE-LINEAGE and STUDY-PROTOCOL.
  - PAPER-NOTES §5a records the base paper's evaluation as the baseline this study improves on.
- **S4.1 (TR04).** Kept, with real coverage (ADR-037).
  - Experiment 5 gains an editable batch size and two walkthrough steps: B = 5 gives 10 updates per epoch on a visibly wobblier path. They use a new `edit` walkthrough action.
  - Self-check gd3 added; C1 slides regenerated.
  - A unit test asserts the effect: 10 vs 1 updates per epoch; tortuosity 1.39 vs 1.03; mean consecutive-step cosine −0.17 vs 0.95.
- **S4.2 (CI21).**
  - Its three distractors are rows of the distractor-derivation table in `tests/unit/inventory.test.ts`, and each is recomputed from its misconception: 676 = 26² output positions, 6 084 = 676 × 9 (one kernel per position), 784 = 28² input pixels.
  - It appears in the shuffled faculty review copy (`analysis/output/concept-inventory-review.md`).
- **S4.3 (matched scale).**
  - `analysis.py` scores pre, post, gain and α on the 20 matched core items (`MATCHED`). The four transfer items are a separate post-only outcome, with no α computed.
  - `analysis/test_analysis.py::MatchedScale` asserts this.
  - RESULTS-SKELETON states it under **Scales**.
- **S4.4 (palette).** New `scripts/gen-palette-sheet.ts` writes `figures/palette-sheet.pdf` (93 pages, A3).
  - Every experiment's central views in light and dark, at the end of a forward pass and one layer into a backward pass, from halfway through the run.
  - Each is shown as rendered and with protanopia and deuteranopia simulated by the same Machado matrices as `cvd.test.ts`.
  - It is for the team to look at; no one has signed it off yet.
- **S5 (stale generated files).** New CI job `generated` (ADR-038).
  - It re-runs every deterministic producer of a committed report or document and fails on a dirty tree.
  - Dates were removed from generated headers, trace timings moved to `reports/trace-timing.json` (written by `npm run measure`), and matplotlib output is byte-stable.
  - Building the check found a second stale pair: VALIDATION-REPORT showed 527 MB peak, but the committed `perf-cnn.json` held a contended 679 MB from a parallel e2e run.
  - `npm run measure` was re-run. Four solo runs gave 525–543 MB. The range is now documented as 519–543 MB (5–9 % over budget) in KNOWN-GAPS and DEFINITION-OF-DONE.
- **S6.** `package.json` and the lockfile root both read 0.9.0. `git diff 51f1358 -- package-lock.json` (the last green commit before the bump) shows only the two root version lines, so no transitive dependency is altered.

## 2026-10-19 — Fix Round 2: novice path redesign (30 October boundary)

Status against the brief's Part 5 list for 30 October: **all done.** Status of the Part 7 carried-over items: **all done.** The November–December items are not started, as the brief sequences them.

**30 October items**
- **Three bugs fixed (§3)** — done (ADR-040, ADR-041):
  - The verbosity toggle now changes the output for every instruction.
  - Illumination is a tested contract: whole-network events, every CNN stage, and bias versus weights.
  - The architecture editor renders only where declared: experiments 3, 6, 7 and D1.
- **Control audit (§3.4)** — done (`docs/CONTROL-AUDIT.md`, `tests/e2e/controls.spec.ts`, ADR-044):
  - **214 controls audited** for an observable change. Step and breakpoint controls are compared with the engine's own navigator on an oracle trace.
  - **Seven defects found; six fixed, one reported:**
    1. The verbosity toggle had no effect for most instructions.
    2. Illumination was missing for network-level events and in the CNN view, and bias updates lit the weights.
    3. The architecture editor appeared on experiments where it is meaningless.
    4. Experiment 5's walkthrough promised a NaN stop that never happens (text corrected, claim tested).
    5. The NaN/∞ breakpoint is unreachable from any shipped control (reported, not changed).
    6. Undeclared step sizes could be selected from the keyboard.
    7. The running caption used inconsistent number formats.
  - Two defects introduced by the redesign were caught before commit: AA contrast of the secondary step label, and the chain-rule panel's stale weight after an update.
- **Two-path architecture** — done (ADR-039):
  - The novice path is the default; expert mode is the unchanged workbench.
  - Switching preserves the trace position in both directions (tested).
  - The mode is remembered in `localStorage` with try/catch, and `?mode=` overrides it.
  - Study Mode pins `c3StartMode` (default novice).
- **Experiments 1, 5 and 6 rebuilt** — done (`src/ui/novice/`). Each follows the seven-part template with a prediction:
  - **1:** raising the bias moves all four outputs.
  - **5:** learning rate, then batch size as the second control.
  - **6:** one path through the chain rule; the factors' product is checked against the engine's gradient (`tests/unit/novice.test.ts`).
- **Granularity unlocking for those three** — done: the brief's table, declared per experiment (`src/experiments/surface.ts`). `tests/unit/surface.test.ts` checks every experiment.
- **Vocabulary gating** — done: `src/experiments/vocabulary.ts`. `tests/unit/vocabulary.test.ts` renders each rebuilt screen and checks its narration at every step of two epochs.
- **DESIGN-SCOPE.md and the redesign ADR** — done (DESIGN-SCOPE, ADR-039 to ADR-045).
- **Green** — done. The redesign is a presentation layer:
  - format, typecheck, lint, 351 unit tests, Python tests and build pass;
  - the e2e suite passes (39 Chromium specs locally; Firefox runs in CI);
  - every pre-existing test still passes, with the workbench specs now opening `?mode=expert`;
  - no engine, IR, trace, schema or validation-evidence change, and no `Math.random`.

**Study and documentation consequences (Part 4)**
- **Telemetry** — done:
  - Events `mode`, `deeper`, `predict` and `reveal`; `experiment_start` now carries the mode and the offered step sizes.
  - Ten new summary features.
  - Both are in DATA-DICTIONARY and the export. The simulator draws them from a separate stream, so earlier simulated values are unchanged.
  - Analysis T13/T14 include them, with pairwise deletion for prediction accuracy.
- **Intervention timing** — done as estimates: per-experiment minimum-path durations from a stated model (STUDY-PROTOCOL §5a), ≈ 28 min for all ten, flagged for the pilot. The time limits were already configuration values.
- **Inventory coverage** — done: every C3 item re-verified item by item on the novice path (INVENTORY-COVERAGE). None orphaned; CI11 needed the experiment 5 narration to state the update with its numbers, so the screen changed, not the item.
- **Documents** — done: THEORY-MAPPING, DESIGN-SCOPE (new), LIMITATIONS, DECISIONS, PAPER-NOTES §4a (provenance and framing), DATA-DICTIONARY, CURRICULUM-COVERAGE, KNOWN-GAPS and README updated.
- **Accessibility** — done for the new screens: axe-core on 45 screens with zero violations, including the 26 novice-path audits in both themes, before and after a prediction with every "going deeper" item open.
- **C1 regeneration** — **not done, as scheduled for November–December.** C1 still mirrors the workbench walkthroughs. STUDY-PROTOCOL §5a, LIMITATIONS and ADR-043 say it must be regenerated before any participant session.

**Carried over (Part 7)**
- **7.1** — done: `figures/palette-summary.pdf`, 2 pages. The 93-page sheet is kept as the backup, and PAPER-NOTES §6 says which is which.
- **7.2** — confirmed: all seven runs (519–543 MB) used one protocol, the perf test running alone. A stale "456–544 MB" in PAPER-NOTES was corrected.
- **7.3** — done: the SUS convention sentence is in PAPER-NOTES §5a.
- **7.4** — confirmed serialisation-only, with a unit test.

**Not done (scheduled November–December by the brief)**
- Novice screens for experiments 2, 3, 4, 7, 8, D1 and D2. They show the filtered workbench with a note.
- C1 regeneration and parity re-verification.
- The accessibility re-audit of those future screens.

## Fix Round 2b — 2026-10-20 — Contracts after state changes; invariants A–E; cold review

**Defects found by hand: all three fixed**
- **Defect 1, no way to set a new layer's weights.** Fixed with the *Starting weights and biases* editor, which follows the current model (ADR-046). e2e: add a layer, edit `L2.W[1,1]`, and the regenerated trace starts from it.
- **Defect 2, the inspector was not bound to the selection.** Fixed: every value is computed for the selected element and tagged with it, and the instructions that produced and used it are listed (ADR-047). The CNN cell's bias and kernel indexing is fixed too.
- **Defect 3, no reset.** Fixed: *↺ Reset experiment* on every screen, in both modes (ADR-048). The old cursor-only "⏮ Reset" is renamed "⏮ Start".

**Invariants: 5 added, as properties**
- **A to D:** `tests/unit/invariants.test.ts`, 46 property tests plus 3 fault-injection tests.
- **E:** `tests/fuzz/fuzz.test.ts`, its own CI job. The replay test is `tests/unit/fuzz-regressions.test.ts`.

**Controls audited**
- 116 distinct control ids, at 60 `data-control` sites.
- 958 declared (screen, control) entries over the 20 screens.

**Defects found per invariant**

| Invariant | Found | Note |
|---|---|---|
| A | 0 | It caught the injected defect 3. Building it exposed a harness defect: static renders showed the store's initial state, so the Fix Round 2 vocabulary test's screen half had checked empty screens. Fixed (ADR-050), and that test re-run on real screens; it passes. |
| B | 0 | It caught the injected defect 1. |
| C | 0 | It caught the injected defect 2. The CNN half of defect 2 was found while writing C's expected values. |
| D | 0 | |
| E | 0 failing sequences in 2,000 (12,000 actions) | It caught an injected reset mutation; that sequence is kept as a regression case. |

**Cold review**
- **Setup:** an agent with no view of the code received `docs/NOVICE-DESIGN.md` (new) and 46 screenshots (`scripts/cold-review-shots.ts`).
- **Findings:** 220 points (first reported as 218; corrected in Fix Round 2c); every one has a response in `docs/COLD-REVIEW.md`.
  - 28 are fixed, including experiment 6's chain-rule factors, which the default step size stepped past (the reviewer's top problem), and epoch and learning-rate selects that showed and applied a value different from the run's.
  - 67 are scheduled with the seven purpose-built screens.
  - 84 are logged as KG-R2b-1 to KG-R2b-7 (first reported as 82).

**Gates**
- Format, typecheck and lint pass.
- 328 unit tests, 48 gradcheck, 8 parity and 18 determinism tests pass, as do 26 Python tests and the build.
- e2e passes: 44 Chromium tests locally (Firefox runs in CI).
- axe reports 0 violations on 47 screens.
- The generated documents are current, and the fuzz suite passes (15 min).
- No engine, IR, trace format, schema, gradient rule, tolerance or validation-evidence change, and no `Math.random`.

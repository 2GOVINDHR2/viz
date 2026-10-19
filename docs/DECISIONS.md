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

## ADR-010 — 2026-10-12 — Two instruction kinds added to the brief's list
- **Context:** The brief's instruction list has no kind for the gradient through a flatten, nor for averaging per-sample gradients over a batch.
- **Options:** (a) fold them silently into neighbouring instructions; (b) add `GRAD_FLATTEN` and `GRAD_ACCUMULATE`.
- **Decision:** (b). Folding would leave values in the trace that no instruction produces, breaking dataflow completeness, which the independent verifier relies on.
- **Consequence:** 30 built-in kinds. Every one is emitted, schema-validated and explained.

## ADR-011 — 2026-10-12 — Memory bounding by batch-level checkpoints and LRU recomputation
- **Context:** Full traces of CNN runs reach hundreds of MiB.
- **Options:** (a) store everything; (b) store epoch checkpoints only; (c) batch-level checkpoints + LRU cache of materialised segments.
- **Decision:** (c). Batch checkpoints are nearly free (immutable tensors are shared by reference) and bound recomputation to one batch.
- **Consequence:** Measured: 1–6 % of full-trace memory resident at 1–5 % budgets, ~1–2.5 ms per random jump, microseconds per sequential back-step (NPM-SPEC §9).

## ADR-012 — 2026-10-12 — Explanations are generated, deterministic and offline
- **Context:** B3 forbids network calls; P5 asks for this to be stated as a decision.
- **Decision:** Explanations are pure functions of an instruction and the values it references (registration point 3). No LLM, no templates per experiment.
- **Consequence:** Every explanation is faithful by construction: the substituted formula ends with the instruction's own result, which a test checks. The cost is less conversational prose; the gain is that a learner can never be told something the computation did not do.

## ADR-013 — 2026-10-12 — Extension layers via `{ type: 'extension', kind }`
- **Context:** Adding an operation that is a new layer needs a way to appear in a model configuration without editing the built-in layer union.
- **Decision:** A layer registry (`registerLayer`) consulted for `type: 'extension'` configs, counted as part of registration point 2 in NPM-SPEC §7.
- **Consequence:** The LayerNorm tutorial adds a working layer without touching any existing file.

## ADR-014 — 2026-10-12 — Analysis pipeline in Python
- **Context:** The brief allows R and/or Python. R is not available in the build environment, so an R pipeline could not be validated here.
- **Decision:** Python (scipy, statsmodels, matplotlib) with pinned versions in `analysis/requirements.txt`; CI runs the hand-worked unit tests and the n = 30/60/120 validation.
- **Consequence:** One validated pipeline. An R port is listed in FUTURE-WORK for reviewers who prefer R.

## ADR-015 — 2026-10-12 — Export file set
- **Context:** P8 lists five CSVs; raw telemetry events and open-ended feedback also need exporting.
- **Decision:** `telemetry.csv` holds the per-participant summary (analysis-ready); raw events go to `telemetry_events.csv`; open-ended answers to `feedback.csv`. A `SIMULATED` marker file in an export directory forces watermarking and is never written by Study Mode.
- **Consequence:** The five named files are exactly as specified and tidy; nothing is lost. Defined in `docs/DATA-DICTIONARY.md`.

## ADR-016 — 2026-10-12 — Primary-test selection rule
- **Decision:** ANCOVA is primary only if residual normality (Shapiro–Wilk), homogeneity of residual variance (Levene) and homogeneity of regression slopes all have p ≥ .05; otherwise Kruskal–Wallis on gain scores with Dunn/Holm is primary. Both are always reported, labelled primary/sensitivity. The rule is fixed in code before data exist.
- **Consequence:** No analyst discretion after seeing outcomes. Shapiro–Wilk is very sensitive at large n; this conservatism is accepted and noted in LIMITATIONS.

## ADR-017 — 2026-10-13 — View B shows only what has happened up to the cursor
- **Context:** The whole run is generated before navigation starts, so View B could show the final loss curve from the outset.
- **Decision:** View B draws epochs whose `EPOCH_END` is at or before the cursor, and the decision boundary from the most recent `EVAL_END` at or before it. The x-axis is fixed to the full run so charts grow rather than rescale.
- **Consequence:** View B stays consistent with Views A and C (all three show the state at the cursor), and stepping back visibly "un-trains" the network.

## ADR-018 — 2026-10-13 — Gradient magnitude per layer as a heatmap
- **Context:** The gradient-magnitude-over-epochs view must scale to deep stacks (the vanishing-gradient experiment), and one line per layer exceeds a safe categorical palette beyond 3–4 series.
- **Decision:** Layers × epochs heatmap, single-hue sequential scale on log₁₀ of the mean weight-gradient norm, values in per-cell tooltips and in a table view. Loss and accuracy are separate charts, never one chart with two y-axes.
- **Consequence:** Any depth fits; vanishing gradients read as a pale top row under a dark bottom row.

## ADR-019 — 2026-10-13 — Architectural edits are limited to dense hidden layers, learning rate and epochs
- **Decision:** The Structure View edits hidden-layer count, width and activation, the learning rate and the epoch count. The output layer and loss are fixed so the activation/loss pairing (ADR-007) cannot be broken from the UI. Applying an edit regenerates the trace and resets the cursor.
- **Consequence:** Edits are always valid configurations; CNN architecture editing is deferred (FUTURE-WORK).

## ADR-020 — 2026-10-13 — Completion and prerequisites
- **Context:** P6 requires enforced prerequisite ordering, which needs a definition of "completed".
- **Decision:** An experiment is completed when every self-check question has been answered correctly; its successors unlock then. Progress (completion, walkthrough position, answers) is kept in `localStorage`, guarded so the app works without storage. There is no instructor bypass in the UI; Study Mode (P8) controls access separately.
- **Consequence:** Order is enforced without a server. Clearing site data resets progress.

## ADR-021 — 2026-10-13 — Experiment panels draw formula curves from their definitions
- **Context:** Some experiments need visuals the trace does not hold: the shape of an activation or loss function, and the loss surface of a two-parameter model.
- **Decision:** Panels draw these from their mathematical definitions (and, for the surface, from the dataset recorded in the trace header, in closed form). Everything about the run — the current z, ŷ, y, the parameter path — comes from the trace. The learning-rate comparison trains four real runs in the worker.
- **Consequence:** No fabricated values; the panels label which parts are formula curves.

## ADR-022 — 2026-10-13 — Learning-rate verdicts are relative and use the weight path
- **Context:** A fixed threshold on loss reduction mislabelled a too-small rate as good, and on a convex problem the evaluation loss can fall monotonically even while the parameters overshoot.
- **Decision:** `lrVerdict` labels a run divergent if its loss grows or becomes non-finite; too large if more than 30 % of consecutive weight changes flip sign; too small if its final loss is at least 10× the best run's; good otherwise. Tested on D2's four rates.

## ADR-023 — 2026-10-13 — CNNs get their own View A; kernels also appear in View C
- **Context:** A node-and-edge diagram of a 28×28 → 4×26×26 convolution has 676 output units per channel and shared weights, so drawing edges hides exactly what convolution is about (one small kernel slid everywhere).
- **Decision:** When the model contains a `conv2d` layer, View A is a dedicated convolution view (`src/views/execution/ConvView.tsx`): input image with the receptive field, every kernel as a value grid, the sliding-window dot product recomputed from the trace's input and kernel and shown beside the trace's own `u`, per-channel feature maps (furthest computed stage in the forward pass, ∂ℓ/∂z in the backward pass), pooled maps and class probabilities. View C shows kernel thumbnails on conv layer cards. Dense-only models keep the node-and-edge view.
- **Consequence:** Weight sharing is visible directly. The dense layer after flattening is summarised by the probabilities rather than drawn edge by edge (432 × 3 edges).

## ADR-024 — 2026-10-13 — Bundled data assets are code-split and registered in the worker
- **Decision:** Large datasets are TypeScript modules imported dynamically by the worker only when a `DatasetSpec` of kind `asset` names them, then registered with `registerAsset`. The core engine knows only the registry, not the files.
- **Consequence:** The reduced MNIST (1.9 MB) costs nothing for learners who never open the CNN experiment; the app stays fully offline. `src/core` remains free of I/O.

## ADR-025 — 2026-10-13 — Held-out test split, recorded in EVAL_END
- **Context:** Accuracy on training images says nothing about generalisation; MNIST ships with an official test split.
- **Decision:** `Dataset.test` is optional. When present, `EVAL_END` additionally records `testLoss`, `testAccuracy` and `meta.testN`; View B plots the test series beside the training series and lists both in its table. The 2-D synthetic datasets have no test split yet (O13, FUTURE-WORK).
- **Consequence:** No new instruction kind; existing traces remain valid (the fields are optional in the schema).

## ADR-026 — 2026-10-13 — Study Mode is a separate entry in the same build, local-first, exported as one ZIP
- **Context:** The study must run on lab machines with no server, never record identifying data, and leave the researcher one action to collect the data.
- **Decision:** Study Mode lives at `#study` in the same static build, loaded as its own chunk. All records are kept in `localStorage` on the study machine (saved on every stage change and at most 0.5 s after an interaction) and leave it only through the researcher's **Export** button, which writes one ZIP (a dependency-free stored ZIP writer, checked against Python's `zipfile`) of the CSV files in `docs/DATA-DICTIONARY.md`. Participant codes come from `crypto.getRandomValues`; item and option orders from the seeded PRNG with a cryptographic seed. No network request is made by Study Mode.
- **Consequence:** Nothing to install or host; data never leave the machine unless exported. A cleared browser profile loses unexported data, so the researcher screen tells the researcher to export after each session block and warns when storage is blocked.

## ADR-027 — 2026-10-13 — The C1 slides are generated from the tool, not authored separately
- **Context:** The protocol holds content constant across conditions; hand-written slides would drift from the tool's content.
- **Decision:** `scripts/gen-slides.ts` opens every experiment in the built app, performs each walkthrough step's "Show me" action and captures the main view, the explanation and any panel. C1 renders each experiment's own objective, walkthrough text, those screenshots, and the self-check questions with their correct answers. C2's sheet points to the same CNN pages because Playground cannot show convolution.
- **Consequence:** C1 = C3's guided content minus interactivity. Regenerate with `npm run slides` whenever an experiment or view changes. C1 sees self-check answers (C3 learners get the same feedback after answering); this is reported.

## ADR-028 — 2026-10-13 — Telemetry by wrapping store actions; definitions fixed in the data dictionary
- **Decision:** In C3 the tool's store actions are wrapped so each user action records an event (`src/study/instrument.ts`); panel switches are detected from pointer and focus moves between labelled panels. Recording is off everywhere except the C3 intervention stage. Event details hold only enumerated values and numbers. Automatic steps while *Run* plays are not counted as steps.
- **Consequence:** No telemetry code inside the views; the summary features are computed at export from the raw events, which are exported too, so any feature can be recomputed differently later.

## ADR-029 — 2026-10-13 — Withdrawal deletes data but keeps the allocation row
- **Decision:** Withdrawing deletes demographics, responses, durations, questionnaires, telemetry and feedback at once; the participant row keeps `condition`, `assignment`, `stratum` and the flags so the CONSORT diagram can show withdrawals per arm. Declining consent leaves a row with `consented = 0` only.
- **Consequence:** Withdrawals are counted per arm without retaining any of the participant's answers.

## ADR-030 — 2026-10-13 — One set of figure builders for in-app and batch export; PDF through Chromium's printer
- **Context:** P9 requires SVG and PDF from every view, vector with embedded fonts, greyscale and high-contrast modes, captions, a CSV beside every figure, and a batch export of the standard set from any trace. A browser-side PDF library would add a dependency and, without embedding a font file, would fall back to the standard PDF fonts (not embedded).
- **Decision:** `src/export/figures.ts` builds every figure (architecture, forward/backward snapshot, loss curve, gradient magnitude by layer, decision-boundary evolution, convolution feature maps) as a standalone SVG plus the CSV of exactly the numbers it draws, from a trace source alone. Snapshots reuse the app's own Neural Execution View, rendered with `react-dom/server`. In the app the builders run inside the worker next to the full trace (`op: 'figures'`, loaded on first use); SVG and CSV download directly and **PDF goes through the browser's print-to-PDF** of a figure-only page sized to the figure, which keeps it vector and embeds the fonts. `scripts/export-figures.ts` (`npm run figures:batch`) produces the same set from any trace file or experiment, with PDFs printed by headless Chromium. Print modes are parameters of the builders, not a filter: greyscale and high contrast contain no hue (tested); sign is carried by dash patterns on edges and a diagonal stroke on negative cells.
- **Deviation:** in-app PDF needs one click in the print dialog rather than a direct download; the batch tool writes PDFs directly.
- **Consequence:** One code path; every figure is traceable to its CSV; no new runtime dependency.

## ADR-031 — 2026-10-13 — The Neural Execution View grows with the network and scrolls
- **Context:** Exporting D1's eight-layer network showed that View A placed ten columns in a fixed 760-unit drawing, so headings, bias labels and neurons overlapped (in the app too).
- **Decision:** The drawing is at least 150 units per column and 74 per neuron row; beyond the default size the SVG keeps a minimum on-screen width and the panel scrolls horizontally. With more than four columns, the activation name moves to a second heading line.
- **Consequence:** Deep networks stay legible at 1280×720; small networks are unchanged.

## ADR-032 — 2026-10-19 — Concept inventory: two items retired, one added, clusters as the reporting unit (Fix Round 1, A3/A4)
- **Context:** Every item was checked against what each condition teaches (`docs/INVENTORY-COVERAGE.md`).
  - CI18 (overfitting) is taught only by C2's Playground loss task.
  - TR05 (symmetric initialisation) is taught in no condition.
  - TR04 (batch size) is taught by C3's mini-batch explanations only.
  - Eleven concepts over 20 items left four concepts with a single item, so per-concept gains would be noise.
- **Decision:**
  - **CI18 is retired rather than taught.** Teaching it would need a new generalisation experiment (synthetic held-out splits) *and* two more overfitting items to form a reportable cluster, lengthening the tests beyond the protocol's 20 items. The brief also bars new features in this round.
  - **TR05 is retired.** Retired items keep their IDs, carry `"retired": true` with a reason, and are neither administered nor scored. The pipeline drops responses to them from any older export.
  - **TR04 is kept** and its content added cheaply: one sentence in the gradient-descent walkthrough (so C1 and C3 receive it) and one batch-size step in C2's Playground task.
  - **CI21 is added** (weight sharing; computational, with a `check` field verified in `tests/unit/inventory.test.ts`). It gives the convolutional cluster three items and keeps the pre-test at 20 items.
  - Each item carries a `cluster` (fundamentals 7, optimisation 5, backpropagation 5, convolutional 3). Clusters and Bloom levels are the primary reporting units (Tables 9–10, Figures 5–6). Per-concept results are an exploratory appendix (Table 17) with item counts.
- **Consequence:** 20 core and 4 transfer items. Overfitting and initialisation are not measured; this is stated in LIMITATIONS, and the retired items remain in the file for a future curriculum.

## ADR-033 — 2026-10-19 — How option-shuffle uniformity is tested (Fix Round 1, A2)
- **Context:** All 25 items store the correct option first, so validity depends on the per-participant shuffle. A first test with 2 000 simulated participants and a per-item χ² at the 0.1 % level failed for one item (χ² = 17.2). Three other seed sets gave a mean χ² of 2.4–2.8 (expectation 3), so this was the multiple-testing tail, not bias.
- **Decision:** 20 000 simulated participants. Each item's χ²(3) is tested against 18.11 (Bonferroni over 24 items at family-wise α = .01), and the pooled χ²(72) against 102.82 (α = .01). The seed base was kept, not changed until a test passed. Scoring is also tested through the display-to-canonical mapping that the UI uses: always correct gives 100 %, a fixed distractor gives 0 %, and always clicking the first position gives about 25 %.
- **Consequence:** A biased shuffle, or a mapping bug in the UI's display-to-canonical function, fails CI.

## ADR-034 — 2026-10-19 — Palette re-stepped to ΔE ≥ 15 under protanopia and deuteranopia (Fix Round 1, B7)
- **Context:** Several pairs cleared the earlier ΔE ≥ 8 target only narrowly under simulated deuteranopia:
  - series 2–3: 9.2 (light), 9.4 (dark);
  - forward vs backward mode: 9.3 (dark);
  - backward vs update mode: 10.1 (light) and 10.3 (dark).
- **Method:** grid search over HSL candidates, maximising the worst ΔE (OKLab × 100, Machado et al. 2009) under protanopia and deuteranopia against the colours each must differ from. Constraints:
  - normal-vision ΔE ≥ 20;
  - chart series inside the validator's OKLCH lightness band and chroma floor (light 0.43–0.77, dark 0.48–0.67);
  - UI state colours at text contrast ≥ 4.5:1.

  Every series palette was then re-run through the dataviz validator.
- **Decision:**

  | Token | Light | Dark |
  |---|---|---|
  | Series 2 | #eb6834 → **#863103** (burnt orange) | #d95926 → **#995c00** (amber-brown) |
  | Series 3 | unchanged | #199e70 → **#13ae8a** |
  | Backward mode | #b3005e → **#631d39** (wine) | #ff7ab8 → **#d2656a** (coral) |

  Forward stays blue and update amber in both themes. All 13 meaningful pairs now reach ΔE ≥ 15 under both deficiencies; the worst is 16.1 (`reports/cvd.json`).
- **Trade-offs:**
  - Within the dark lightness band, no single slot change reached 15. Changing slots 2 and 3 together reaches 16.1, at the cost of a darker, less saturated orange on dark backgrounds.
  - Crimson candidates scored highest for light series 3 but were rejected because red is reserved for status/error meaning.
  - The light series-3 green keeps its 2.74:1 graphic contrast (relief by table views and dash patterns, as before).
  - The wine backward colour falls below the validator's chart lightness band. That band applies to chart palettes; mode colours are UI text and border colours, whose binding constraint (≥ 4.5:1) is met.
- **Consequence:** The non-colour cues stay: dashes, labels, icons and border patterns. C1 screenshots and example figures were regenerated with the new palette.

## ADR-035 — 2026-10-19 — CNN peak memory: in-place batch-gradient accumulation (Fix Round 1, C3)
- **Context:** Live memory at the CNN experiment is ~81 MB, but the tab's peak resident set was 537–538 MB (three runs, headless Chromium, `tests/e2e/perf-cnn.spec.ts`), above the ~500 MB budget. The brief proposed reusing scratch buffers in the convolution kernels' im2col/scatter paths. Inspection showed:
  - **The convolution kernels have no scratch buffers.** They are direct loops, and every allocation in them is an output tensor that the trace records and must keep immutable. Trace content alone is 729 MB over the run, the churn floor.
  - **The only per-example allocation outside the trace is batch-gradient accumulation.** `add(prev, g)` allocated a new parameter-sized tensor per example per parameter: about 75 MB over the run, roughly 10 % of the churn.
- **Decision:** Accumulate each parameter's batch sum in place in a private buffer. The first example's gradient (a trace tensor) is copied, never mutated, and additions keep their order. Every trace hash, determinism record and parity record is byte-for-byte unchanged, and gradcheck, parity and determinism suites pass.
- **Measured:**

  | | Peak tab RSS (three runs) | Generation |
  |---|---|---|
  | Before | 537–538 MB | 6.0–6.5 s |
  | After | 519–532 MB | ~6.0 s |

  Live memory is unchanged (81 MB).
- **Consequence:** A small, real reduction is kept. The peak is still about 5 % above the budget, because the remaining churn is the trace content itself. Reaching the budget needs a different route (e.g. float32 storage for cached trace tensors, or a smaller cache budget during generation). Both trade against the float64 exactness the evidence rests on, so neither was attempted in a correction round.

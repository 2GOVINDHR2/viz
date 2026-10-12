# DL-VizLab Audit Report

> **Historical snapshot:** This audit records checks from 2026-08-29 against the repository state at that time. Its passing counts and browser observations are not verification of the later Phase 1A/master-prompt changes. Current verification status is in [the final implementation report](docs/FINAL_IMPLEMENTATION_REPORT.md); current inventory is in [PROJECT_STATUS.md](docs/PROJECT_STATUS.md).

Date: 2026-08-29 · Scope: full stack audit (engine, program, execution, experiments, UI, build)
Method: unit tests + independent re-computation (numeric audit) + headless-Chromium CDP browser probes of all 10 experiments.

---

## Verification baseline (everything that passed)

| Check | Result |
|---|---|
| `npm test` (unit suite) | 70/70 pass (31 original + 39 numeric-audit checks in `src/audit.numeric.test.ts`) |
| `npx tsc -b` | 0 errors |
| `npm run build` | success (48 modules; JS 253.10 kB / gzip 77.81 kB; CSS 11.56 kB) |
| Dev server | HTTP 200 |
| Browser console / page errors | none across all 10 experiments |
| Per-experiment DOM probe | every shown number matches engine values; explainer strings match inspector/node values |

Engine-level numeric audit (`src/audit.numeric.test.ts`) confirmed, independently re-computing every displayed value:

- **Every record in all 10 experiments** (INPUT/MATMUL/BIAS/ACT/LOSS/GRAD/UPDATE) reproduces the exact numbers shown in the UI.
- **Step-Back is lossless:** stepping back from cursor *k* and re-stepping reproduces the exact state (round-trip equality, not approximate).
- **Gradients are mathematically correct:** all GRAD records for all training engines match central finite differences (relative error < 1e-6), including bias terms and hidden-layer paths.
- Hand spot-checks: single-neuron `z = 1.5 → z = 1.6 (bias) → a = sigmoid(1.6) = 0.8317`; gradient-descent converges to the exact known minimum `w + b = t`; single-layer XOR correctly fails (linear separator).

**Conclusion:** the numeric/math core of the tool is sound. The issues below are about correctness of *labels/semantics* and *training behaviour/pedagogy*, plus UX gaps.

---

## 1. Critical bugs

### C1. The XOR Problem experiment does not learn — the flagship training demo is broken
- **Files:** `src/experiments/xor.ts` (defaults `hidden: true, lr: 1, seed: 42`); note text at `src/components/ExperimentViews.tsx:212` ("…then Run to watch it learn the XOR function") directly contradicts observed behaviour.
- **Evidence (numeric audit, runner with 400 epochs):** with the hidden layer ON (2 hidden units — capacity is sufficient), loss **plateaus at ≈ 0.693** (the `ln 2` all-0.5 prediction) and stays there. Predictions are ~0.5 for every input; weights/license decay toward 0. Sweeping `lr` from 0.01 to 2 over 400 epochs produces either the same plateau or persistent oscillation between small and large losses; the default `lr = 1` oscillates without converging.
- **Why it's confounding:** gradients are verified numerically correct (finite-difference checks pass), so this is *not* a math bug — it is a **training-settings / optimizer robustness defect** (online SGD over 4 cycling XOR samples with untuned `lr`, init scale, and sigmoid saturation). A student pressing **Run** sees the network not learn, which the experiment's own prose promises it will.
- **Severity:** critical — it is the demonstration that the whole tool is built around, and it currently shows the opposite of the intended lesson.

### C2. "iter N" tags appear on non-loop experiments — iteration is a training-loop concept
- **Files:** `src/execution/controller.ts:207` (`this.iteration = this.records.filter(r => r.kind === 'LOSS').length + 1`, incremented for *every* LOSS record unconditionally); rendered at `src/components/RightPanel.tsx:278` (`iter-tag`), `src/components/ExecutionControls.tsx:68` (`· iter N`), and in experiment titles/explain strings.
- **Evidence:** Loss Functions (a single one-shot MSE computation, `loop: false`) displays **"Compute mse loss · iter 1"**, and the step summary in the same experiment says `iter 1`. There is no iteration in a non-loop experiment.
- **Impact:** teaches a wrong mental model (labels a one-shot forward pass as "iteration 1 of training") and weakens the numeric display's credibility.

---

## 2. Mathematical correctness issues

**None found.** Every displayed number, gradient, and round-trip state was re-computed independently and matches. The only "math-adjacent" findings are presentation/abstraction choices (see §5/S5 and §6):

- Activation Functions computes and explains **all 161 elements of the activation sweep in a single op record** (one Step = the whole layer, 161 z-values at once).
- The header loss chip shows the most recent LOSS record's value even while a *gradient* op is the current step (verified: Perceptron shows the just-computed loss `0.01347` while `now = "Gradients at Perceptron · iter 1"`). Arguably correct (it is the loss of the current iteration), but easy to misread as the *current step's* output.

---

## 3. Functional issues

### F1. Stale selection persists across experiments, resets, and trace clicks; op-inspector becomes unreachable
- **Files:** `src/viz/NetworkGraph.tsx` (selection state; **no background-click handler to clear selection**), `src/components/RightPanel.tsx` (node/edge selection branch takes priority over the current-op view), `src/state/useLab.ts` / `App.tsx` (selection is never cleared on experiment switch or reset).
- **Evidence (browser):** select a node in any graph-capable experiment → switch to another experiment → the Inspector still shows the old **"Connection · input→h"** / **"Neuron · Input #0"** entries, which can reference layers that do not exist in the current experiment. Same stale entry survives **Reset** and, critically, clicking a new **trace item no longer switches the Inspector back to the operation view** — the node/edge selection branch shadows it until a different node is clicked. Verified in all 10 experiments (e.g. Perceptron, Gradient Descent, Weight Update show `Neuron · Input #0` even after stepping to a fresh op).
- **Impact:** temporary dead-end in the primary teaching surface (operation details), plus invalid data (layers from another experiment).

### F2. Empty "Live computation" panel for experiments without a bespoke view
- **Files:** `src/components/MainPanel.tsx:57-63` renders `.exp-panel` unconditionally; `src/components/ExperimentViews.tsx` returns `null` for experiments without a view (Single Neuron, Forward Propagation, Backpropagation, Weight Update).
- **Evidence (browser):** those 4 experiments show a panel headed "Live computation" with nothing in it (measured height ≈ 50 px, just the heading). Reads as an unfinished/omitted feature.

### F3. Auto-run enablement is inconsistent with whether looping exists
- **Files:** `src/components/ExecutionControls.tsx` (Run enabled by record-count heuristic).
- **Evidence (browser):** Run is disabled for Single Neuron / Activation Functions / Loss Functions (short or one-shot programs) but **enabled for Forward Propagation** (8 one-shot ops, no loop) and enabled for loop experiments. Not harmful, but the rule is opaque and not derived from `program.loop`.

---

## 4. UX issues

### U1. No way to deselect a graph node/edge
- Background click in `NetworkGraph` does nothing (no handler); users can enter the selected-node state but cannot leave it without selecting another element. Should be: click empty canvas clears selection (see F1).

### U2. Input "sensors" are labelled "Neuron", and input values are labelled "activation"
- **Files:** `src/components/RightPanel.tsx` (inspector head `Neuron · Input #0`, key `activation`), `src/viz/NetworkGraph.tsx` (node labelling). An input (a constant feature, no weights on it, no activation) being called a "Neuron" with an "activation" is conceptually wrong for a teaching tool that elsewhere draws the input/weight/activation distinction carefully.

### U3. One Step can be enormous in vectorized experiments
- In Activation Functions a single Step executes the whole 160-element sweep **and** prints 161 math lines (`a0 = f(-6) = 0.002473 …` through `a160 …`). Step semantics are "one op record", but there is no visual cue that a Step is element-wise-massive. Pedagogically it is a wall of numbers with no epistemic value (see S5).

### U4. XOR boundary plot shows a featureless midline (inherited from C1)
- The 2D boundary view for the XOR experiment draws the decision boundary of the untrained/stuck network — a straight `0.5` line — and this is what students see by default. Self-inflicted by C1; the view itself is correctly wired.

---

## 5. Educational / pedagogical issues

### S1. The XOR experiment teaches the wrong lesson (combined with C1)
- The tagline is "Why one layer fails and a hidden layer succeeds" — but the hidden-layer path currently fails too, and silently (flat loss curve, no diagnostic). Either fix training so it works, or surface data/targets explicitly and explain instability. ("Run to watch it learn" at `ExperimentViews.tsx:212` is the specific false promise.)

### S2. Explainers dump full tensors instead of summarizing
- **Files:** `src/explanation/generate.ts` (per-element math lines for every element of a record) + `src/components/RightPanel.tsx` (renders them all).
- Loss Functions math is fine (scalar), but Activation Functions prints 161 lines for one op; a 1000-sample MLP training batch would print thousands. For pedagogy and performance the explainer should cap/sample (e.g. show first/middle/last elements plus a `… (N more)` line).

### S3. No guidance when training is stuck or diverging
- When predictions collapse to 0.5 / loss plateaus (XOR) there is no flag, no note next to the plot, and no "try a smaller learning rate" hint, even though `lr` is user-tunable. The tool explains *mechanics* well but offers no *guidance on failure modes*.

### S4. Hidden training is opaque during long Run sessions
- During a long auto-Run, the only state carriers are the step chip (`iter N`) and the graph; the trace grows unbounded and only the selected/current record is explained. There is no periodic "loss per iteration" readout for the XOR/MLP trainings (the exp-vs-loss chart exists for Gradient Descent only). Students can't see learning progress from the main view; the loss chip is easy to miss.

---

## 6. Minor polish issues

| # | Issue | File |
|---|---|---|
| P1 | The graphless placeholder text ("Use the chart and the right-hand panels below") is always about charts even for experiments whose chart ships in a different position/layout. | `src/components/MainPanel.tsx:50-53` |
| P2 | `notifyForUi()` (added for the UI) duplicates state that controllers otherwise expose on demand; fine to keep, but it should be the single documented mutation path in `DOCUMENTATION.md` (already noted there). | `src/execution/controller.ts` |
| P3 | Step chip uses `iter N` while the "now" line appends `· iter N` — two spellings of the same concept within one component. | `src/components/ExecutionControls.tsx:63,68` |
| P4 | Input node value shown in Inspector as a float with no clear unit/role (it is a feature constant); visually it can be mistaken for an output. | `src/components/RightPanel.tsx` |
| P5 | No keyboard shortcut for Step/Run, and the tips block in `DOCUMENTATION.md` lists Auto-run & space shortcut as a "known issue". | `DOCUMENTATION.md` · `src/components/ExecutionControls.tsx` |
| P6 | Node x-position recomputed on every render per layer width; numeric labels can jitter on re-render (cosmetic). | `src/viz/NetworkGraph.tsx` |
| P7 | `DOCUMENTATION.md` "Known issues" section should be updated to reference this report once adopted. | `DOCUMENTATION.md` |

---

## Proposed fixes (ordered; not yet implemented — phased for review)

**Phase A — correctness first (small surface):**
1. **C2:** only attach `iteration` to LOSS records when `program.loop === true` (`controller.ts:207` + the `iteration` propagation at `:211/:256/:293`); gate the `iter-tag` in `RightPanel.tsx:278` on the record's op being part of a loop. One-line-ish; removes the misleading "iter 1" on Loss Functions.
2. **F1/U1:** add a background-click handler in `NetworkGraph` (`onSelect(null)` on the SVG canvas) **and** clear selection in `App.tsx`/`useLab` on experiment switch and on `reset()`. Makes the op-inspector reachable again and kills cross-experiment staleness.

**Phase B — pedagogy (medium):**
3. **C1/S1:** retune the XOR experiment — smaller default `lr` (e.g. 0.2–0.3), a more reasonable random init scale (e.g. `U(-0.5, 0.5)`), and/or switch to cost-averaged full-batch gradient so the online-SGD instability disappears; re-run the 400-epoch audit to confirm loss ≈ 0. Then update `ExperimentViews.tsx:212` wording. (Do **not** fall back to hand-coding a "cheat" — the optimizer must be honest.)
4. **S2:** cap explainer output to a bounded sample (e.g. ≤ 10 lines) with `… (rest)` note in `generate.ts`/`RightPanel.tsx`.
5. **S3:** when a training run is at/near plateau (e.g. loss within 1e-3 of `ln 2` for BCE), print a note in the explain card: "loss is stuck — try a lower learning rate" (deterministic engine-only check, no ML).
6. **S4:** reuse the existing exp-vs-loss chart component for XOR/MLP trainings so learning progress is visible while running.

**Phase C — polish (later):**
7. **F2:** show a small informative empty-state inside the "Live computation" panel ("This experiment needs no live view — follow ops in the Inspector.") instead of nothing.
8. **U2/P4:** rename inspector labels: "Neuron" → "Input" for sensor nodes, "activation" → "value" for inputs, in `NetworkGraph` + `RightPanel`.
9. **F3:** base Run enablement on `program.loop` (auto-run only meaningful for loops) or keep the heuristic but document it.
10. Keep `src/audit.numeric.test.ts` as a permanent regression suite (it currently cannot fail without breaking numbers in the UI). Consider promoting it to `tests/` with a matching `npm run audit` script.

None of the above change the tool's architecture, the op IR, or the deterministic engine core — they refine behaviour, labels, and presentation. Math core requires no changes.

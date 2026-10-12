# DL-VizLab Existing Prototype Audit

**Date:** 2026-10-01
**Scope:** Repository source, project configuration and docs, experiment definitions, math/execution/data flow, UI, existing tests, and available local verification.
**Initial audit change policy:** Audit only. The initial audit added this report and did not modify application source. See the Phase 1 update below for subsequent work under the new master prompt.

## Phase 1 Stabilization Update (2026-10-01)

After this audit, the project team supplied the Research Prototype Master Development Prompt and directed work to begin with Phase 1 only. The implementation has since changed the following areas:

- Operation records now distinguish history `step`, program `opIndex`, and program `cycle`.
- `useLab` resolves focus by history step, so wrapped operation indices no longer select a stale first-cycle record.
- Step Back restores a cloned full engine state, including intermediate tensors, and rewinds the latest record across cycle boundaries.
- Up to 16 completed program cycles plus the active cycle are retained, with full per-op engine snapshots and a completed-cycle endpoint snapshot; pruning removes whole completed cycles.
- Sample selection derives from cycle position. UI labels use “cycle” and the MLP loss axis/title now says “training step,” not iteration/epoch.
- Graph selection clears on reset/experiment initialization, trace selection clears graph selection, and clicking the graph background deselects.
- Added controller regression cases for cycle-boundary replay, single-pass labeling, and the retained-history boundary; adjusted the numeric audit expectation accordingly.
- Added [execution-model.md](docs/execution-model.md) and updated the execution section of `DOCUMENTATION.md`.

The P0 loop cursor/history mismatch and the related misleading iteration wording have implementation changes in place. These changes are **not runtime-verified**: `npm test`, `npm run build`, and `npm run lint` still fail to launch under WSL 1 because npm resolves to the Windows Node installation. `git diff --check` also reports pre-existing CRLF/trailing-whitespace diffs across the already-modified worktree, so it cannot isolate new whitespace problems. XOR convergence, mathematical edge cases, and browser behavior remain outstanding.

## Master Prompt Implementation Update (2026-10-01)

Subsequent work added repository inventory and implementation-status documents; structured educational metadata for all ten experiments; a selected-record, runtime-valued dependency summary; descriptive training loss-window signal; MLP learning-rate A/B comparison from matched initialization/data using isolated controllers; conceptual data/model-family guidance; and project/phase/manual-verification documentation. These additions are source-implemented but **not technically verified** because Node/Vitest/build/lint cannot start under this WSL 1 environment. They have not been human- or learner-validated. See `docs/FINAL_IMPLEMENTATION_REPORT.md` for actual scope and boundaries.

## 1. Executive Summary

DL-VizLab is a browser-only React/TypeScript educational prototype with ten small experiments and a custom scalar/vector neural-network engine. The strongest architectural idea is an explicit operation program with per-operation records, which makes forward and backward calculations inspectable and supports deterministic stepping. The codebase includes focused numeric and controller tests, although they could not be run in this environment.

The most important current risk is loop execution state. `ExecutionController.cursor` is an operation index, while `records` grows across loop cycles. `useLab` uses that operation index as a record-array index. After the first training cycle, selection and explanation can point at the first cycle's records while the engine has moved on. Rewind also truncates the accumulated record history using the operation index, so multi-cycle step-back is not a coherent inverse of execution. This directly affects the app's core promise of inspecting/replaying training.

Other confirmed concerns include the XOR experiment's default learning rate of 1 despite copy stating it will learn; non-loop LOSS records being assigned training iteration numbers; graph selection persisting across experiment changes/reset and blocking trace-driven Inspector selection; oversized per-element explanation output for the 161-value activation sweep; no loss history in the dedicated XOR experiment; and math/API generality that is broader than its validation and tests (notably mean reduction and gradient scaling for vector outputs).

The project is structured as a collection of operation-focused demos, with a coherent step-by-step interaction concept but incomplete loop-history semantics and uneven learning guidance. There is no backend, ML library, API client, or external visualization library; the arithmetic is handwritten TypeScript. No framework migration or rewrite is indicated by this audit.

## 2. Current Technology Stack

| Area | Current implementation | Evidence |
|---|---|---|
| Frontend | React 19, function components and hooks | `package.json`, `src/main.tsx`, `src/App.tsx` |
| Language | TypeScript ~6, no-emit app config with unused-symbol checks | `tsconfig*.json` |
| Build/dev | Vite 8, React plugin | `vite.config.ts`, `package.json` |
| Tests | Vitest 4 | `package.json`, `src/**/*.test.ts` |
| Lint | Oxlint with React/TypeScript/OXC plugins | `.oxlintrc.json` |
| ML computation | Handwritten tensor helpers and dense-network math in TypeScript | `src/core`, `src/program`, `src/execution` |
| Visualization | Handwritten React SVG charts and network diagram | `src/viz` |
| Styling | Single handwritten CSS file; dark theme and CSS grid | `src/styles.css` |
| State | One `useLab` hook plus mutable `ExecutionController` | `src/state/useLab.ts`, `src/execution/controller.ts` |
| Backend/API/storage | None found | Repository file inventory and imports |

No TensorFlow/PyTorch package, routing library, charting package, state-management package, or animation library is present. The app is one page with experiment selection rather than URL routing.

## 3. Current Architecture

1. **Experiment definitions** (`src/experiments`): defaults and controls create a `Program`; some provide datasets and experiment-specific views.
2. **Program IR/builders** (`src/program`): an ordered array of `INPUT`, `MATMUL`, `BIAS_ADD`, `ACTIVATE`, `LOSS`, `GRAD`, and `UPDATE` operations plus model parameters, samples, and graph layer specs.
3. **Core math** (`src/core`): flat row-major tensors, mutable named tensor store, activations, losses, dense operations and SGD.
4. **Execution** (`src/execution`): controller applies one operation, appends a record containing inputs/outputs, stores parameter snapshots, supports timer-based run and step-back.
5. **Explanation** (`src/explanation`): deterministic prose and numeric formulas generated from operation records.
6. **React state/UI** (`src/state`, `src/components`): `useLab` owns experiment/config and wraps controller notifications; `App` owns graph selection; sidebars, graph, experiment views, and right inspector read the controller.
7. **Visualization** (`src/viz`): SVG network graph and line/scatter/activation/loss charts.

**State ownership:** parameters and intermediate tensors live in `Engine`; execution history and cursor/timer live in `ExecutionController`; experiment/config/selected operation live in `useLab`; selected graph node/edge lives in `App`; hover lives in `NetworkGraph`.

**Coupling:** the program IR and tensor ID naming are shared directly across builders, engine, controller, views, and inspector. Views read named tensors from the mutable engine rather than consuming an immutable snapshot. This is serviceable for the current small app but makes historical replay and multi-view synchronization dependent on correct controller bookkeeping. Experiment-specific chart calculations also duplicate parts of forward inference (`forwardAt`) beside the operation engine.

## 4. Repository Structure

```text
src/
  core/          tensor store, activations, losses, math, unit tests
  program/       operation IR, MLP builder, tests
  execution/     op records, controller, tests
  explanation/   deterministic explanations
  experiments/   ten experiment definitions, datasets, registry/helpers
  state/         useLab hook
  viz/           network SVG and chart primitives
  components/    navigation, controls, panels, experiment views
  App.tsx        page composition and graph selection
  main.tsx       React entry point
  styles.css     application styling
public/          favicon and SVG icons
```

Root configuration includes `package.json`/`package-lock.json`, Vite config, TypeScript configs, Oxlint config, `README.md`, `DOCUMENTATION.md`, `AUDIT.md`, and `index.html`. `README.md` is still the generic React+Vite starter text; `DOCUMENTATION.md` and `AUDIT.md` contain project-specific claims and prior audit material. The repository has no backend source, environment template, or API client.

## 5. Existing Functionality

- Ten experiment definitions are registered in two navigation groups, Foundation and Learning.
- Experiment controls are config drafts; applying config reinitializes the experiment through a React effect.
- Users can step, step back, reset, run/pause at a selected speed, and select trace rows.
- Training programs cycle examples, calculate loss, calculate gradients, and update parameters.
- The graph encodes signed weights by color and magnitude by stroke; it highlights operation layers and allows node/edge selection.
- Dedicated views exist for Activation Functions, Perceptron, Loss Functions, Gradient Descent, XOR, and MLP Training. Other experiments get no bespoke live view.
- The inspector renders record values; the explanation panel generates formulas/text from records; trace display is limited to the most recent 200 entries.
- MLP Training offers XOR, two-cluster, and moons-like datasets, with hidden sizes 4/8/16 and selectable activation.
- Existing tests cover math helpers, builder ordering/reference forward results/finite differences, controller behavior, and a broad numeric audit.

## 6. Experiment-by-Experiment Audit

| Experiment | What the code does | Learning/interaction assessment | Classification |
|---|---|---|---|
| Single Neuron | One dense unit; user sets two inputs, weights, bias and activation; operation-by-operation execution | Good parameter visibility and a compact mechanics example. No bespoke live panel; input/weight/activation terms still require explanation. | **MINOR REFINEMENT** |
| Activation Functions | Applies selected activation to 161 samples from -6 to 6 in one `ACTIVATE` op; view plots function and derivative | Curve plus sample marker is meaningful, but a single step emits a large vector and explanation math expands to 161 lines. Its copy says compare functions although only one is selected at a time. | **MAJOR REFINEMENT** |
| Perceptron | Linear output trained by MSE/SGD on deterministic two-cluster points; view shades sigmoid of the raw score | Decision line and weight controls expose parameter effects. “Perceptron” conventionally implies a threshold/update rule, while this code is a linear unit trained with squared-error gradient descent; wording should clarify the variant. | **MINOR REFINEMENT** |
| Forward Propagation | Fixed 2→3→3→2 dense network with configurable activation and inputs | Clear stepping and graph are useful; output has two values but no target/loss. No custom live view and three layers may add complexity before mechanics are secure. | **MINOR REFINEMENT** |
| Loss Functions | One scalar prediction/target and MSE or BCE; slider prediction ranges -1 to 2 | Curve makes scalar loss tangible. BCE expects probability input, but the control admits values outside [0,1]; implementation clamps internally, which creates misleading flat/edge behavior unless explained or constrained. | **MAJOR REFINEMENT** |
| Gradient Descent | One linear neuron with fixed input and target; one-sample MSE training loop | Parabola, tangent, gradient and learning rate support intuition. The plot's analytic loss expression mirrors the one-dimensional case well; iteration-state issues still affect the controller. | **MINOR REFINEMENT** |
| Backpropagation | One 3→2→1 network with BCE; computes one forward/backward/update sequence but `loop: false` | Makes gradient records inspectable. The learner meets derivative, chain rule, BCE, matrices and hidden layers together; no guided context or live gradient view. | **MAJOR REFINEMENT** |
| Weight Update | One linear unit, one sample, MSE, one backward/update pass | Good controlled setting for the SGD equation, but there is no dedicated visual view and the state currently presents the entire network op trace. | **MINOR REFINEMENT** |
| XOR Problem | 2→(optional 2)→1 sigmoid network, BCE, online cycling over four samples, default `lr: 1` | The linear-vs-hidden-layer contrast is valuable, but the stated promise that hidden network learns conflicts with the documented prior audit's plateau/oscillation finding. Current defaults and lack of loss timeline/failure feedback leave that defect visible. | **TECHNICALLY INCORRECT** (behavioral claim/default) |
| MLP Training | One hidden layer (4/8/16), sigmoid output, BCE, per-sample cycling over XOR/clusters/moons | Most complete training visualization: loss samples and decision boundary. History is per sample rather than epoch average, the long-running history is retained in memory, and loop selection/replay defects apply. | **MAJOR REFINEMENT** |

## 7. Educational / Pedagogical Audit

The navigation order broadly moves from one unit and activation to propagation, then loss/optimization/backprop and finally XOR/MLP. This is a plausible progression, but the current interface is organized by technical topic rather than learning outcomes or prerequisites. It does not define “model”, “feature”, “prediction”, “weight”, “gradient”, “epoch”, or “tensor” before using them. Inline descriptions do explain several terms, though equations and multiple new terms often arrive together.

Active learning is supported by sliders, toggles, selection, step/run, reset, and replay controls. But “Apply & initialize new network” followed by the note “Then press Reset to rebuild” is confusing: applying config already causes `ctrl.init(...)` via the effect. Failure behavior is not consistently taught: no stuck/diverging guidance is present. The XOR and MLP experiments are the closest to the intended inspect/manipulate/reason workflow, but history selection should be fixed before treating replay as a dependable learning feature.

The app currently behaves like a **coordinated set of demos with a shared operation inspector**, not yet a fully guided educational environment. It has a consistent dark visual shell and repeated execution controls, but no learner levels, explicit learning questions, checkpoints, guided comparisons, or concept mastery cues.

## 8. UI/UX Audit

- **Navigation:** clear two-group experiment list; no route/deep-link or progression indicator. Switching experiment resets config and execution, but leaves graph selection intact.
- **Hierarchy:** three-column desktop layout with header, config/nav sidebar, main graph/view, and inspector/explanation/trace. At widths below 980px it becomes a vertical document; very small-screen interactions may require extensive scrolling.
- **Controls:** native buttons, selects, ranges, and checkboxes. Config is explicitly applied. No keyboard shortcuts or visible keyboard instructions found.
- **Charts/graph:** custom SVG avoids heavy dependency and makes small datasets easy to show. Charts generally lack accessible names/description; graph is one `role="img"` and its node/edge groups are pointer-only, with no keyboard selection.
- **Selection:** clicking a node/edge sets global selection; background click has no clear handler despite Inspector copy instructing the user to click empty space. Selection is not cleared on experiment switch/reset and takes precedence over current-operation inspection.
- **Feedback:** no bespoke empty-state is returned for four experiments while “Live computation” panel remains present. No visible errors/loading states; operations are synchronous and local, so loading is not presently needed.
- **Trace:** list renders up to 200 entries, but controller retains all records; long loops therefore increase memory and rendering work is partly avoided only at display level. Trace items identify op type/direction, not sample/epoch structure.
- **Visual design:** consistent dark palette, spacing, cards, and controls. Small text is common (labels down to 9–12px); no reduced-motion concern because no decorative animation system is found. Responsive treatment is limited to a single breakpoint and wide SVG minimum width.

## 9. ML / Mathematical Correctness Audit

### Soundly represented for current scalar-output training demos

- `matmulRow` uses `[input, output]` weight orientation and computes the expected dot products.
- Bias add, sigmoid/tanh/ReLU/linear activations and their derivatives are standard (ReLU derivative at zero is chosen as zero).
- BCE clamps probabilities for logarithms and exposes the usual derivative w.r.t. prediction; output sigmoid+BCE gradients then multiply by sigmoid derivative. This is mathematically valid though less numerically stable than the fused sigmoid+BCE derivative.
- Dense backprop computes `dW = prevAct ⊗ dz`, `db = dz`, and `dx = W dz`; SGD subtracts learning-rate-scaled gradients.
- Existing test sources include finite-difference checks and record-vs-recomputation checks; see verification limitations below.

### Boundaries and issues

- `LOSS` averages elementwise losses across output elements, but `outputActivationGrad` returns each element derivative without dividing by output count. For output dimension greater than one, this is not the gradient of the implemented mean loss. Current training experiments all use one output, so the mismatch is latent in the generic builder/core path; `Forward Propagation` has two outputs but no loss.
- BCE is defined for probabilities, but `Loss Functions` allows arbitrary predictions from -1 through 2 and the loss clamps internally. This is a pedagogical boundary mismatch.
- The `matmulRow` implementation assumes compatible dimensions and rectangular weights but does not validate them. `denseGradients` checks weight row count but not all `dzFinal`, matrix-column, or derivative-vector dimensions. Builder-generated current examples are shape-compatible; future callers can silently generate `NaN` values or partial math.
- Core Tensor `makeTensor` checks value count but not nonnegative integer dimensions, finite values, or defensive copies on construction. Engine clones at registration/write, but direct `get()` returns a mutable tensor object.
- Online updates on one sample at a time are used for dataset training. This is legitimate SGD, but loss samples fluctuate and are not epoch-average loss; the view label should teach that distinction.
- Current prior `AUDIT.md` reports an independent 400-epoch XOR run that plateaus near 0.693 for the hidden-layer default. I confirmed the present source still has hidden layer enabled, online sample cycling, seed 42, default learning rate 1, and the “watch it learn” claim. I could not rerun the numeric experiment in this shell.

## 10. Code Quality Audit

- **Types:** discriminated unions and explicit experiment/config definitions are a strength. There are no `any` matches in the source search. Some runtime assumptions still outpace type guarantees (shape compatibility, arbitrary config strings converted to `Number`).
- **Separation:** math is mostly isolated from React; experiment definitions build programs. Views also inspect internal engine tensor IDs directly, which couples UI to IR naming and mutable current state.
- **Duplication:** forward inference logic exists both in operation execution and `experiments/helpers.ts` for chart shading. This is currently a modest duplicate surface that needs consistency tests.
- **State/execution:** controller owns both execution and the presentation-oriented record history. Cursor/index mixing is a major correctness defect for loop semantics. Each operation snapshots every parameter array; snapshots are indexed by operation index and overwritten on loop, while `records` grows by executed-op count.
- **Error handling:** invalid experiment IDs silently resolve to the first experiment; malformed config numeric values can coerce to `NaN`; math shape errors are inconsistent. No user-facing error boundary or operation failure UI is apparent.
- **Async/lifecycle:** timer is cleared in pause/reset/dispose; hook does not visibly dispose controller on unmount, although controller is a component-lifetime singleton and current app is not frequently remounted. Timer callback notifies on every op, which intentionally refreshes UI but could be costly for larger networks.
- **Performance:** SVG scatter chart samples a 36×36 grid and invokes inference for each cell on render; custom function identity changes in views can invalidate chart `useMemo` and recompute. This is fine at present scale but could become expensive for larger networks. Controller records and per-step snapshots are retained indefinitely during looping.
- **Security/config:** no server, network requests, credentials, or environment-variable handling found. The attack surface is small. HTML uses React text rendering; no unsafe HTML use found.
- **Accessibility:** native controls are usable, but SVG graph node/edge selection has no keyboard affordance and charts are not described to assistive technologies. No focus-visible-specific style or live-region feedback was found.
- **Dead code/imports:** static inspection found no TODO/FIXME/console calls or explicit `any`; lint could not execute. `digitData()` is present but not used by current experiment registry, and its comment calls it CNN data despite no CNN experiment.
- **Tests:** four test files cover math, builders, controller, and numeric audit. No component/UI tests, accessibility tests, or browser tests are in the repository inventory. The test sources assert loop iteration count but do not appear to exercise stable selection/history semantics across multiple cycles.

## 11. Runtime / Build / Test Results

| Command | Result | Notes |
|---|---|---|
| `npm test` | **Blocked by environment** | Windows npm shim prints “WSL 1 is not supported. Please upgrade to WSL 2 or above. Could not determine Node.js install directory.” |
| `npm run build` | **Blocked by environment** | Same Node/npm launch failure; no TypeScript/Vite output was produced. |
| `npm run lint` | **Blocked by environment** | Same launch failure; lint findings are unknown. |
| `npm run dev` / route/browser check | **Not run** | Same Node runtime constraint; no application runtime or browser console result is claimed. |
| Static source/config inspection | **Completed** | Vite/React SPA configuration and app structure reviewed. |

`node` resolves to no Linux binary in this WSL 1 environment; `npm` resolves to `/mnt/c/Program Files/nodejs/npm`. Dependencies exist under `node_modules`, but the available launcher cannot run. Thus installation, type-check, build, tests, runtime behavior, browser errors, and network requests remain unverified in this audit execution. The existing `AUDIT.md` contains a prior report claiming 70 tests/build/browser checks passed in a different environment; those historical results are not represented here as current verification.

## 12. Missing Features

- Learning pathway, prerequisite explanations, guided questions, checkpoints, and beginner vocabulary scaffolding.
- Reliable multi-cycle selection/replay and learning-state snapshots that distinguish sample, cycle/epoch, operation, and model parameters.
- Loss timeline in XOR and clear epoch aggregation/labeling for training plots.
- Failure diagnosis or explanation of stalled/diverging training.
- Keyboard-accessible node/edge selection and accessible chart summaries.
- Error boundary/user-facing validation for malformed configs or execution failures.
- A clear/empty view state for experiments with no bespoke live visualization.
- Browser-level UI regression coverage and small-screen manual validation.
- No CNN experiment exists despite unused digit data; this is future scope, not a current missing requirement unless the team wants it.

## 13. Partially Implemented Features

| Feature | Current state |
|---|---|
| Step-by-step execution | Present for operations, but loop cursor/history mapping breaks current-record selection and rewind semantics after looping. |
| Replay | Step-back exists for simple one-pass runs; cross-loop history is not modeled coherently. |
| Training-state visualization | Graph reflects current engine; focus/trace may reference earlier record after loop wrap. |
| Parameter manipulation | Config controls and graph selection; parameters are changed via rebuild and SGD, not direct graph manipulation. |
| Hyperparameter manipulation | Learning-rate controls exist; no structured comparison or controlled sweep. |
| Explanation | Deterministic and numeric; large vector math output can overwhelm and terminology assumes prior context. |
| Timeline | Trace records execution, limited to last 200 in DOM; it is not a compact per-epoch timeline and storage grows unbounded. |
| Decision boundary | Available for perceptron/XOR/MLP; XOR learning default is reported to stall. |
| Multi-view synchronization | Current engine drives graph and experiment views, but history focus can desynchronize from current loop state. |

## 14. Incorrect or Misleading Features

1. **Loop UI selection and rewind** use the operation cursor as an index into an append-only multi-cycle record list. This makes later-cycle focus wrong and step-back behavior inconsistent (P0).
2. **XOR hidden-layer promise** says Run will teach XOR while the present default remains the exact configuration the prior audit reports as not converging (P1, pending rerun in supported runtime).
3. **Iteration semantics:** controller attaches an iteration to every LOSS, including one-shot non-loop loss demos; UI can label a scalar demonstration as “iter 1” (P2).
4. **Loss Functions BCE range:** values outside probability range are accepted and silently clamped; the displayed curve can obscure the BCE domain (P2).
5. **Vector output mean loss gradient:** generic mean loss and unscaled derivatives are inconsistent for more than one output (latent technical defect; P1 before multi-output training is added).
6. **Graph Inspector instruction:** says click empty canvas to return to operation, but SVG has no background handler; trace selection also cannot override a lingering graph selection (P2).
7. **Perceptron naming:** implementation is a linear output optimized by MSE/SGD rather than a classic threshold perceptron update. It can still be a useful linear classifier demo if named/described precisely (P2).

## 15. Technical Debt

- Cursor, execution sequence number, selected record index, and training iteration should be distinct state concepts.
- Snapshots keyed only by operation index cannot represent multiple visits to an op; record history and parameter history need a consistent strategy if rewind/replay across cycles is a product requirement.
- Views reach into mutable engine IDs (`w:o`, `a:h`, etc.) and duplicate inference, so operation/state changes require coordinated UI edits.
- Validation is concentrated in selected constructors and does not guarantee every shape/config invariant at runtime.
- `records` can grow without bound in an infinite run, even though only the latest 200 rows render.
- Generic README remains starter template; documentation currently claims verification/runtime results not repeatable in this environment and the `AUDIT.md` historical audit should be dated/contextualized if retained.
- Source and many docs/config files were already modified in the worktree before this audit. No changes to those files were made.

## 16. Research-Prototype Risks

- The core research claim requires learners to inspect and replay learning; current multi-cycle history defects undermine that claim.
- A deterministic numeric trace is useful evidence but does not establish learning effectiveness. No learner study, observation protocol, or outcome measures are present in repository materials inspected.
- Novelty should not be claimed based on having a network diagram, controls, or step execution alone; these are established patterns in the referenced systems.
- Current implementation demonstrates dense MLP mechanics only. It does not yet provide execution breakpoints, causal “why changed?” comparisons, counterfactual paired runs, or knowledge-level adaptation.
- Numerical results are transparent for the current small examples, but online sample loss should not be presented as epoch-level training progress.
- No runtime verification was possible in the current environment, which increases uncertainty about the checked-out version relative to the prior audit.

## 17. Proposed Improvements (Prioritized)

| Priority | Improvement | Reason / acceptance evidence |
|---|---|---|
| P0 | Correct execution-history model: separate current op index from record sequence index; define whether step-back crosses cycle boundaries; keep UI focus tied to the latest executed record. | After at least three loops, header/Inspector/trace show the actual current operation; stepping back and re-stepping restores exact state/history. |
| P0 | Run tests/typecheck/build/lint/browser smoke test in supported Node/WSL2 or native environment and compare current checkout with historical report. | Record fresh results, especially controller tests and all experiment routes. |
| P1 | Resolve XOR training behavior before presenting “watch it learn”; tune honest optimizer/init settings or revise instructional objective, then measure full-dataset loss and predictions. | Repeated deterministic runs achieve stated learning outcome or UI accurately explains failure. |
| P1 | Make multi-output loss gradient agree with chosen mean reduction, or explicitly constrain loss/training builder to scalar outputs. | Finite difference tests with vector output and different output dimensions. |
| P1 | Define trace retention policy (bounded history, per-cycle summaries, or explicit recording) and make training progress visible without unbounded growth. | Long run stays bounded and learner can compare cycle/epoch trend. |
| P2 | Gate iteration labels to loop/training context and define whether they count examples, passes, or epochs. | One-shot Loss Functions no longer displays an iteration; training labels are explained consistently. |
| P2 | Clear graph selection on experiment switch/reset and implement canvas deselection; trace click should select current operation. | Manual UI path returns to operation inspector in each case. |
| P2 | Bound explanation math output and summarize long vectors/matrices with explicit omitted count. | 161-sample activation explanation stays readable while exact values remain inspectable if needed. |
| P2 | Align BCE slider with probability domain or explain/clamp the learner input visibly; clarify MSE averaging. | No silent out-of-domain values; equation and UI agree. |
| P2 | Add accessible labels and keyboard focus/selection support to graph/charts; validate layout at phone/tablet widths. | Keyboard-only flow and screen-reader labels can access core information. |
| P3 | Add empty states for no-view experiments; clarify Apply behavior; refine “Perceptron” wording and per-sample loss labels. | Copy matches actual interaction/math. |
| P4 | Investigate guided execution breakpoints, paired counterfactual runs, snapshots, parameter sensitivity, and knowledge levels after core replay is sound. | A research question and evaluation plan justify each feature before implementation. |

## 18. Potential Novel Features and Established Baseline

The referenced systems already establish interactive neural visualization, direct parameter changes, training animation, network/data views, or visual explanation patterns. The project should make a specific contribution through a well-tested combination and learning study rather than assume novelty from these ingredients.

| Feature | Current status in source | Educational value / feasibility | Priority / assessment |
|---|---|---|---|
| Interactive model | Present via config controls and selectable graph nodes/edges; graph does not directly manipulate parameters. | Useful; feasible. | P2 refine interaction semantics. |
| Real ML computation | Present as handwritten deterministic dense-network computation, no external framework. | High transparency at small scale; limited scope. | Keep current scope unless scale requires otherwise. |
| Step-by-step execution | Present, with loop-history defect. | Core educational value; technically feasible to correct. | P0. |
| Training-state visualization | Current engine state shown in graph; focus can stale after loop. | High value when synchronized. | P0/P1. |
| Parameter manipulation | Initial values/learning rates via controls, training updates; no direct dragging. | Useful; direct manipulation must remain mathematically interpretable. | P2. |
| Hyperparameter manipulation | Learning rate and model/dataset choices are configurable. | Useful; comparisons/sweeps not present. | P2/P3. |
| Causal explanation / “why changed?” | Current op explanation gives local formula and generic rationale; no before/after causal attribution. | Potentially valuable; feasible with paired state diffs, but explanation quality needs evaluation. | P4 research. |
| Knowledge levels | Absent. | May support progressive disclosure; added state/content complexity. | P4 after learner needs are studied. |
| Counterfactual experiments | Absent; reset is deterministic but no paired-run comparison. | Strong potential for causal reasoning; feasible if snapshots are reliable. | P4. |
| Learning breakpoints | Absent; user steps at every low-level op. | Could reduce overload and align with conceptual events. | P3/P4. |
| Timeline replay | Trace exists; not cycle-aware and not a reliable replay timeline. | High value if state model fixed. | P0 foundation, then P2. |
| Guided experiments | Short explanatory copy only; no prompts/checkpoints. | Useful for beginner learning. | P2/P3. |
| Decision boundary | Present for classification views. | Good for spatial intuition; reflects current weights. | Keep, fix training/history context. |
| Weight visualization | Present through edge colors/width and Inspector. | Meaningful but exact scale/legend interpretation should be explained. | P2. |
| Gradient visualization | Gradient values in Inspector; graph highlights gradient phase but does not scale edge by gradient. | Useful; potential visual encoding should distinguish gradient from weight. | P2/P4. |
| Multi-view synchronization | Views use current engine; trace/explanation can refer to stale record. | Core value; requires P0 correction. | P0. |

No feature is labeled novel here. Potential contribution lies in evaluating whether a cycle-aware execution trace with synchronized quantitative explanations and guided counterfactuals improves novice reasoning compared with existing visualization patterns.

## 19. Recommended Implementation Order

1. Run the current code in a supported Node environment and capture a fresh baseline; reconcile findings with historical `AUDIT.md`.
2. Repair the controller's cursor/history/rewind semantics and validate multi-cycle behavior before extending replay or explanation features.
3. Verify and resolve the XOR convergence mismatch; align labels and charts with observed behavior.
4. Fix generic loss-reduction/gradient consistency and define shape/config validation contracts.
5. Bound training history, clarify iteration versus epoch, and improve long-vector explanations.
6. Fix graph selection lifecycle and empty states; adjust labels and BCE domain controls.
7. Improve keyboard/accessibility and responsive behavior; add UI-level checks.
8. Only then scope new research features such as breakpoints, paired counterfactuals, or knowledge levels against a learning question and evaluation plan.

## 20. Questions / Decisions Requiring Human Input

### DECISIONS REQUIRED FROM PROJECT TEAM

#### 1. What should “step back” mean during looping training?

**QUESTION:** Should learners rewind individual operations across cycle boundaries, or rewind only to a previous example/complete training cycle?
**WHY IT MATTERS:** This decision determines what state must be snapshotted and how much execution history can be retained; the current implementation cannot represent historical parameter state reliably across loops.
**CURRENT OPTIONS:** Full op-level rewind; cycle-level rewind; no rewind while looping, with reset/replay from start.
**RECOMMENDED OPTION:** Cycle-level rewind for an initial robust implementation, with operation-level stepping inside the active cycle.
**TRADE-OFFS:** Cycle snapshots are simpler and memory-bounded but less granular; full op-level rewind offers more inspection and requires careful history storage.

#### 2. What is the intended XOR learning outcome?

**QUESTION:** Must the default 2-hidden-unit XOR setup reliably converge, or is the experiment intended to demonstrate that optimization can fail as well as representation limits?
**WHY IT MATTERS:** Current instructional copy promises successful learning; prior audit material reports a loss plateau near ln(2).
**CURRENT OPTIONS:** Retune deterministic initialization/learning rate; change optimizer/batch policy; retain failure and teach diagnosis; separate capacity and optimization experiments.
**RECOMMENDED OPTION:** Keep this experiment focused on representational capacity and choose stable, documented training settings; teach optimizer failure separately.
**TRADE-OFFS:** Stable defaults make the concept clear but reduce exposure to realistic training variability; separate failure diagnosis adds scope.

#### 3. Should MSE support vector outputs in the generic engine?

**QUESTION:** Should the builder/core promise mean loss for multi-output models, or should training loss be restricted to scalar output for now?
**WHY IT MATTERS:** Current loss averages output elements but gradients are not divided by output count.
**CURRENT OPTIONS:** Scale gradients by reduction size; define summed loss; reject vector-output training; defer until a multi-output training experiment exists.
**RECOMMENDED OPTION:** State the reduction explicitly and make gradient math match it before generalizing the training API.
**TRADE-OFFS:** Matching mean reduction is standard but requires changes/tests; scalar restriction narrows capability while keeping current demos consistent.

#### 4. What is the intended curriculum structure?

**QUESTION:** Should the app stay a free-choice experiment collection or add guided levels/prerequisite gates?
**WHY IT MATTERS:** The intended learner may not know the math vocabulary, while current navigation exposes topics without a progression path.
**CURRENT OPTIONS:** Free-choice demos; optional guided track; mandatory sequential levels.
**RECOMMENDED OPTION:** Add an optional guided path while keeping all experiments freely accessible.
**TRADE-OFFS:** Optional guidance preserves exploration but adds content maintenance; mandatory gates impose structure and may frustrate returning/advanced users.

#### 5. Which contribution should define the research prototype?

**QUESTION:** Which candidate should receive implementation and evaluation effort: cycle-aware replay, causal explanations, counterfactual comparisons, learning breakpoints, or knowledge levels?
**WHY IT MATTERS:** Building all candidates risks adding complexity without a testable research claim; no user study evidence is present in the repo.
**CURRENT OPTIONS:** Pick one candidate; combine replay with one explanatory feature; defer novel features and first evaluate the existing prototype.
**RECOMMENDED OPTION:** First stabilize replay, then select one learning intervention and evaluate it with beginners.
**TRADE-OFFS:** Narrow scope supports attribution and evaluation; a larger integrated feature set may feel richer but makes learning effects harder to identify.

#### 6. What is acceptable trace retention?

**QUESTION:** Should the app keep every operation forever, use a bounded rolling window, or store per-cycle summaries plus a detailed active cycle?
**WHY IT MATTERS:** Infinite training currently appends records indefinitely; the UI only renders the last 200, but memory use is unbounded.
**CURRENT OPTIONS:** Fixed record cap; per-cycle summary with active-cycle detail; user-controlled pause/export.
**RECOMMENDED OPTION:** Retain detailed records for a bounded number of recent cycles and keep compact loss/parameter summaries for older cycles.
**TRADE-OFFS:** Bounded summaries reduce memory while preserving trend context but cannot support arbitrary detailed rewind without recomputation/storage.

#### 7. Which runtime environment is the verification baseline?

**QUESTION:** Should project verification target WSL2/Linux Node or Windows-native Node?
**WHY IT MATTERS:** The current shell is WSL1 and cannot launch the configured Windows Node/npm; all automated checks were blocked.
**CURRENT OPTIONS:** WSL2 Node install; native Windows Node commands; CI workflow as authoritative environment.
**RECOMMENDED OPTION:** Make CI with a pinned Node version authoritative, with local WSL2/native instructions matching it.
**TRADE-OFFS:** CI gives repeatability but does not replace local browser QA; maintaining multiple local workflows adds setup burden.

## Concise Summary

The app has a clear custom execution/math foundation and ten working-by-design experiment definitions. The main blocker to the educational “inspect and replay learning” goal is inconsistent loop cursor/history indexing, followed by the reported non-learning XOR default and correctness/UX issues listed above. Automated checks and browser runtime could not be repeated because the available Node launcher is incompatible with WSL 1. No application code was changed.

# DL-VizLab — Project Documentation

**An interactive, browser-only playground for understanding how neural networks compute and learn.**

This document records the original implementation structure and selected development history. For current status and verified scope, use [PROJECT_STATUS.md](docs/PROJECT_STATUS.md), [ARCHITECTURE.md](docs/ARCHITECTURE.md), and [FINAL_IMPLEMENTATION_REPORT.md](docs/FINAL_IMPLEMENTATION_REPORT.md).

> **Verification note (2026-10-01):** The Phase 1A and master-prompt additions described in the current docs are source-implemented but have not been tested or built in this WSL 1 environment. Historical check results elsewhere in this document are not evidence that the current revision passes.

---

## Table of contents

1. [Overview](#1-overview)
2. [Constraints & goals](#2-constraints--goals)
3. [Tech stack & tooling](#3-tech-stack--tooling)
4. [High-level architecture](#4-high-level-architecture)
5. [Code structure](#5-code-structure)
6. [Layer 0 — Core math engine (`src/core`)](#6-layer-0--core-math-engine)
7. [Layer 1 — Neural programs (`src/program`)](#7-layer-1--neural-programs)
8. [Layer 2 — Execution (`src/execution`)](#8-layer-2--execution)
9. [Layer 3 — Explanations (`src/explanation`)](#9-layer-3--explanations)
10. [Layer 4 — Experiments (`src/experiments`)](#10-layer-4--experiments)
11. [Layer 5 — React glue (`src/state`)](#11-layer-5--react-glue)
12. [Layer 6 — Visualization (`src/viz`)](#12-layer-6--visualization)
13. [Layer 7 — UI components (`src/components`)](#13-layer-7--ui-components)
14. [Styling](#14-styling)
15. [Testing](#15-testing)
16. [Verification status](#16-verification-status)
17. [Change log](#17-change-log)
18. [Known issues & next steps](#18-known-issues--next-steps)
19. [Conventions used in this codebase](#19-conventions-used-in-this-codebase)

---

## 1. Overview

DL-VizLab is an educational web application (single-page, no backend) that lets a student:

- pick one of **10 guided experiments**,
- tweak parameters in a side panel,
- **step through a neural network operation by operation** (step / step-back / run / pause),
- watch a **live network graph** light up as data flows forward, gradients flow backward, and weights update,
- see the **exact numbers** of every intermediate tensor, and
- read a **deterministic explanation** of why each operation matters (numbers substituted in, no LLM).

The entire neural machinery — tensors, linear algebra, activations, losses, forward propagation,
backpropagation and SGD — is implemented from scratch in TypeScript with zero ML dependencies.

---

## 2. Constraints & goals

Hard requirements that shaped every decision:

| Constraint | Consequence |
|---|---|
| **No backend / DB / auth** | Pure client-side; all state lives in hooks + a controller object. |
| **No TensorFlow.js / external ML libraries** | A custom lightweight TS engine (`Engine`, `mathops`) was written instead. |
| **No LLM explanations** | Explanations are generated deterministically from the actual computed numbers. |
| **No RNN / Transformers / GANs** | Scope is dense MLPs; CNNs are a well-defined **Phase 2** (see §18). |
| Small, pedagogically clear networks | Experiments use 1–2 layer nets with few units, so every number is legible. |
| "Show numbers, show _why_" | Every op records its inputs/outputs, and the explainer derives real math strings. |
| Deterministic runs | Seeded PRNG (mulberry32) so experiments re-init identically. |

---

## 3. Tech stack & tooling

- **React 19** — function components + hooks only.
- **TypeScript ~6.0**, strict, with Vite's `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`.
- **Vite 8** — dev server + production build (`npm run dev`, `npm run build`).
- **Vitest 4** — unit tests (`npm test` → `vitest run`).
- **No** Tailwind, zustand, d3, or component libraries — plain hand-rolled CSS, a custom hook, and hand-rolled SVG charts.

### Commands

```bash
npm run dev      # dev server on http://localhost:5173
npm run build    # tsc -b && vite build (type-check + production bundle)
npm test         # npx vitest run
npx tsc -b       # standalone type-check
```

---

## 4. High-level architecture

Data flows through 7 clearly separated layers. Each layer only depends on the ones below it:

```
┌─────────────────────────────────────────────────────────────┐
│  UI components (src/components) + styles                    │
│   App, Header, Sidebar/Config, MainPanel, RightPanel,       │
│   ExecutionControls, ExperimentViews                        │
├─────────────────────────────────────────────────────────────┤
│  Visualization (src/viz)                state glue (src/state)│
│   NetworkGraph (SVG), charts.tsx        useLab() hook        │
├─────────────────────────────────────────────────────────────┤
│  Experiments (src/experiments)   ← descriptions + datasets   │
│   ExperimentDef → buildProgram(config) → Program             │
├─────────────────────────────────────────────────────────────┤
│  Explanation (src/explanation)    deterministic explain()    │
├─────────────────────────────────────────────────────────────┤
│  Execution (src/execution)                                  │
│   ExecutionController (step/stepBack/run/reset), OpRecord    │
├─────────────────────────────────────────────────────────────┤
│  Program (src/program)                                     │
│   ProgramOp IR, buildMlpProgram generates the op sequence    │
├─────────────────────────────────────────────────────────────┤
│  Core (src/core)                                           │
│   Tensor, Engine, activations, losses, mathops (matmul,     │
│   bias-add, activation, dense-gradients, SGD update)         │
└─────────────────────────────────────────────────────────────┘
```

The central object is the **`Program`**: an ordered list of discrete `ProgramOp`s.
The **controller** executes one op at a time, records everything, and lets the UI rewind.
The **UI** reads recorded numbers through snapshot views and renders them.

---

## 5. Code structure

```
src/
├── core/                     # Layer 0 — pure math, no React
│   ├── tensor.ts             # Tensor type, makeTensor, zeros, mulberry32 PRNG
│   ├── engine.ts             # Engine — mutable named-tensor store
│   ├── activations.ts        # linear / relu / sigmoid / tanh + derivatives
│   ├── losses.ts             # mse / bce + derivatives
│   ├── mathops.ts            # matmulRow, biasAdd, activation, denseGradients, sgdUpdate…
│   └── mathops.test.ts       # unit tests (Layer 0)
├── program/                  # Layer 1 — neural program IR + builder
│   ├── ops.ts                # ProgramOp / Program / LayerSpec types
│   ├── builders.ts           # buildMlpProgram, tensor-id helpers (wId, aId, …)
│   └── builders.test.ts      # forward + backprop gradient checks (Layer 1/2)
├── execution/                # Layer 2 — stepping engine
│   ├── trace.ts              # OpRecord discriminated union + tensorView
│   ├── controller.ts         # ExecutionController (step/stepBack/run/reset)
│   └── controller.test.ts    # controller tests (Layer 2)
├── explanation/              # Layer 3
│   └── generate.ts           # explain(record) → Explanation (deterministic)
├── experiments/              # Layer 4 — experiment definitions + datasets
│   ├── types.ts              # ExperimentDef / Config / FieldDef + num/str/bool helpers
│   ├── helpers.ts            # linspace, forwardAt (live forward pass for charts), ACTIVATION_OPTIONS
│   ├── datasets.ts           # XOR_DATA, twoClusterDeterministic, moonsDeterministic, digitData
│   ├── singleNeuron.ts       # exp 01
│   ├── activationExperiment.ts
│   ├── perceptron.ts
│   ├── forwardProp.ts
│   ├── lossExperiment.ts
│   ├── gradientDescent.ts
│   ├── backprop.ts
│   ├── weightUpdate.ts
│   ├── xor.ts
│   ├── mlpTrain.ts
│   └── registry.ts           # EXPERIMENTS list, getExperiment, experimentGroups
├── state/                    # Layer 5
│   └── useLab.ts             # the one and only app state hook
├── viz/                      # Layer 6
│   ├── NetworkGraph.tsx      # layered SVG network diagram w/ click selection
│   └── charts.tsx            # LineChart, ScatterChart, ActivationCurve, LossHistory
├── components/               # Layer 7
│   ├── App.tsx               # layout + selection state
│   ├── Header.tsx            # experiment / operation / direction / step / loss chips
│   ├── Sidebar.tsx           # experiment nav + ConfigPanel
│   ├── MainPanel.tsx         # network graph + controls + ExperimentView
│   ├── ExperimentViews.tsx   # per-experiment live charts/boundaries
│   ├── ExecutionControls.tsx # Reset / StepBack / Step / Run / Pause + speed + progress
│   └── RightPanel.tsx        # Inspector / Explanation / Trace
├── main.tsx                  # entry point
└── styles.css                # dark lab theme (single stylesheet)
```

Totals at this point: **39 source files, ~4,000 lines of TS/TSX/CSS, 31 tests passing.**

---

## 6. Layer 0 — Core math engine (`src/core`)

### `tensor.ts`
- `Tensor = { values: number[]; shape: number[] }` — flat, row-major arrays.
- `makeTensor(values, shape)` validates that `values.length === sizeOf(shape)`.
- `zeros`, `cloneTensor`, `toNested`, `matrixFromNested` (storage helpers).
- `mulberry32(seed)` — deterministic PRNG so every re-initialization yields identical weights.

### `engine.ts`
- `Engine` — a **mutable named-tensor store** (a `Map<string, Tensor>`).
- Operations read their inputs here, write their outputs here; parameters live here between steps.
- `register` / `set` always clone on write; `get` throws on unknown id; `valuesOf(id)` returns `[]` if absent (used by UI guards).

### `activations.ts`
- `ActivationFn = 'linear' | 'relu' | 'sigmoid' | 'tanh'`.
- `ACTIVATIONS` registry maps each to `{ label, formula, derivativeFormula, apply(z), derivative(a, z), blurb }`.
  - Derivative is evaluated **at the activation output** where the math is cleaner: sigmoid `a(1−a)`, tanh `1−a²`.
  - relu derivative uses `z > 0 ? 1 : 0` to avoid the z=0 discontinuity.
- `isActivationFn` guard, `actValue`, `actDerivative`.

### `losses.ts`
- `LossFn = 'mse' | 'bce'`; `LOSSES` registry `{ apply, deriv, formula, blurb }`.
- BCE clamps predictions to `[1e-9, 1−1e-9]` to avoid `log(0)`.
- `lossValue`, `lossDeriv`, `isLossFn`.

### `mathops.ts` — the numeric heart
- `matmulRow(x, W)` → `MatmulDetail` including `products` (each term `xᵢ·W[i][j]`) so the UI can show the full dot-product expansion for an explanation.
- `biasAdd(z, bias)` — validates equal length.
- `applyActivation(values, fn)` and `activationDerivatives(values, fn)`.
- `denseGradients(prevAct, z, W, dzFinal, activation)` → `{ dLda, fPrime, dz, dW, db, dx }` — the vectorized backprop math for a dense layer:
  - `dz = dzFinal · f′(z)`
  - `dW[i][j] = prevAct[i] · dz[j]`
  - `db = dz`
  - `dx[i] = Σⱼ dz[j] · W[i][j]`
- `outputActivationGrad(act, target, lossFn)` → `dL/da` for the output layer.
- `sgdUpdate(old, grad, lr)` → `old − lr·grad`.
- UI helpers: `tensorToMatrix`, `clamp01`, `fmt` (4 significant digits), `fmtStr` (fallback to scientific notation for huge/small values).

---

## 7. Layer 1 — Neural programs (`src/program`)

### `ops.ts` — the IR
`ProgramOp` is a discriminated union of exactly seven kinds:

| Kind | Direction | What it does |
|---|---|---|
| `INPUT` | forward | Loads a sample into tensor `x` (dataset-cycles when looping). |
| `MATMUL` | forward | `z = x · W` per layer. |
| `BIAS_ADD` | forward | `z = z + b` per layer. |
| `ACTIVATE` | forward | `a = f(z)`. |
| `LOSS` | forward | Computes mean element loss vs target. |
| `GRAD` | backward | Backpropagates at one layer → dz, dW, db, dx. |
| `UPDATE` | update | `param ← param − η·grad`. |

`Program` additionally carries: `params` (init values + shapes), `data` (input/target tensors), optional `samples`/`targets` for **dataset cycling**, `layers` (for the network graph), `inputId`, `targetId`, `lossFn`, and `loop` (true = training programs that wrap around).

### `builders.ts`
`buildMlpProgram(opts)` is the only builder needed so far. From a `DenseLayerSpec[]` it generates:
1. one `INPUT` op,
2. forward ops `[matmul, bias, activate]` per layer,
3. `LOSS` if `loss` + `targetValues` are given,
4. backward ops if `includeBackward`: output-layer `GRAD`, then hidden `GRAD`s top-down, then `UPDATE` pairs per layer,
5. the `layers` spec for the graph.

Tensor id convention (used everywhere in the UI to read the engine):

```ts
wId(layer)  → 'w:<layer>'    aId(layer) → 'a:<layer>'
bId(layer)  → 'b:<layer>'    zId(layer) → 'z:<layer>'
dzId(layer) → 'dz:<layer>'   gwId(layer) → 'g:w:<layer>'
gbId(layer) → 'g:b:<layer>'  dxId(layer) → 'dx:<layer>'
INPUT_TENSOR = 'x'           TARGET_TENSOR = 't'
```

Weights are Xavier-ish: uniform in `±1/√in`, biases init to `0`, both seeded. `paramOverrides` lets experiments pin exact starting weights/biases (e.g. the Single Neuron and Gradient Descent experiments).

---

## 8. Layer 2 — Execution (`src/execution`)

### `trace.ts`
`OpRecord` — a compact, serializable snapshot of what one op computed — includes `kind`, `step` (history position), `opIndex` (position in the program), `cycle` (program pass), `title`, `direction`, `layerId`, and per-kind `inputs`/`outputs`/`params` (all `TensorView = {values, shape}`). This is what the Inspector, the Explain tab, the Trace list and the charts consume. Current dataset training processes one sample per cycle; a cycle is not an epoch.

### `controller.ts` — `ExecutionController`
The single mutable "brain" behind the whole app:

- **State**: `program`, `engine`, retained `records: OpRecord[]`, `cursor` (last operation index), `cycle`, `running`, `runDelayMs`, `totalOps`, `atEnd`.
- **`init(program)`** — builds a fresh `Engine`, registers all params + data, clears history, resets cursor.
- **`step()`** — computes the next op index (`cursor + 1`, wrapping to `0` when `program.loop`), executes it via `applyOp`, appends its `OpRecord`, notifies listeners.
- **Rewind (`stepBack()`)** — before each op runs, a cloned snapshot of the engine tensor store is stored with the record. `stepBack` restores the pre-op store and removes that record. History retains up to 16 completed cycles plus the active cycle; trimming removes only whole completed cycles. Rewind stops at the oldest retained record after earlier cycles are discarded.
- **Dataset cycling** — in the `INPUT` case, when `program.samples` exists, the sample index is `(cycle - 1) % samples.length`, and the matching target is written to `t`.
- **Run / Pause / runSteps** — `run()` uses a `setInterval`-based timer (stored on `globalThis` for testability) honoring `runDelayMs`; `runSteps(n)` executes n steps synchronously.
- **Readability for the UI** — `currentLoss()`, `currentActivations()`, `getParam(id)`, `currentRecord()`.
- **Position semantics** — `step` identifies an execution-history position, `opIndex` identifies its program op, and `cycle` identifies one complete pass through the program. Current dataset demos process one sample per cycle; a cycle is not an epoch.
- **`onChange(listener)`** pub/sub; `notifyForUi()` triggers a manual refresh (used by the speed selector).
- `dispose()` clears listeners/timer.

---

## 9. Layer 3 — Explanations (`src/explanation`)

`explain(record: OpRecord): Explanation` — a **pure function of the recorded numbers** (no LLM, fully deterministic).

`Explanation = { action, what, why, numbers: {label, value}[], math: string[] }`.

Per op:
- **INPUT** — announces the sample flowing in.
- **MATMUL** — expands each `z_j` as `x₁·w₁ⱼ + x₂·w₂ⱼ + …` with the real product terms.
- **BIAS_ADD** — shows `z_j = z_j + b_j`.
- **ACTIVATE** — labels the function, shows f(z) and f′(z) per unit.
- **LOSS** — expands either `(p−t)²` or the BCE formula with real numbers, reports the mean.
- **GRAD** — writes the chain-rule sequence `dL/da → dz = dL/da·f′(z) → db = dz → dW = prevActᵀ·dz` (or `dz = dx_up·f′(z)` for hidden layers).
- **UPDATE** — prints `w ← w − η·g` for every parameter and even detects whether the step increased/decreased weights or equality (flat spot).

---

## 10. Layer 4 — Experiments (`src/experiments`)

### `types.ts`
- `Config = Record<string, number | string | boolean>`.
- `FieldDef` — a discriminated union that fully describes the config UI:
  - `range` (slider), `select` (dropdown), `toggle` (checkbox), `section` (group heading).
- `ExperimentDef = { id, name, tagline, group, fields, defaults, buildProgram(config) → Program }`.
- Helpers `num()`, `str()`, `bool()` for reading config safely.

### `datasets.ts`
- `XOR_DATA` — the 4 truth-table rows.
- `twoClusterDeterministic(seed, perClass)` — separable 2D point clouds, interpolated so adjacent samples alternate class (bad for online SGD, good for teaching).
- `moonsDeterministic(seed, count)` — interleaving circular bulges, non-linearly separable.
- `digitData()` — two 8×8 bitmap digits (0 and 1) **reserved for the Phase-2 CNN experiment**.

### The 10 experiments (grouped)

**Foundation**
| # | id | name | What it shows |
|---|---|---|---|
| 01 | `single-neuron` | Single Neuron | Weighted sum + bias + activation for one neuron; sliders for x₁,x₂,w₁,w₂,bias. |
| 02 | `activation` | Activation Functions | Select any activation; a sample marker rides the curve; charts f and f′. |
| 03 | `perceptron` | Perceptron | A linear neuron trains on two-cluster data; live decision-line shading. |
| 04 | `forward-prop` | Forward Propagation | Data flows op-by-op through a 2→3→3→2 MLP (forward only). |

**Learning**
| # | id | name | What it shows |
|---|---|---|---|
| 05 | `loss` | Loss Functions | MSE vs BCE curve for one (pred, target) pair; marker + full maths. |
| 06 | `gradient-descent` | Gradient Descent | One weight w descending a parabola; tangent line overlay = gradient. |
| 07 | `backprop` | Backpropagation | 3→2→1 sigmoid net; watch gradients flow backwards. |
| 08 | `weight-update` | Weight Update | One complete forward→loss→grad→update cycle on a single neuron. |
| 09 | `xor` | XOR Problem | Toggle hidden layer on/off; see linear fail vs hidden layer succeed. |
| 10 | `mlp-train` | MLP Training | Full training loop on XOR / two-clusters / two-moons with adjustable hidden size, activation, lr. |

### `helpers.ts`
- `linspace(a, b, n)` — used by the activation + loss experiments to sample a curve.
- `forwardAt(engine, layers, input, activations)` — a **cheap live forward pass** straight off the engine's current `w:`/`b:` tensors; powers the class-probability shading in the perceptron / XOR / MLP views even mid-training.
- `ACTIVATION_OPTIONS` — shared select options.

### `registry.ts`
`EXPERIMENTS[]`, `getExperiment(id)` (falls back to experiment 01), `experimentGroups()` (nav sections).

---

## 11. Layer 5 — React glue (`src/state`)

### `useLab()` — the one hook that owns app state
- One `ExecutionController` is created **once** in a `useState` initializer and subscribed to so `cursor`/state changes trigger re-renders (this also made the controller never `null` — an earlier design had a `useRef` that was null on first render).
- An `useEffect` rebuilds the program whenever `experimentId` or the applied `config` changes: `ctrl.init(def.buildProgram(config))`.
- **Config draft vs applied config**: sliders edit `configDraft`; `applyConfig()` copies it over (guarded — "Apply & initialize new network" only enables when dirty) and re-initializes the controller.
- Switching experiments pauses playback, resets the draft + applied config to the experiment's defaults, and clears the selection.
- Returns a `Lab` object: `{ experiment, configDraft, config, ctrl, focus, selectedIndex, actions }` where `focus` = the `OpRecord` at `selectedIndex` (or null).

---

## 12. Layer 6 — Visualization (`src/viz`)

### `NetworkGraph.tsx`
A hand-rolled **SVG** layered diagram (no d3):
- One column per layer; nodes spaced vertically; edge count matches the weight matrix.
- Edges are colored `var(--edge-pos)` / `var(--edge-neg)` by weight sign, **stroke width encodes |weight| magnitude**, and opacity varies with magnitude too.
- Nodes are tinted by their current activation (positive/negative/neutral) and render the value compactly.
- **Highlighting from the current op**: forwarding ops (`MATMUL`, `BIAS_ADD`, `ACTIVATE`) and `GRAD`/`UPDATE` emphasize the target layer's rows; `UPDATE` edges render dashed.
- **Click selection** → `Selection = node | edge` with hover states; `<title>` tooltips show exact values.
- Filters: blurred data → gradients flowing backwards/updates are visually distinct.

### `charts.tsx`
- `LineChart` — grid, optional markers (+ second marker), extra dashed path overlay (used for the gradient tangent), axis labels. Pure SVG, no libs.
- `ScatterChart` — a 36×36 **class-probability heatmap** (each cell calls a `shade(x, y) → [0,1]` function), then the data points overlaid as class-colored dots. This is the "decision boundary" for perceptron / XOR / MLP views.
- `ActivationCurve` — plots `f(z)` and `f′(z)` over the domain with a marker at the chosen sample.
- `LossHistory` — the running per-sample loss curve across training steps (fed by `LOSS` records).

---

## 13. Layer 7 — UI components (`src/components`)

### `App.tsx`
Sets up the 3-area layout (`Header / Sidebar / MainPanel / RightPanel` in a CSS grid), holds `Selection` state, and passes it to MainPanel + RightPanel.

### `Header.tsx`
Live read-only chips: **experiment name, current operation, direction, step count, current loss** (monospace, warn color when present, dim otherwise).

### `Sidebar.tsx` + ConfigPanel
- Left nav grouped into **Foundation / Learning** sections with the active experiment highlighted.
- **ConfigPanel** renders `ExperimentDef.fields` declaratively — sliders, selects, toggles, sections — bound to `configDraft`, plus the "▶ Apply & initialize new network" button (enabled only when the draft differs from the applied config) and a hint block.

### `MainPanel.tsx`
- Network graph bound to the engine: per-layer activation values via `aId`/input id, weights via `wId` + `tensorToMatrix`.
- Falls back to a placeholder message for the two no-graph experiments (activation, loss).
- `ExperimentView` below the graph (see below).
- Mounted `ExecutionControls`.

### `ExecutionControls.tsx`
- Buttons: **Reset** (disabled when nothing executed), **◀ Step back**, **▶ Step**, **Run / ⏸ Pause**.
- **Speed** select (Fast 40ms / Normal 120ms / Slow 420ms) — updates `ctrl.runDelayMs` then `ctrl.notifyForUi()`.
- **Progress bar** (step / total, or cycle number while looping) and a **NOW** bar showing the current op title + direction chip.

### `ExperimentViews.tsx` — the per-experiment live view
Switches on `experiment.id`:
- **Activation** — `ActivationCurve` with the sample marker + a card showing f(z), f′(z), formula, blurb.
- **Perceptron** — `ScatterChart` with sigmoid-shaded decision boundary from the *live* weights, the decision-line equation, and weight readouts.
- **Loss** — the loss curve over predictions with a marker at the current (pred, target) + the MSE/BCE expansion.
- **Gradient Descent** — loss parabola with the current weight marker, a dashed **tangent line** (slope = gradient), and the written-out `w ← w − η·∇w` update.
- **XOR** — points + boundary shade (via `forwardAt`), live prediction badges per corner, with/without hidden layer.
- **MLP Training** — `LossHistory` (loss records within the retained 16-cycle window) + a live decision-boundary `ScatterChart` for the chosen dataset (XOR / clusters / moons).

### `RightPanel.tsx` — inspector, explanation, trace
- **Inspector** — depending on selection:
  - *selected node* → activation, bias, whole layer outputs, weights feeding that neuron (extracted as a matrix column), and last-computed `gradW`.
  - *selected edge* → weight, its gradient, source/target activations.
  - *nothing selected* → the **current op's** tensor values (input/weights/z for matmul; pred/target/element-loss for LOSS; old→gradient→new for UPDATE; etc.).
- **Explain** — calls `explain(focusRecord)` and renders action title, execution-cycle tag, "what", "why", number chips, and the math block (mono, colored).
- **Trace** — a scrollable list of up to 200 retained operations (step #, kind icon, title, direction chip); clicking selects the recorded inspector/explanation values. The network graph continues to show the current engine state, not a historical graph snapshot.

---

## 14. Styling

Single `src/styles.css`, dark lab theme, plain CSS with a small set of **design tokens** (CSS variables):

```
--bg / --bg-2 / --bg-3   surface levels (near-black navy)
--border, --text, --text-dim, --muted
--acc     blue accent (data)      --acc-2  orange accent (gradients/results)
--pos / --neg             positive/negative values
--warn    yellow (loss)           --grad   purple (backprop)
--edge-pos / --edge-neg   edge coloring (same tokens used by NetworkGraph & charts)
--mono    JetBrains Mono stack for every number
```

Layout: header (top span), sidebar (300px), main (fluid), right panel (340px); collapses to a single column under 980 px. Scrollbars, cards (`.card`), chips (`.h-chip`, `.dir-chip`), tables (`.vtable`, `.mtx`), buttons, sliders, and the SVG chart classes are all styled here.

---

## 15. Testing

Three test files, **31 tests, all passing**:

| File | Coverage |
|---|---|
| `src/core/mathops.test.ts` | `matmulRow` dot products, `biasAdd` shape-check, activations + derivatives (incl. relu discontinuity, tanh/sigmoid identities), MSE/BCE values + derivatives, `sgdUpdate`, `denseGradients` hand-checked values, tensor validation/cloning. |
| `src/program/builders.test.ts` | `buildMlpProgram` op-sequence structure, dataset cycling wiring; **forward pass matches a reference implementation**; **backprop gradients match analytic vs central finite-difference check** for both MSE and BCE — this is the numerical-correctness core. |
| `src/execution/controller.test.ts` | `ExecutionController` init/step/records, full engine-state rewind, cycle boundaries, bounded history, loop + dataset cycling, run/pause/runSteps. |

---

## 16. Verification status

As of the last commit of work:

- ✅ `npx tsc -b` — **0 errors** (strict, erasableSyntaxOnly, noUnusedLocals/Parameters).
- ✅ `npx vitest run` — **31 / 31 passed**.
- ✅ `npm run build` — type-check + Vite production build succeeds (48 modules; ~253 KB JS / ~77.8 KB gzip).
- ✅ `npm run dev` — serves 200 on `http://localhost:5173/`.

---

## 17. Change log

> Detailed history of everything built in the project.

### Session 1 — Scaffold & foundations
- Initialized the Vite **react-ts** template in `/home/swayam/amrita/s7/vizlab`.
- Installed Vitest; added `"test": "vitest run"` to `package.json`.
- Wrote `src/core/tensor.ts` (Tensor, makeTensor, zeros, cloneTensor, mulberry32) and `src/core/engine.ts` (mutable tensor store).
- Wrote `src/core/activations.ts` (linear/relu/sigmoid/tanh + `derivative(a, z)` evaluated at the activation) and `src/core/losses.ts` (mse/bce) — both as typed registries with formulas, blurbs, and derivative strings for the UI.
- Wrote `src/core/mathops.ts`: `matmulRow` (with per-term `products`), `biasAdd`, `applyActivation`, `activationDerivatives`, `denseGradients` (full `dz/dW/db/dx`), `outputActivationGrad`, `sgdUpdate`, `tensorToMatrix`, `fmtStr`.
- Authored `src/core/mathops.test.ts`.

### Session 2 — Program IR & builder
- Wrote `src/program/ops.ts`: the 7-kind `ProgramOp` union, `InitParam`, `LayerSpec`, `Program` (with `samples`/`targets`, `loop`, `lossFn`, layer list).
- Wrote `src/program/builders.ts`: `buildMlpProgram`, the `wId/bId/zId/aId/dzId/gwId/gbId/dxId` id helpers, seeded Xavier-style initialization, `paramOverrides`.
- Authored `src/program/builders.test.ts` including the **finite-difference gradient check** for MSE and BCE backprop.

### Session 3 — Execution + explanations
- Wrote `src/execution/trace.ts` (OpRecord union + `tensorView`).
- Wrote `src/execution/controller.ts`: `ExecutionController` with `init/step/stepBack/run/pause/runSteps/reset`, per-operation engine snapshots, bounded retained history, dataset cycling in the INPUT op, explicit operation/history/cycle positions, `getParam`, `currentLoss`, pub/sub `onChange`.
- Added a public `notifyForUi()` method (drives UI refresh for speed changes).
- Wrote `src/explanation/generate.ts`: deterministic `explain(record)` with real substituted numbers and step-by-step math strings.
- Authored `src/execution/controller.test.ts`.

### Session 4 — Experiments, state, visualization
- Wrote `src/experiments/types.ts`, `helpers.ts` (linspace, `forwardAt`, ACTIVATION_OPTIONS), `datasets.ts` (XOR, two-cluster, moons, digit bitmaps).
- Wrote all **10 experiment definitions** + `registry.ts`.
- Wrote `src/state/useLab.ts` (initially using a `useRef` controller).

### Session 5 — Visualization
- Wrote `src/viz/NetworkGraph.tsx` (SVG graph, weight-coded edges, node values, focus highlight, click selection).
- Wrote `src/viz/charts.tsx` (LineChart, ScatterChart w/ class-probability heatmap, ActivationCurve, LossHistory).

### Session 6 — UI shell & wiring (most recent)
- Wrote `src/components/ExecutionControls.tsx`.
- Wrote `src/components/Header.tsx`, `Sidebar.tsx` (+ ConfigPanel), `MainPanel.tsx`, `RightPanel.tsx` (Inspector / Explain / Trace), `ExperimentViews.tsx`.
- Added an `extraPaths` (dashed overlay) capability to `LineChart` for the GD tangent.
- Wrote `src/App.tsx` (layout + selection) and the full dark theme `src/styles.css`.
- Updated `src/main.tsx` to import `styles.css`; **removed** the default Vite `App.css`, `index.css`, and `src/assets/`.
- **Fixed** the inspector's weight/gradient indexing (used a bogus global before being rewritten as `columnAt`).
- **Fixed** `useLab` so the controller is created once in state (never `null`) instead of a `useRef` that typed as nullable.
- **Fixed** `charts.tsx` marker arithmetic that compared/floored stringified numbers.
- Cleaned up all `tsc` unused-variable errors.

---

## 18. Current issues & next steps

The following are still open or unverified in the current repository:

1. Run tests, TypeScript, lint, build, and browser checks in a supported Node environment; all are blocked in this WSL 1 environment.
2. Complete the manual review in [MANUAL_VERIFICATION.md](docs/MANUAL_VERIFICATION.md).
3. Profile snapshot memory, reset/switch behavior, and synchronous comparison runtime.
4. Review learning copy with beginners; no educational effect has been established.
5. Consider a full causal graph only after agreeing on cross-record dependency semantics. CNN and other architecture support are not current implementation commitments.

Some items listed in this document’s original development history have since changed, including graph background deselection and experiment/reset selection cleanup. See `docs/PROJECT_STATUS.md` for the current inventory.

---

## 19. Conventions used in this codebase

- **File layout**: `src/<layer>/<file>`. Imports are always one directory level deep (`../core/…`).
- **No comments unless required** — code is named to read itself; docs live here instead.
- **Type-first**: discriminated unions for all event/record types; `Record<T, …>` registries for activations/losses/experiments.
- **Deterministic everything**: seeded PRNG; `explain()` is a pure function of records.
- **Numbers**: always routed through `fmtStr()` for display; `values` stored flat row-major.
- **Naming**: tensors as `w:<layer>`, `a:<layer>`, etc. via the `builders.ts` helpers; op ids like `matmul:<layer>`, `grad:<layer>`.
- **UI state**: one hook (`useLab`) + one mutable controller; components are stateless apart from local view state (selection, hover).
- **Testing**: vitest, `expect` focused on numeric equality with tolerance for gradients; no test framework config file needed.

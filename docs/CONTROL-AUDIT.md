# Control audit (Fix Round 2, §3.4)

The three defects found by hand (§3) shared a root cause: the end-to-end tests asserted that controls exist and screens render, not that behaviour changes. This audit checks every interactive control for an **observable change in state or output**:

- **Step controls** are checked against the engine's own navigator. The test generates the same deterministic trace in Node as an oracle and compares cursors exactly.
- **Parameter edits** are checked against the trace they produce.
- **Toggles** are checked against what they display.
- **Each screen** is checked against its declared surface: anything it does not declare must not render.

Tests are in `tests/e2e/controls.spec.ts` unless another file is named.

## Inventory

| Area | Controls | Count | Observable change asserted |
|---|---|---|---|
| Interface | *Guided path*, *Expert mode* | 2 | The layout switches, and the cursor is identical before and after, in both directions. The choice is remembered across a reload. |
| Curriculum | One button per experiment | 10 | The experiment's title and goal replace the previous one. |
| Step size (expert) | Operation, Layer, Phase, Example, Batch, Epoch | 6 | *Step* and *Back* move the cursor to exactly the navigator's `stepForward` / `stepBackward` position for that level. |
| Stepping | *Step*, *Back*, *Reset*, *Run/Pause*, *To breakpoint* | 5 | The cursor moves exactly as the navigator says. *Reset* returns to the start. *Run* advances; *Pause* stops. *To breakpoint* lands where `runToBreakpoint` does. |
| Playback | *Speed*, *Position* | 2 | 1.5 s at the fastest speed covers more than 3× the instructions covered at the slowest. The scrubber puts the cursor at its value. |
| Breakpoints | The seven "Pause automatically when…" toggles | 7 | With only that toggle on, *To breakpoint* stops where the engine's `runToBreakpoint` does, in three experiments (one edited to diverge, one switched to ReLU). See finding 5 for NaN/∞. |
| Novice workbench | *More controls* disclosure | 1 | The breakpoint toggles are hidden until it is opened. |
| Keyboard | ←, →, Space, Home, 1–6 | 10 | The same cursor changes as the buttons. Each digit selects its step size. A digit for a step size the screen does not offer changes nothing (the next step still moves by the screen's own unit). |
| *Try it* | Every declared parameter of every experiment | 16 | The run regenerates from the edited configuration. The trace the app shows ends where the oracle's edited trace ends, and the edited trace differs from the default one. The CNN's two parameters are checked against the run they regenerate. |
| Structure view | Layer expand, width, activation, remove, add hidden layer, learning rate, epochs, *Apply and restart*, *restore defaults* | 9 | Steps show and hide. Layer count, activation and epoch count change after *Apply*. *Restore* brings the defaults back. |
| Network view, inspector | Neuron, weight, *Clear* | 3 | The inspector shows that neuron or weight; *Clear* empties it. |
| CNN view | Feature-map cell (pointer and arrow keys) | 1 | The window moves, and its dot product equals the trace value (`cnn.spec.ts`). |
| Training view | Chart click, gradient heat-map cell, table view | 3 | The cursor jumps to the end of the clicked epoch (`views.spec.ts`; the heat map here). The table opens. |
| Walkthrough | *Next*, *Previous*, *Hide*, *Show*, *Show me* (all 31 actions) | 5 | The step text changes and comes back. Every one of the 31 *Show me* actions changes the cursor, the step size or the run. |
| Explanation | *Simple*, *Detailed*, *Show the maths*, *Show this step's numbers* | 4 | The formulas and the instruction name appear and disappear (also `tests/unit/explanation-panel.test.ts`, for every instruction kind). |
| Self-check | Every option of the 22 questions | 66 | Each option shows its own feedback. A completed experiment unlocks the next (`curriculum.spec.ts`). |
| Export | Open, *Colour*, *Greyscale*, *High contrast*, *Refresh*, *ZIP*, *SVG*, *PDF*, *CSV*, caption | 10 | The downloaded SVG differs between print modes and is identical after switching back to colour. Greyscale has no hue, and the ZIP holds every figure plus its CSV (`export.spec.ts`). *Refresh* at a later position gives a longer CSV, and the caption appears in the files. |
| Novice 1: single neuron | Three sliders, three prediction options, *Next*, *Back*, *Let it learn*, three "going deeper" items, *Open the full workbench* | 13 | The outputs table changes with each slider. Each prediction option becomes selected. Raising the bias reveals "held" for "all go up". Steps match the navigator. *Let it learn* shows the outputs after learning. Each deeper item opens its content. The workbench opens in expert mode. |
| Novice 5: gradient descent | Two step sizes, *Next*, *Back*, *Watch it walk/Pause*, *Jump to the end*, four learning rates, four prediction outcomes, the batch-size opener, three batch sizes and their prediction options, three "going deeper" items, workbench link | 25 | Steps match the navigator. Play advances; pause stops. Jump goes to the last instruction. A new learning rate waits for its prediction, and its run's final loss then replaces the old one. A sequence of rates meets all four outcomes, and each reveal says "held" for the right one. Each batch size's step count is revealed. Each deeper item opens. |
| Novice 6: back-propagation | Three step sizes, *Next*, *Back*, following a weight, three prediction options, *Predict again*, four "going deeper" items (one with an activation select), workbench link | 16 | Steps match the navigator. The followed weight changes, and every prediction option becomes selected. Stepping through the backward pass reveals the outcome. The chain's product equals the engine's gradient ("✓ the same"). *Predict again* clears the reveal. The activation select regenerates a tanh network. |
| Declared surface | Every experiment, in both modes | 10 × 2 | Step-size count = offered levels (one level → no selector). *Try it* rows = declared parameters. "add hidden layer" appears exactly where declared. The export panel appears in expert mode only. Purpose-built novice screens contain no workbench controls. |

**Total: 214 controls audited.** That is 2 + 10 + 6 + 5 + 2 + 7 + 1 + 10 + 16 + 9 + 3 + 1 + 3 + 5 + 4 + 66 + 10 + 13 + 25 + 16. The declared-surface check (20 screens) comes on top of these.

## What the audit found

The three defects reported by hand, plus four more. **Seven defects in all; six fixed, one reported.**

| # | Defect | How it showed | Fix |
|---|---|---|---|
| 1 | **Verbosity toggle did nothing** (§3.1) | Only 5 instruction kinds carry an extra "detail" sentence. For every other instruction, *Simple* and *Detailed* rendered the same markup. | Simple now shows the plain sentence, with the maths and this step's numbers behind in-place reveals. Detailed shows the instruction, the formulas and every change. A unit test renders both levels for every instruction of two traces and fails if they are identical. |
| 2 | **Illumination missing** (§3.2), in three forms | (a) Epoch, batch and evaluation boundaries lit nothing in every dense experiment. (b) The CNN view lit no stage for any instruction, and showed no loss, so loss steps had nothing to light. (c) Initialising or updating a bias lit the weights instead. | Illumination is now a declared contract (`src/views/illumination.ts`) that both views render, marked `data-lit`. `tests/unit/illumination.test.ts` checks every instruction of each experiment's first batch, update and epoch end. |
| 3 | **Architecture editor where it is meaningless** (§3.3) | "add hidden layer" on the single neuron gave a parameter error. The editor was shown on every all-dense experiment. | Each experiment declares `surface.architectureEditor`, and the editor renders only there (experiments 3, 6, 7, D1). |
| 4 | **Walkthrough promised behaviour the run does not show** | Experiment 5, step 4: "the NaN breakpoint will eventually stop the run" at η = 1.1. The loss grows from 9.17 to 1.34 × 10⁷ in 40 epochs but never becomes non-finite, so the breakpoint never fires. | The text now says what the run shows: "by the fortieth pass it is more than a million times larger than after the first". A unit test keeps that claim true. |
| 5 | **NaN/∞ breakpoint unreachable from the shipped controls** (reported, not changed) | No configuration reachable from any shipped control produces a non-finite value. That includes η = 20 in the XOR structure editor. The breakpoint fires in `pathologies.test.ts` only at η = 8 for 150 epochs. | Not changed: it is a safety net, and adding a reachable divergent setting would be a feature. The audit asserts that it does *not* fire in the reachable configurations, so a change in either direction is noticed. |
| 6 | **Undeclared step sizes reachable from the keyboard** | Digits 1–6 selected any step size on any screen. | Keyboard selection is limited to the offered levels; the audit checks it on every screen. |
| 7 | **Text equivalent with inconsistent number format** | The running caption said "Instruction 3422 of 3,422". | Both numbers are now formatted the same way. |

Two defects were introduced by the redesign itself and caught before commit, so they are not counted above:
- The secondary step-size label failed AA contrast on the selected button (axe).
- The chain-rule panel multiplied by the already-updated weight once the batch update began (`tests/unit/novice.test.ts`).

## Fix Round 2b: declared surfaces, invariants A–E

### Defects found by hand

| # | Defect | Fix |
|---|---|---|
| 8 | **Adding a hidden layer gave no way to set its weights.** The architecture editor created parameters that it did not expose. | A parameter editor, *Starting weights and biases* (`src/views/structure/ParamEditor.tsx`). It lists every trainable parameter of the *current* model, and each starting value is editable. Editing a value regenerates the run from it. Starting values the learner set survive later edits to other layers wherever their shape still fits (`reconcileInitialParams`). |
| 9 | **The inspector was not bound to the selection.** Clicking a node or an edge showed information that was not specific to it, and for a CNN cell it read the bias and kernel with dense indexing. | `inspectorValues` computes every value from the trace state for exactly the selected element, tags each value with its element (`data-of`), and lists the instructions that produced and consumed it (`src/views/provenance.ts`). |
| 10 | **No reset control on the experiments.** | *↺ Reset experiment* on every screen, in both modes (`resetExperiment`). It restores the experiment's own configuration and seed, the start position, the starting step size and breakpoints, no selection, the walkthrough at step 1, and no predictions. Self-check answers are kept (ADR-048). |

### Declared surface

Every interactive control inside an experiment screen now carries `data-control="<id>"`.

- **What each experiment declares** (`src/experiments/controls.ts`):
  - the controls that must always render;
  - the controls that may render depending on the state.
- **Invariant A:** `always ⊆ rendered ⊆ always ∪ conditional`, with `reset-experiment` required.
- **Scale:**
  - **116 distinct control ids** (from 60 `data-control` sites in the source);
  - across the 20 screens (10 experiments × 2 modes), **958 declared (screen, control) entries**, 655 of them required;
  - all of it is checked after every action of the fuzzer.

### Invariants, and what each found

| Invariant | Test | Found |
|---|---|---|
| **A** Declared surface | `tests/unit/invariants.test.ts`: every experiment in both modes, at 6 cursor positions and after a reset. Also run after every fuzz action. | No violation on the shipped code. The fault-injection test shows it catches defect 10 (a screen without its reset control). While building A, the harness itself was found to be wrong: static renders always showed the store's *initial* state (zustand v5 server snapshot), so the screen-text half of the Fix Round 2 vocabulary test had been checking empty screens. Fixed with `renderCurrentState()`; the vocabulary test now renders the real state and still passes. |
| **B** Parameter editability | `invariants.test.ts`: after load and after each of 5 architecture mutations (add, widen, change activation, remove, add) in every experiment that declares the editor. Also after every structural or parameter fuzz action (1,524 checks). | No violation on the shipped code. Fault injection: catches defect 8. |
| **C** Selection binding | `invariants.test.ts`: every node and edge of every experiment, at 6 cursor positions including mid-backward-pass (3 for the CNN). Also on the current selection after every fuzz action (4,737 checks). | No violation on the shipped code. Fault injection: catches defect 9 (the panel of a neighbouring element). The CNN half of defect 9 (dense indexing of a conv cell's bias and kernel) was found while writing C's expected values for the CNN. |
| **D** Reset | `invariants.test.ts`: every experiment in both modes, after moving, selecting and changing the step size, comparing the trace hash of the re-run. Also on every fuzz reset (1,354 checks). | No violation on the shipped code. |
| **E** Fuzz | `tests/fuzz/fuzz.test.ts` (CI job `fuzz`): 200 seeded sequences of 6 actions per experiment, 2,000 sequences and 12,000 actions in all, with A–D after each action. | **0 failing sequences** in the full run. To check that this zero is not vacuous, a reset that kept the selection was injected; E failed at once ("a selection survived the reset"). That sequence, minimised, is kept in `tests/fuzz/regressions.json` and replayed by `tests/unit/fuzz-regressions.test.ts`; it fails on the mutation and passes on the shipped code. |

### Defects from the cold review

The cold review (`docs/COLD-REVIEW.md`) found defects that A–E cannot see, because they concern meaning rather than binding. Ten were fixed in this round:

1. Experiment 6's chain-rule factors were stepped past at the default step size.
2. Its reveal claimed to be about the example now on screen.
3. The learning-rate and epoch selects showed 10 epochs for a 20-epoch run, and applying them would have trained for 10.
4. Epochs and mini-batches were counted from 0 in the narration and from 1 in the status line.
5. Log-axis ticks were clipped.
6. The status line dumped 784 pixel values.
7. The CNN cell computation printed "u = 0 = 0".
8. The set-up sentences said "you chose" where the learner chose nothing.
9. The "says" rule was not stated.
10. The footer used expert vocabulary on the Guided path.

The rest is logged as KG-R2b-1 to KG-R2b-7.

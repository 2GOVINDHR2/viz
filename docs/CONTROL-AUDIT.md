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
| Walkthrough | *Next*, *Previous*, *Hide*, *Show*, *Show me* (all 30 actions) | 5 | The step text changes and comes back. Every one of the 30 *Show me* actions changes the cursor, the step size or the run. |
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

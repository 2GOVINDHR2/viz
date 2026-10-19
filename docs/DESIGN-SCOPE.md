# Design Scope

**The audience: an undergraduate meeting neural networks for the first time — comfortable with programming, no machine-learning coursework, no familiarity with the vocabulary.**

This is the study population, so it is the design target by construction. Every decision about the novice path is filtered through it.

Two traps follow from it:
- **The team is not a proxy for this learner.** They know the tool and cannot see it fresh.
- **"Beginner-friendly" never means removing the depth.** It means not presenting the depth *first*.

The goal, in the supervisor's words, is to arouse curiosity and simplify as far as possible: guide learners along a path that makes them want the depth, rather than leaving them with a surface-level understanding.

## Why the redesign (Fix Round 2)

Human testing found the three-view workbench overwhelming for this audience: "to a beginner it would feel like an ordinary person looking at the cockpit of an aeroplane". Three defects were found alongside (`docs/CONTROL-AUDIT.md`).

This threatens the study. In the 30-minute intervention, a novice who spends the time decoding six step sizes, three views and a wall of tensor values learns less than one pressing *play* in TensorFlow Playground. It also contradicts the project's own frame: a cockpit is extraneous cognitive load by definition.

## Two paths, one engine

- **Novice path (the default).** Each experiment has a purpose-built screen that shows only what that experiment needs, in the vocabulary the learner has met so far.
- **Expert mode.** The three-view workbench, unchanged in what it offers.
  - It is reachable from every screen (*Expert mode* in the header, or *Open the full workbench* under "Going deeper") and by URL (`?mode=expert`).
  - Switching keeps the trace and the cursor, so the position is preserved in both directions.
  - The choice is remembered per learner in `localStorage`, defaulting to novice.
  - Study Mode pins the starting mode for every C3 participant (`c3StartMode`, default novice).

Everything is a presentation layer over the Neural Program Model. The engine, IR, trace format, schema and all validation evidence are unchanged.

## The five principles

1. **Question first.** A screen opens with one question and one control, never a dashboard.
2. **One thing on screen.** One view to start. A second view appears only on request, with one line on why a second perspective helps.
3. **Detail revealed in place, not chosen at the door.**
   - Each panel has its own *show the numbers*, *show the maths* or *add a view*.
   - The Simple/Detailed control remains, as a global default for returning users. It never gates entry.
4. **Vocabulary follows the curriculum.**
   - `src/experiments/vocabulary.ts` maps each term to the experiment that introduces it.
   - `tests/unit/vocabulary.test.ts` renders every purpose-built screen, and its narration at every step of two epochs, and fails on any term used before it is taught.
   - Technical terms (instruction, operation, granularity, trace, tensor) are kept to expert mode.
5. **Each experiment declares its surface.**
   - `surface.granularities` lists the step sizes offered on the novice path; `surface.architectureEditor` says whether the layer editor exists.
   - Anything not declared does not render, and the keyboard cannot reach it either (`tests/e2e/controls.spec.ts`).

## Step sizes unlocked by the curriculum

| Level | Learner-facing label | First offered in |
|---|---|---|
| operation | one calculation | 1 Single neuron |
| layer | one layer | 3 Forward propagation |
| sample | one example | 5 Gradient descent |
| batch | one batch | 5 Gradient descent (batch-size step) |
| phase | forward / backward / update | 6 Back-propagation |
| epoch | one full pass | 7 XOR with an MLP |

- By the CNN experiment all six are available.
- When a screen offers one level, it shows a single *Next* button, not a selector.
- Expert mode always offers all six under their technical names, with the learner-facing label as secondary text.
- `tests/unit/surface.test.ts` fails if an experiment offers a level before the experiment that teaches it.

## Predict, then reveal

At the moment that matters most in an experiment, the learner commits to a prediction with one click, before the run. Then the screen says plainly whether it held, and why, from the run's own numbers.

- Predictions, revisions and outcomes go to telemetry, as a secondary measure and an engagement signal.
- They are never concept-inventory items; the inventory is frozen.

## The screen template

1. The question.
2. The minimum control.
3. The prediction.
4. The observation: one view, narrated in one sentence per step.
5. The reveal.
6. Going deeper: numbers, maths, a second view, expert mode.
7. The self-check, then the handoff, a sentence naming the next experiment's question.

## Status (30 October boundary)

| Experiment | Novice screen | Prediction | Notes |
|---|---|---|---|
| 1 Single neuron | **rebuilt** | raising the bias moves all four outputs (up / down / same) | sliders for w₁, w₂, b; outputs table from the trace; "let it learn"; decision line as the second view |
| 5 Gradient descent | **rebuilt** | each new learning rate: lower / same / higher / blows up; each batch size: steps per pass | loss surface with the path; batch size as the second control, with the batch-size walkthrough text of Fix Round 1 |
| 6 Back-propagation | **rebuilt** | this example pushes the followed weight up / down / hardly | one path through the chain rule; each factor appears when the backward pass computes it, and the product is checked against the engine's gradient |
| 2, 3, 4, 7, 8, D1, D2 | not yet | — | Shown in the workbench, filtered by the declared surface: offered step sizes only, breakpoints behind *More controls*, no export panel. A note says the beginner screen is in progress. |

The remaining seven screens, C1 regeneration, full telemetry and the accessibility re-audit of every new screen are scheduled for November–December (Fix Round 2, Part 5).

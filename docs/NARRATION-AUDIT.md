# Narration Audit (Fix Round 2c)

**The defect class audited here:** a label or narration string that asserts behaviour the run does not produce.

**What triggered it:** D2 captioned its η = 0.95 run "overshoots back and forth / oscillating" while showing a loss that falls smoothly every epoch.

**The method:**
1. Read every narration string shown in an experiment.
2. Separate those that assert something about the run from those that define, instruct or describe the interface.
3. Check every run claim against the run itself.

The checks are `tests/unit/claims.test.ts`, which is new, plus the existing tests named in the tables below.

## Counts

| Source | Strings read | Run claims | Defects found |
|---|---|---|---|
| Walkthrough steps (all 10 experiments) | 44 | 34 | 3, counting D2's |
| Intros | 10 | 5 | 1 |
| Objectives | 10 | 2 | 1 (D2) |
| D2 panel verdict labels | 4 | 4 | 1 (D2) |
| Explainer templates (26 sentences, 6 details, 6 control narrations) | 38 | 6 | 3 |
| Novice-screen narration, reveals, "why" lines and handoffs (experiments 1, 5, 6) | 46 | 4 | 0 |
| **Total** | **152** | **55** | **9 strings, in 7 defects** |

The self-check questions were not counted, because they are not narration. D2's self-check item lr1 asserted the same false behaviour and was corrected with it.

## Defects found and fixed

| # | Where | Claimed | What the run does | Fix |
|---|---|---|---|---|
| 1 | **D2:** walkthrough step 2, panel verdict, objective, self-check lr1 (the reported defect) | η = 0.95 is "fast but oscillating"; a too-large rate makes the loss "zig-zag up and down". | The loss falls every epoch, more slowly than at 0.3. The **bias** swings across the valley (−3.2, 1.0, −2.8, 0.66 … around −0.97). With full-batch steps on this quadratic loss, no stable rate makes the loss itself oscillate (measured for 0.02–0.95; at ≥ 1.0 the loss grows). | The label was changed to match the behaviour, since no setting can make the curve match the old label. The loss surface with the main run's path was added to D2, and step 2 now runs eight epochs so the swing is on screen. The verdict reads "too large: steps overshoot, so the loss falls more slowly". The self-check now describes a slower fall and a swinging path. C1 slides were regenerated. |
| 2 | **Experiment 1, walkthrough step 5** | At the end, the output is "≈ 1 only for (1, 1)". | At (1, 1) the output is 0.71; the other three are at most 0.20. | "above 0.5 only for (1, 1)" |
| 3 | **Experiment 7 intro** | "20 of 20 seeds solve XOR within 100 epochs; with 2 hidden units only 9 of 20 do." | With 2 hidden units, 3 of 20 solve it within 100 epochs. The sweep's 9 of 20 counts runs of up to 400 epochs (median 116). | "with 2 hidden units only 9 of 20 solve it even in 400" |
| 4 | **D1, walkthrough step 2** | The early layers' gradients are "thousands of times smaller". | They are 45,000–300,000 times smaller (ratio 3 × 10⁻⁶ to 2.2 × 10⁻⁵ at every epoch). | "tens of thousands of times smaller", checked as a ratio below 10⁻⁴ |
| 5 | **Explainer, batch loss** | "The update that follows lowers this average." | At η = 1.1 it raises it, every epoch. | "is aimed at this average … whether it actually lowers it depends on the learning rate" |
| 6 | **Explainer, parameter update** | "making it smaller lowers the loss" | True only for a small enough step; at η = 1.1 the step raises the loss. | "making it a little smaller lowers the loss" |
| 7 | **Explainer, initialisation detail** | The scaled initialisation means "signals neither explode nor vanish". | D1's gradients vanish with exactly this initialisation. | "less likely to explode or vanish … deep sigmoid networks can still suffer vanishing gradients; see D1" |

**A related hollow test.** `tests/unit/experiments.test.ts` already had a test called "D2 … oscillating", which asserted only the final losses. Nothing in it checked oscillation, so the false label passed. It is renamed. `claims.test.ts` now checks the behaviour itself: the bias reverses on more than 80 % of steps, the loss is monotone, and it stays above the η = 0.3 loss at every epoch.

**Frozen, not changed: inventory CI15.** Its rationale says too-large steps "make the loss oscillate and diverge". `docs/INVENTORY-COVERAGE.md` records how CI15's coverage changes after the D2 correction.

## Every run claim and its check

Unless another test is named, the check is in `claims.test.ts`.

| Experiment | Claim | Check |
|---|---|---|
| 1 | W2–W3: from the first example, one step is MATMUL, then ADD_BIAS and ACTIVATE; the output is in (0, 1) | kinds and value from the trace |
| 1 | W5: above 0.5 only for (1, 1); AND | trained parameters |
| 1 | Novice "let it learn": 60 passes | configuration |
| 2 | Intro, W2: w = 4, x = −4, z = −16, slope ≈ 0 | first ACTIVATE |
| 2 | W3: ReLU slope 0 for z < 0 | first GRAD_ACTIVATE with ReLU |
| 2 | W4: w = 0.5 keeps z near 0 and the gradient larger | gradient more than 100 times larger |
| 3 | W1: step size starts at "layer" | configuration |
| 3 | W2/W4: one layer step computes all of layer 1, then all of layer 2 | navigator and state |
| 4 | W2: squared error ≤ 1, cross-entropy unbounded | formula |
| 4 | W3: cross-entropy is steeper for confident mistakes | formula |
| 5 | W1: a batch is all 50 points | configuration |
| 5 | W2: downhill every step at η = 0.3 | monotone loss |
| 5 | W3: 0.02 is still far after 40 epochs | `experiments.test.ts` |
| 5 | W4, novice reveal: at 0.9 the path zig-zags but converges | bias reversals, final loss |
| 5 | W4: at 1.1 the loss grows over a million-fold and stays finite | `experiments.test.ts` |
| 5 | W5–W6: B = 5 makes 10 updates per epoch on a wobblier path | `experiments.test.ts` (TR04) |
| 6 | W1–W4: GRAD_INIT, GRAD_ACTIVATE (output layer), the layer-2 gradients, GRAD_MATMUL_X | trace order |
| 6 | Novice chain: the product equals the engine's gradient | computed on screen; `novice.test.ts` |
| 7 | W1: one neuron cannot learn XOR | trained |
| 7 | W2: slow start, separated by epoch 40 | accuracy per epoch |
| 7 | W3: 100 % at the end | `experiments.test.ts` |
| 7 | W4: one hidden unit stays below 100 % | `experiments.test.ts` |
| 7 | Intro: sweep counts | 20 seeds × 2 widths, retrained |
| 8 | Intro, W4, W5: 26 × 26 = 676 positions, pooling halves, 300 test digits | shapes, dataset |
| 8 | W6: ≥ 90 % on held-out digits (C3 objective) | `experiments.test.ts` |
| D1 | Intro, W2: the early-layer gradient is tens of thousands of times smaller | ratio below 10⁻⁴ at every epoch |
| D1 | W3, objective: with ReLU, similar shades | ratio between 0.1 and 10 at every epoch |
| D1 | W1: running to the vanishing breakpoint stops there | `runToBreakpoint` |
| D2 | Intro: same problem and start as experiment 5 | configuration |
| D2 | W1: 0.02 slow and far from done; 0.3 fast and smooth | monotone; 100 times apart |
| D2 | W2: 0.95 bias swings, loss falls, slower than 0.3 | reversals, monotone, per epoch |
| D2 | W2: 1.1 grows every epoch | per epoch |
| D2 | W3: the exploding breakpoint fires at 1.1 | `runToBreakpoint` |
| D2 | Four verdict labels | `lrVerdict` and the curves |
| Explainers | Batch loss, update and initialisation wording (defects 5–7); "the same seed gives the same values"; evaluation on the whole training set; "parameters change once per batch" | η = 1.1 run; determinism suite; EVAL `meta.n`; trace grammar |

The remaining 97 strings make no claim about the run. They are definitions ("a bias adds directly to z"), instructions ("Click a hidden neuron"), interface descriptions ("The panel shows …", covered by the e2e control audit), or values printed from the run itself, which cannot disagree with it.

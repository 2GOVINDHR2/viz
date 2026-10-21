# Concept Inventory Coverage

Where each concept-inventory item's content is taught in each study condition (Fix Round 1, A3). Items measuring content that no condition teaches add noise and can only shrink the observed effect, so every item was checked against the curriculum (`docs/CURRICULUM-COVERAGE.md`), the C1 pages (generated from each experiment's walkthrough, `npm run slides`), the C2 TensorFlow Playground sheet (`src/study/config/playground-sheet.json`, tasks pg1–pg9) and the C3 experiments.

Legend: **✓** taught directly · **◐** partly (touched, or shown without the specific quantity) · **—** not taught. C1 = static pages of the experiment named; C3 = the live experiment; C2 = Playground task, or the CNN pages from C1 that the C2 sheet links to (pg8).

| Item | Concept (cluster) | C3 DL-VizLab | C1 static pages | C2 Playground sheet | Decision |
|---|---|---|---|---|---|
| CI01 | perceptron (fundamentals) | ✓ E1 single neuron: weighted sum with numbers | ✓ E1 pages | ✓ pg1 (hover weights; "how does the output neuron combine X₁ and X₂") | keep |
| CI02 | perceptron | ✓ E1 (bias shown and editable) | ✓ E1 | ◐ pg1 (boundary is a line; bias not discussed) | keep |
| CI03 | activation | ✓ E2 activation panel | ✓ E2 | ✓ pg2 (activation choices) | keep |
| CI04 | activation | ✓ E2, E7 | ✓ E2, E7 | ✓ pg2 (linear network cannot separate the circle) | keep |
| CI05 | activation | ✓ E2 (saturation walkthrough), D1 | ✓ E2, D1 | ◐ pg9 (slow early layers) | keep |
| CI06 | forward_propagation | ✓ E3 (layer-by-layer values) | ✓ E3 | ◐ pg3 (hidden-unit pictures, no numbers) | keep |
| CI07 | forward_propagation | ✓ E3 | ✓ E3 | ✓ pg3 | keep |
| CI08 | loss (optimisation) | ✓ E4 MSE vs cross-entropy panel | ✓ E4 | ◐ pg4 (loss values only) | keep |
| CI09 | loss | ✓ E4 (MSE formula with numbers) | ✓ E4 | — Playground shows no loss formula | keep (C2 asymmetry, as for CNNs) |
| CI10 | gradient (backpropagation) | ✓ E5, E6 | ✓ E5, E6 | ◐ pg5 question on update direction | keep |
| CI11 | gradient | ✓ E5 (Δw = −η·g with numbers) | ✓ E5 | ◐ pg5 | keep |
| CI12 | chain_rule | ✓ E6 back-propagation | ✓ E6 | ◐ pg6 question | keep |
| CI13 | chain_rule | ✓ E6 (substituted chain-rule formulas) | ✓ E6 | — | keep (C2 asymmetry) |
| CI14 | chain_rule | ✓ D1 vanishing gradients | ✓ D1 | ✓ pg9 | keep |
| CI15 | learning_rate (optimisation) | ✓ E5, D2 (the loss grows at η = 1.1; see the note below) | ✓ E5, D2 | ✓ pg5 | keep |
| CI16 | learning_rate | ✓ D2 (four rates, divergence) | ✓ D2 | ◐ pg5 (η = 3 and 10 diverge) | keep |
| CI17 | weight_update (optimisation) | ✓ E6 ("what changed", Δ overlays) | ✓ E6 | ◐ pg6 | keep |
| CI18 | overfitting | — (only the CNN's held-out curve, without a gap) | — | ◐ pg4 (training vs test loss) | **retired** (ADR-032) |
| CI19 | convolution (convolutional) | ✓ E8 (28×28 → 26×26 shown) | ✓ E8 | ✓ pg8 → E8 pages | keep |
| CI20 | pooling | ✓ E8 | ✓ E8 | ✓ pg8 → E8 pages | keep |
| CI21 | convolution | ✓ E8 ("the same nine weights are used at every position") | ✓ E8 | ✓ pg8 → E8 pages | **new** (A4: third convolutional item) |
| TR01 | activation | ✓ E2 self-check (inactive ReLU passes back nothing) | ✓ E2 | ◐ pg2 (ReLU option) | keep (transfer) |
| TR02 | gradient | ◐ E8 (softmax + cross-entropy gradient at GRAD_INIT) | ◐ E8 | — | keep (transfer: application to a new case) |
| TR03 | convolution | ✓ E8 (parameter counts in the structure view) | ✓ E8 | ✓ pg8 → E8 pages | keep |
| TR04 | learning_rate | ✓ E5 walkthrough steps 5–6 (B = 50 → 5: 10 updates per epoch, wobbly path; ADR-037), self-check gd3, *Try it* batch size | ✓ E5 (same steps as slides) | ✓ pg5 batch-size step | keep (coverage added in the supplement) |
| TR05 | forward_propagation | — | — | — | **retired** (ADR-032) |

**Result.** 24 items administered (20 core, 4 transfer). Every administered item is taught in C3 and C1. C2 cannot teach CI09, CI13 and TR02. This is the same documented asymmetry as for CNN content (Playground shows neither formulas nor discrete steps), and it is reported in LIMITATIONS.

## Fix Round 2: C3 coverage on the novice path, item by item

C3 participants now start on the novice path (ADR-039, ADR-043). Experiments 2, 3, 4, 7, 8, D1 and D2 still use the workbench with their walkthroughs, so every item taught there keeps its source unchanged: CI03–CI09, CI14, CI16, CI19–CI21, TR01–TR03. The items whose C3 source is experiment 1, 5 or 6 were re-checked against the rebuilt screens. **No item is orphaned.** One item, CI11, needed the screen changed rather than the item.

| Item | Concept | Source on the novice screen | Status |
|---|---|---|---|
| CI01 | weighted input z = w·x + b | E1 narration steps through "Weighted sum: w₁·x₁ + w₂·x₂ = …" and "Add the bias: z = … + b = …" with the trace's numbers. *Show the numbers* adds the sum and z for every example; *Show the maths* gives z = w₁x₁ + w₂x₂ + b. | ✓ |
| CI02 | what the bias does | The E1 prediction asks what raising b does to the four outputs. Dragging b shows all four move together, and the reveal explains why: b is added to every example's sum. Self-check sn2 is unchanged. | ✓ (more direct than before) |
| CI10 | meaning of the gradient's sign | E5 narration: the averaged gradient "says which way is downhill", and each parameter moves by −η × gradient. The E6 reveal ties the sign of a weight's gradient to the direction it is pushed. | ✓ |
| CI11 | one gradient-descent step with numbers | E5 narration at each step: "For w: gradient g, so w moves by −η × g = Δ, from w to w′", with the trace's numbers (`tests/unit/novice.test.ts`). *Show the maths* gives w ← w − η ∂L/∂w. Before this change the novice screen had only the symbolic rule, so the narration was added for this item. | ✓ (fixed in this round) |
| CI12 | how back-propagation reaches a first-layer weight | E6 chain-rule panel: for the followed weight, the factors fill in as the backward pass computes them — output error, the weight back to the hidden neuron, that neuron's slope, the input — and their product equals the engine's gradient. | ✓ |
| CI13 | numerical chain rule with σ′ | The same panel with this example's numbers, plus *Show the maths* (∂ℓ/∂w¹ = ∂ℓ/∂z_out · w² · σ′(z¹) · x). | ✓ |
| CI15 | loss jumps and grows → learning rate too large | E5: choosing η = 1.1 asks for a prediction first, and the reveal explains overshooting, each step larger than the last. The walkthrough text was corrected to what the run shows (ADR-044). | ✓ |
| CI17 | direction of a weight's update | The E6 prediction asks whether this example pushes the followed weight up or down; the reveal gives the gradient and explains that the sign comes from the product of the chain's factors. | ✓ |
| TR04 | batch size: more updates, noisier steps | The E5 second control: batch size 50/10/5, with the Fix Round 1 batch-size walkthrough text, a prediction of steps per pass, and a reveal of the count and the wobble. | ✓ |

Every one of these screens also offers *Open the full workbench* (expert mode), where the original walkthrough and explanations remain.

**CI15 after the D2 correction (Fix Round 2c).** The stem's cue is "the loss jumps up and down and gets larger over time".
- **Before:** D2 labelled its η = 0.95 run "oscillating". The run's loss falls every epoch, so that label was false and is corrected: the oscillation is in the bias, shown on the loss-surface path. With full-batch steps on this quadratic loss, no stable rate makes the loss itself jump up and down.
- **Still taught, in both C1 and C3:** the item's keyed reasoning, a growing loss means the learning rate is too large. E5 and D2 run η = 1.1, and the loss grows every epoch; this is verified by `tests/unit/claims.test.ts`.
- **No longer taught by any condition:** the "jumps up and down" half of the cue. It was only ever taught by the false label.
- **Decision:** the item is kept, since the inventory is frozen. This partial coverage is flagged for the analysis.

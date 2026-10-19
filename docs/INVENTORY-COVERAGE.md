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
| CI15 | learning_rate (optimisation) | ✓ E5, D2 | ✓ E5, D2 | ✓ pg5 | keep |
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

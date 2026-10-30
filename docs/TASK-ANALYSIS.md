# Task Analysis

Twelve canonical questions a learner asks while studying how a network trains. For each tool we determine analytically whether the question is **answerable from what the tool displays** and, if so, the **minimum number of interactions** needed, starting from the tool's initial screen with a suitable network already loaded.

## Method

- **Interaction** = one click, key press, slider drag or selection. Reading the screen is free. Typing a number counts as one interaction.
- **Answerable** means the tool displays the specific quantity or event the question asks about; inferring it from an unrelated display (e.g. guessing a gradient from how fast a colour changes) does not count. A question is answerable "in principle only" (◐) when the information is displayed but only transiently or approximately.
- DL-VizLab counts are given for the end of P4 and for the **current build (end of P5)** and were checked by hand against the running app; the procedure for each is listed so it can be repeated. Counts for other tools follow from their published feature descriptions (see `COMPARISON-MATRIX.md` for sources and caveats) and assume the tool's best path. Each count is a lower bound for an expert user.
- Where a DL-VizLab answer depends on a view that is planned but not yet built (P5), it is counted as **not answerable today**, and the planned count is given separately.

## Results

| # | Learner question | Playground | CNN Explainer | GAN Lab | NeuroViz† | GNN 101‡ | DL-VizLab end of P4 | **DL-VizLab end of P5 (current)** |
|---|---|---|---|---|---|---|---|---|
| 1 | What is this neuron's weighted sum before the activation, for this example? | ✗ | ◐ (inference, one image) | ✗ | ✓ ~2 | ◐ ⁱ (per-node computation of one inference, not a neuron of an MLP) | **✓ 7** | **✓ 3** (inspector) |
| 2 | What output does the network give for this example, and what does it cost (loss)? | ◐ (aggregate loss only) | ✗ (no loss) | ◐ | ✓ ~2 | ◐ ⁱ (prediction, no loss) | **✓ 2** | ✓ 2 |
| 3 | Where does back-propagation start, and with what value? | ✗ | ✗ | ✗ | ✓ ~2 | ✗ | **✓ 2** | ✓ 2 |
| 4 | Why did this weight decrease after this batch? | ✗ | ✗ | ✗ | ◐ | ✗ | **✓ 4** | ✓ 3 |
| 5 | How much of the gradient passes through this sigmoid neuron, and why so little? | ✗ | ✗ | ✗ | ◐ | ✗ | **✓ 3** | ✓ 3 |
| 6 | Which layer has the smallest gradients? | ✗ | ✗ | ✗ | ◐ | ✗ | **✓ 4** (per example) | **✓ 1** (heatmap, View B) |
| 7 | What changed between epoch 3 and epoch 4? | ◐ (watch weights animate) | ✗ | ◐ | ✗ | ✗ | **◐ 4** (step epoch by epoch; read loss and weights) | **✓ 3** (epoch step + what-changed) |
| 8 | What exactly did the optimiser do with momentum this step? | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ 4** | ✓ 4 |
| 9 | At what point did training first produce NaN? | ✗ | ✗ | ✗ | ✗ | ✗ | **✓ 2** (NaN breakpoint on by default; run to breakpoint) | ✓ 2 |
| 10 | Can I go back and re-watch the backward pass of the previous example? | ✗ | n/a | ✗ | ✗ | ✗ | **✓ 2** | ✓ 2 |
| 11 | What does a convolution kernel compute at one position? | ✗ | ✓ ~2 (inference) | ✗ | ✗ | ✗ | ◐ (engine and explanation exist; no CNN view yet) | **✓ 3** (convolution view, P7) |
| 12 | Why can a single neuron not solve XOR while a hidden layer can? | ◐ (decision boundary visible) | ✗ | ✗ | ◐ | ✗ | **◐** (learning visible via accuracy; no decision-boundary panel yet) | **✓ 3** (decision boundary) |
| | **Answerable (✓)** | **0 / 12** | **1 / 12** | **0 / 12** | **≈4 / 12** | **0 / 12** | 9 / 12 | **12 / 12** |
| | **Answerable at least in principle (✓ or ◐)** | 4 / 12 | 3 / 12 | 3 / 12 | ≈7 / 12 | 2 / 12 | 12 / 12 | 12 / 12 |

† NeuroViz cells after Fix Round 1 (B3), checked against excerpts of the paper (Sharma & Rawassizadeh, arXiv:2605.02044: abstract and §7):
- **Verified from the paper:**
  - Q1 ✓: per-neuron equations update during training.
  - Q2 ✓: loss over time.
  - Q4 and Q7 ◐: weight changes and pre-/post-update states within an epoch are shown, but not the gradient that caused them.
  - Q11 ✗: fully connected networks only; CNNs are listed as future work.
- **Inferred:** Q3, Q5, Q6, Q8–Q10 and Q12 come from what the paper describes. Absence of a feature means it is not described.
- **Interaction counts:** all approximate.

‡ **GNN 101** (Lu et al., IEEE TVCG 32(2), 2026; added in Fix Round 3, B2.1). Coded from the paper's abstract and project description: a browser tool that explains the *inference* of graph neural networks at several levels of abstraction (model overview, layer operations, detailed matrix calculation) in node-link and matrix views. Every training question (Q3–Q10) is ✗ because training is not shown; Q11 and Q12 concern a CNN and an MLP, which it does not cover. Q1 and Q2 are ◐: the per-node computation and the prediction are shown, for a GNN, without a loss. The brief asked for GNN 101 as a *row*; in this table tools are columns, so it is a column (ADR-061). Transformer Explainer and AnimatedLLM are not added: both explain inference of a pre-trained transformer, so every training question is ✗ for them by construction and Q1, Q2, Q11 and Q12 concern architectures they do not show; COMPARISON-MATRIX carries them.

The live tool (neuroviz.org) could not be reached from the build environment, so no cell is verified against it; see PAPER-NOTES §8.

## DL-VizLab procedures (current build)

Each procedure starts on the loaded experiment at instruction 0. Keys: `→` step forward, `←` step back, `1`–`6` granularity.

1. Tick "back-propagation starts" (1) and "To breakpoint" (2): the first example's forward pass is complete. Select Layer (3) and press `←` twice (5) to reach the end of layer 1's forward pass; select Operation (6) and press `←` twice (7) to `ADD_BIAS`, whose explanation shows z = u + b for the focused neuron with numbers (clicking the neuron to focus it can replace the default focus at no extra step if it is neuron 1). **7.** The planned click-for-detail panel (P5) shows z, a and the contributing computation for a clicked neuron in 3.
2. Tick breakpoint (1), To breakpoint (2): the loss box and the output neuron show prediction and ℓ. **2.**
3. Tick breakpoint (1), To breakpoint (2): `GRAD_INIT` with its explanation and substituted value. **2.**
4. Select Phase (1); step to the update phase with `→` — at full batch this is 4–5 steps; faster: tick nothing, drag the position slider into the first batch's update block (1–2), press `→` at operation granularity to the `APPLY_UPDATE` (1–2). The explanation states "This value decreased because its gradient was positive…" with the numbers. **4.**
5. Tick breakpoint (1), To breakpoint (2), `→` (3): `GRAD_ACTIVATE` for the output; its explanation gives σ′(z) and the fraction passed through; for a saturated unit it explicitly says how much passes. **3.**
6. Tick breakpoint (1), To breakpoint (2), select Example (3), `→` (4): the example's backward pass is complete and every neuron shows its `∂ℓ/∂z`; compare layers. **4** (per example only).
7. Select Epoch (1), `→` to the end of epoch 3 (2–3), `→` once more (4): the summary shows the new loss and accuracy, edges show the new weights; there is no explicit delta display yet (◐).
8. On the momentum architecture: Phase (1), position slider into an update block (2), `→` (3–4): `OPTIMIZER_STATE` and `COMPUTE_UPDATE` explanations show v ← μv + ḡ and Δ = −ηv with numbers. **4.**
9. "NaN or infinity" is ticked by default; "To breakpoint" (1) stops at the first non-finite value with a reason; reading it is free. Choosing an experiment that diverges is (1). **2.**
10. Select Example (1), `←` (2). **2.**
11. The engine emits `CONV2D` with explanations, but no CNN experiment is selectable in the UI yet (◐).
12. Run the single-neuron experiment and XOR to the end and compare accuracies; the reason is visible only indirectly until the decision-boundary panel (P5) (◐).

## Reproducibility

The question list, the interaction definition and the procedures above are complete; any reader can repeat the DL-VizLab counts in the deployed app. Counts for the other tools should be re-checked by a second rater against the live tools before publication; disagreements are expected to shift individual cells by ±1 interaction but not the ✓/✗ classification, which follows from what each tool displays at all.

## DL-VizLab procedures added in P5

1. Tick "back-propagation starts" (1), "To breakpoint" (2), click the neuron (3): the inspector lists u, b, z = u + b, a, ∂ℓ/∂a, ∂ℓ/∂z with the full weighted-sum computation. **3.**
6. Drag the position slider to the end (1): the "Gradient magnitude per layer, by epoch" heatmap shows every layer's mean weight-gradient norm for every epoch; the palest row is the answer. **1.**
7. Select Epoch (1), click the loss chart at epoch 3 (2), press → (3): "What changed since the previous step" lists the change of every parameter (largest element) and the evaluation loss before and after. **3.**

12. On XOR, drag the slider to the end (1): the decision boundary shows the curved two-part boundary; switch to "A single neuron learns AND" (2) and drag to the end (3): the boundary is a single straight line. **3.**

## DL-VizLab procedure added in P7

11. Open "A CNN on handwritten digits" (1), drag the position slider into a training batch (2), click any cell of a feature map (3): the input shows the 3×3 receptive field, the kernel is outlined, and the window line gives u = Σ x·k with its value next to the trace's own u for that cell. **3.**

# Comparison Matrix

DL-VizLab against the four closest prior systems, along the dimensions that define its contribution (B2). The structure mirrors the comparison table of the CS-OLabs base paper (Swaminathan et al., 2025).

**Sources and caveats.** Rows for prior systems summarise their published descriptions: Smilkov et al. (2017) for TensorFlow Playground; Wang et al. (2020) for CNN Explainer; Kahng et al. (2018) for GAN Lab; and, for NeuroViz (Rawassizadeh & Sharma, arXiv:2605.02044, 2026), the summary given in this project's brief — the authors of this document have not independently verified the NeuroViz paper and the row must be checked against it before publication. Cells marked † should be confirmed against the cited paper or the live tool. DL-VizLab cells state what is **implemented and tested in this repository today** (v0.1, end of P4); planned items are labelled with their phase and are not claimed as done.

| Dimension | TensorFlow Playground | CNN Explainer | GAN Lab | NeuroViz | **DL-VizLab** |
|---|---|---|---|---|---|
| Training or inference | Training | Inference only (pre-trained TinyVGG) | Training (GAN) | Training | **Training** |
| Execution granularity levels | Continuous run; a single-step button advancing one training iteration † | None (static network, interactive views of one inference) | Continuous, plus a slow-motion mode separating discriminator and generator update steps † | Real-time forward/backward animation (per brief) | **Six: operation, layer, phase, example, batch, epoch** — forward and backward stepping at each, jump to any of up to 10⁵ positions |
| Backward-pass visibility | No (weights and outputs only) | No | Partial: gradient directions on generated samples † | Yes, per-neuron (per brief) | **Yes: every gradient instruction (∂ℓ/∂ŷ, ∂ℓ/∂z, ∂ℓ/∂W, ∂ℓ/∂b, ∂ℓ/∂a, conv and pool gradients), per example, with values and explanations** |
| Parameter-update visibility | Implicit (edge colours change) | No | Implicit † | Not stated in brief | **Explicit: per-parameter batch-mean gradient, optimiser state (momentum), step Δ, before → after values** |
| Architecture families | Fully connected, 2-D inputs | CNN (one fixed model) | GAN with small MLPs | Fully connected | **Fully connected and convolutional (conv2d with stride/padding, max/avg pooling, flatten) in the engine and IR; CNN views planned (P7)** |
| Formal intermediate representation | No | No | No | No (bespoke renderer, per brief) | **Yes: the Neural Program Model — 30 typed instruction kinds, JSON Schema, grammar, lossless serialisation, independent verifier and second consumer (NPM-SPEC)** |
| Extensibility mechanism | Source edits | Source edits | Source edits | Not stated | **Four documented registration points; LayerNorm added without editing any existing file (tested)** |
| Explanations | Tooltips | Interactive formulae for one inference step (convolution, ReLU, pooling, softmax) | Annotations | Per-neuron equations (per brief); embedded explanations listed as future work | **Generated for every instruction: general formula, same formula with that step's numbers, plain-language sentence; two verbosity levels** |
| Curriculum structure | No (free exploration) | No | No | No; beginner walkthroughs listed as future work (per brief) | **2 experiments runnable (P4); 10-experiment graded curriculum with prerequisites and walkthroughs planned (P6)** |
| Deterministic replay | No seed control exposed † | n/a (inference) | No † | Not stated | **Yes: same seed and configuration ⇒ byte-identical trace (SHA-256 checked in CI); time travel by checkpoint + recomputation** |
| Correctness evidence for the engine | Not reported † | n/a (pre-trained) | Not reported † | Not stated | **Finite-difference gradcheck of every op and 9 whole models; TF.js parity on 7 architectures over ≥ 100 steps (max deviation ≈ 10⁻⁷)** |
| Breakpoints / failure diagnosis | No | No | No | Not stated | **Conditional breakpoints: NaN/∞, vanishing (all \|g\| < τ) and exploding gradients, weight sign change, loss plateau, instruction kind, layer, epoch** |
| Measured learning outcome | Not reported † | Observational user study † | Not reported † | 31-participant study, SUS 80.97 (per brief); learning outcomes listed as future work | **Planned: three-condition randomised pre/post study with ANCOVA (STUDY-PROTOCOL); analysis pipeline validated on simulated data. No outcome measured yet.** |
| Platform | Browser | Browser | Browser | Browser | Browser, client-only, no network calls |

## What the matrix supports — and what it does not

- The defensible differences today are the **formal IR with mechanised verification**, **six-level bidirectional stepping with deterministic replay**, **explicit backward-pass and update visibility with generated explanations**, and **engine correctness evidence**.
- CNN *visualisation* (P7), the *graded curriculum* (P6) and a *measured learning outcome* (P8 study) are not yet delivered; until they are, the matrix must not be read as claiming them.

## References

- Kahng, M., Thorat, N., Chau, D. H., Viégas, F. B., & Wattenberg, M. (2018). GAN Lab: Understanding complex deep generative models using interactive visual experimentation. *IEEE TVCG*, 25(1).
- Rawassizadeh, R., & Sharma, — (2026). NeuroViz. arXiv:2605.02044 (as cited in the project brief; author list to be completed from the paper).
- Smilkov, D., Carter, S., Sculley, D., Viégas, F. B., & Wattenberg, M. (2017). Direct-manipulation visualization of deep networks. *ICML Workshop on Visualization for Deep Learning*.
- Swaminathan et al. (2025). CS-OLabs. *SN Computer Science*, 6:284.
- Wang, Z. J., Turko, R., Shaikh, O., Park, H., Das, N., Hohman, F., Kahng, M., & Chau, D. H. (2020). CNN Explainer: Learning convolutional neural networks with interactive visualization. *IEEE TVCG*, 27(2).

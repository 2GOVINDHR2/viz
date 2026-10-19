# Comparison Matrix

DL-VizLab against the four closest prior systems, along the dimensions that define its contribution (brief B2).

**Coding** follows the comparison table of the CS-OLabs base paper (Swaminathan et al., 2025, Table 5): **Y** = Yes, **N** = No, **L** = Limited.

**Source of each prior-system cell** (Fix Round 1, B3; details in `docs/PAPER-NOTES.md` §8):
- ᵖ verified from the system's paper;
- ⁱ analytical inference from what the paper describes (absence of a feature that is not mentioned);
- † not verified in this round and to be checked against the paper or live tool.

DL-VizLab cells describe what is implemented and tested in this repository.

## Feature comparison (Y / N / L)

| Feature | TensorFlow Playground | CNN Explainer | GAN Lab | NeuroViz | **DL-VizLab** |
|---|---|---|---|---|---|
| Visualises **training** (not only inference) | Y | N ᵖ (pre-trained TinyVGG, inference) | Y | Y ᵖ | **Y** |
| Learner-controlled discrete stepping | L † (single-step button, one iteration) | N | L † (step through discriminator/generator updates) | L † (before/after states of an update within an epoch ᵖ; stepping controls not verified) | **Y** (six granularities, forwards and backwards) |
| Backward pass visible | N † | N | L † | Y ᵖ (weight changes in forward and backward passes) | **Y** (every gradient, per example, with values) |
| Parameter updates visible | L † (edge colours change) | N | L † | Y ᵖ (pre- and post-update states) | **Y** (batch gradient, momentum, Δ, before → after) |
| Convolutional networks | N | Y ᵖ (one fixed model, inference) | N | N ᵖ (fully connected only; CNNs listed as future work) | **Y** (training a CNN on reduced MNIST, convolution view) |
| Formal, serializable intermediate representation | N ⁱ | N ⁱ | N ⁱ | N ⁱ | **Y** (Neural Program Model: schema, grammar, lossless files, independent verifier) |
| Embedded explanations | L † (tooltips) | Y ᵖ (interactive formulas for one inference) | L † | L ᵖ (per-neuron equations; embedded explanations listed as future work) | **Y** (general formula, substituted numbers, sentence, for every instruction) |
| Graded curriculum / guided walkthroughs | N | N | N | N ᵖ (beginner walkthroughs listed as future work) | **Y** (10 experiments with prerequisites, walkthroughs, self-checks) |
| Deterministic replay of a run | N † | n/a | N † | N ⁱ | **Y** (byte-identical trace from a seed; SHA-256 checked in CI) |
| Failure diagnosis (pathology breakpoints) | N ⁱ | n/a | N ⁱ | N ⁱ | **Y** (NaN/∞, exploding, vanishing, dead ReLU, divergence) |
| Ease of extension | L † (source edits) | L † | L † | N ⁱ (not described) | **Y** (four registration points; LayerNorm added without editing existing files, tested) |
| Learning-outcome evaluation | N † | L † (observational study) | N † | L ᵖ (31 participants: SUS 80.97, perceived transparency; learning outcomes over time listed as future work) | **L** (three-condition pre/post study fully instrumented and analysis validated on simulated data; **no outcome measured yet**) |

The base paper's Table 5 rates CS-OLabs itself **L** on ease of extension. The NPM's registration points address exactly that limitation (`docs/ARCHITECTURE-LINEAGE.md`).

**Alignment still to do.** The base paper was not accessible from the build environment (Fix Round 1, B4). The rows above are DL-VizLab's contribution dimensions coded with the paper's Y/N/L legend; the paper's own eight Table 5 feature names have not been copied. A team member with the paper should rename or merge rows to match Table 5 exactly, keeping the cells' evidence.

## NeuroViz's stated future work, and where DL-VizLab stands

NeuroViz's §7 lists, among its future work, convolutional and recurrent architectures, embedded explanations, beginner walkthroughs and a longitudinal study of learning outcomes (verified from the paper). It also lists keeping the visualisation visible during configuration and uploading pre-trained models with diagnostic feedback.

| NeuroViz future work | DL-VizLab |
|---|---|
| Convolutional architectures | Delivered: CNN training on reduced MNIST with a convolution view (experiment 8) |
| Recurrent architectures | Not delivered (non-goal of this project) |
| Embedded explanations | Delivered: generated for every instruction, at two levels of detail |
| Beginner walkthroughs | Delivered: every experiment has a guided walkthrough and self-check |
| Study of learning outcomes | Instrumented (Study Mode, pre-registered analysis), not yet run; a single-session pre/post design, not longitudinal |

## Detailed comparison

| Dimension | TensorFlow Playground | CNN Explainer | GAN Lab | NeuroViz | **DL-VizLab** |
|---|---|---|---|---|---|
| Execution granularity | Continuous run; single-step button † | None (one inference, interactive views) | Continuous, with a slow-motion step mode † | Real-time animation; before/after comparison within an epoch ᵖ | **Six levels: operation, layer, phase, example, batch, epoch**; forwards and backwards; jump anywhere |
| Architecture families | Fully connected, 2-D inputs | CNN (one fixed model) | GAN with small MLPs | Fully connected ᵖ | **Fully connected and convolutional** (conv2d with stride/padding, max/average pooling, flatten) |
| Correctness evidence for the engine | Not reported † | n/a (pre-trained) | Not reported † | Not reported ⁱ | **Finite-difference gradcheck of every op and 9 whole models; TF.js parity on 8 architectures over ≥ 100 steps** |
| Usability evidence | — | Observational study † | — | SUS 80.97, n = 31 ᵖ | Not yet measured (SUS and NASA-TLX instrumented in Study Mode) |
| Platform | Browser | Browser | Browser | Browser (neuroviz.org) | Browser, client-only, no network calls |

## References

- Kahng, M., Thorat, N., Chau, D. H., Viégas, F. B., & Wattenberg, M. (2018). GAN Lab: Understanding complex deep generative models using interactive visual experimentation. *IEEE TVCG*, 25(1).
- Sharma, T., & Rawassizadeh, R. (2026). NeuroViz: Real-time interactive visualization of forward and backward passes in neural network training. arXiv:2605.02044 (v2, 23 May 2026). Author order as on the arXiv abstract page; one listing shows Rawassizadeh first.
- Smilkov, D., Carter, S., Sculley, D., Viégas, F. B., & Wattenberg, M. (2017). Direct-manipulation visualization of deep networks. *ICML Workshop on Visualization for Deep Learning*.
- Swaminathan, J., Kavitha, K. R., Sibin, B., & Nedungadi, P. (2025). A multi-aspect visualization framework for advancing STEM pedagogy and SDG4: Digital India's Computer Science OLabs. *SN Computer Science*, 6, 284. https://doi.org/10.1007/s42979-025-03735-6
- Wang, Z. J., Turko, R., Shaikh, O., Park, H., Das, N., Hohman, F., Kahng, M., & Chau, D. H. (2020). CNN Explainer: Learning convolutional neural networks with interactive visualization. *IEEE TVCG*, 27(2).

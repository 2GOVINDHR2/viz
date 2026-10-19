# Comparison Matrix

DL-VizLab against the four closest prior systems, along the dimensions that define its contribution (brief B2).

## Feature comparison (Y / N / L)

Rows 1–8 are the features of the base paper's Table 5 (*"Features supported by CS-OLabs and other tools"*), in its order and wording, so that the two papers read as one research line. Rows 9–17 are the dimensions that carry DL-VizLab's contribution. Legend as in the base paper: **Y** = Yes, **N** = No, **L** = Limited.

| # | Feature | **DL-VizLab** | TensorFlow Playground | CNN Explainer | GAN Lab | NeuroViz |
|---|---|---|---|---|---|---|
| 1 | Multi-language | N ¹ | N | N | N | N |
| 2 | Multi-visualization | **Y** (three synchronised views + explanation) | Y † (network, output surface, loss curve) | Y ᵖ (overview and detail views) | Y † | Y ⁱ (network with activations and weights; loss over time ᵖ) |
| 3 | User navigation | **Y** (six granularities, forwards and backwards, jump anywhere) | L † (single-step button) | Y ᵖ (between overview and detail of one inference) | L † | L † (before/after states of an update within an epoch ᵖ) |
| 4 | Interactive visualization | **Y** | Y | Y ᵖ | Y | Y ᵖ |
| 5 | Runtime visualization | **Y** (of training) | Y | L ᵖ (one inference of a pre-trained model) | Y | Y ᵖ |
| 6 | Integration with IDE | N | N ⁱ | N ⁱ | N ⁱ | N ⁱ |
| 7 | Ease of usage | L ² | Y † | Y † | Y † | Y ᵖ (SUS 80.97, n = 31) |
| 8 | Ease of extension | **Y** (four registration points; LayerNorm added without editing existing files, tested) | L † (source edits) | L † | L † | N ⁱ (not described) |
| 9 | Training visualised (not only inference) | **Y** | Y | N ᵖ | Y | Y ᵖ |
| 10 | Execution granularity levels | **Y** (operation, layer, phase, example, batch, epoch) | L † | N | L † | L † |
| 11 | Backward-pass visibility | **Y** (every gradient, per example, with values) | N † | N | L † | Y ᵖ |
| 12 | Parameter-update visibility | **Y** (batch gradient, momentum, Δ, before → after) | L † (edge colours change) | N | L † | Y ᵖ |
| 13 | Architecture families | **Y** (fully connected and convolutional, training) | L (fully connected, 2-D inputs) | L ᵖ (one fixed CNN, inference) | L (GAN with small MLPs) | L ᵖ (fully connected only) |
| 14 | Formal, serializable intermediate representation | **Y** (Neural Program Model) | N ⁱ | N ⁱ | N ⁱ | N ⁱ |
| 15 | Curriculum structure (graded experiments, walkthroughs) | **Y** (10 experiments with prerequisites, walkthroughs, self-checks) | N | N | N | N ᵖ (beginner walkthroughs listed as future work) |
| 16 | Deterministic replay | **Y** (byte-identical trace from a seed; SHA-256 in CI) | N † | n/a | N † | N ⁱ |
| 17 | Measured learning outcome | L ³ | N † | L † (observational study) | N † | L ᵖ (SUS and perceived transparency; learning outcomes listed as future work) |

¹ The base paper's tools visualise programs written in several programming languages. None of the deep-learning tools here visualises source code, so the row does not differentiate them. DL-VizLab's language-independent counterpart is the NPM trace format, which any language can consume (NPM-SPEC §6).
² Usability has not been measured yet; SUS and NASA-TLX are instrumented in Study Mode.
³ The three-condition study is fully instrumented and its analysis validated on simulated data; no outcome has been measured yet.

**Source marks** on prior-system cells: ᵖ verified from the system's paper; ⁱ analytical inference (a feature the paper does not describe is coded absent); † to be checked against the paper or live tool (PAPER-NOTES §8). DL-VizLab cells describe what is implemented and tested in this repository.

**Rows that carry the contribution argument.** The base paper rates CS-OLabs itself **N** on *Integration with IDE* and **L** on *Ease of extension*. The second is the limitation the NPM's four registration points target (`docs/ARCHITECTURE-LINEAGE.md`): adding a layer type means implementing and registering four pieces, with the schema regenerated. It still requires writing TypeScript, which is why the claim is "easier", not "effortless". DL-VizLab, like CS-OLabs, has no IDE integration.

CS-OLabs' own values in the base paper, for reference: Multi-language Y, Multi-visualization Y, User navigation Y, Interactive visualization Y, Runtime visualization Y, Integration with IDE N, Ease of usage Y, Ease of extension L.

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
- Sharma, T., & Rawassizadeh, R. (2026). NeuroViz: Real-time interactive visualization of forward and backward passes in neural network training. arXiv:2605.02044 (v2, 23 May 2026). Author order verified against the authors' Boston University lab publication page.
- Smilkov, D., Carter, S., Sculley, D., Viégas, F. B., & Wattenberg, M. (2017). Direct-manipulation visualization of deep networks. *ICML Workshop on Visualization for Deep Learning*.
- Swaminathan, J., Kavitha, K. R., Sibin, B., Raman, [[INITIAL TO CONFIRM]], & Nedungadi, P. (2025). A multi-aspect visualization framework for advancing STEM pedagogy and SDG4: Digital India's Computer Science OLabs. *SN Computer Science*, 6, 284. https://doi.org/10.1007/s42979-025-03735-6
- Wang, Z. J., Turko, R., Shaikh, O., Park, H., Das, N., Hohman, F., Kahng, M., & Chau, D. H. (2020). CNN Explainer: Learning convolutional neural networks with interactive visualization. *IEEE TVCG*, 27(2).

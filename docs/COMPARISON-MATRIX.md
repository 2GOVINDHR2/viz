# Comparison Matrix

DL-VizLab against the seven closest prior systems, along the dimensions that define its contribution (brief B2). Fix Round 3 (B2.1) added Transformer Explainer (CHI 2026), AnimatedLLM (TeachNLP 2026) and GNN 101 (IEEE TVCG 2026). Before that round none of the three was cited anywhere in the repository.

## Feature comparison (Y / N / L)

Rows 1–8 are the features of the base paper's Table 5 (*"Features supported by CS-OLabs and other tools"*), in its order and wording, so that the two papers read as one research line. Rows 9–17 are the dimensions that carry DL-VizLab's contribution. Legend as in the base paper: **Y** = Yes, **N** = No, **L** = Limited.

| # | Feature | **DL-VizLab** | TensorFlow Playground | CNN Explainer | GAN Lab | NeuroViz | Transformer Explainer | AnimatedLLM | GNN 101 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Multi-language | N ¹ | N | N | N | N | N | N | N |
| 2 | Multi-visualization | **Y** (three synchronised views + explanation) | Y † (network, output surface, loss curve) | Y ᵖ (overview and detail views) | Y † | Y ⁱ (network with activations and weights; loss over time ᵖ) | Y ᵖ (overview and expandable detail views) | Y ᵖ (step-by-step views of the model) | Y ᵖ (node-link and matrix views, several levels of abstraction) |
| 3 | User navigation | **Y** (six granularities, forwards and backwards, jump anywhere) | L † (single-step button) | Y ᵖ (between overview and detail of one inference) | L † | L † (before/after states of an update within an epoch ᵖ) | L ᵖ (between abstraction levels of one generation step) | Y ᵖ (step-by-step through a pre-computed trace) | Y ᵖ (model overview → layer operations → detailed calculation) |
| 4 | Interactive visualization | **Y** | Y | Y ᵖ | Y | Y ᵖ | Y ᵖ (own input text, temperature) | Y ᵖ | Y ᵖ |
| 5 | Runtime visualization | **Y** (of training) | Y | L ᵖ (one inference of a pre-trained model) | Y | Y ᵖ | L ᵖ (live GPT-2 inference in the browser, pre-trained) | L ᵖ (replays pre-computed traces of open LLMs) | L ⁱ (inference of a trained GNN) |
| 6 | Integration with IDE | N | N ⁱ | N ⁱ | N ⁱ | N ⁱ | N ⁱ | N ⁱ | N ⁱ |
| 7 | Ease of usage | L ² | Y † | Y † | Y † | Y ᵖ (SUS 80.97, n = 31) | Y ᵖ (study of understanding and engagement, n = 90) | Y † | Y ᵖ (evaluated with teaching assistants and students) |
| 8 | Ease of extension | **Y** (four registration points; LayerNorm added without editing existing files, tested) | L † (source edits) | L † | L † | N ⁱ (not described) | N ⁱ (not described) | L ⁱ (new inputs need new pre-computed traces) | N ⁱ (not described) |
| 9 | Training visualised (not only inference) | **Y** | Y | N ᵖ | Y | Y ᵖ | N ᵖ | N ᵖ | N ⁱ |
| 10 | Execution granularity levels | **Y** (operation, layer, phase, example, batch, epoch) | L † | N | L † | L † | L ᵖ (abstraction levels, not execution steps) | L ᵖ (token and layer steps of inference) | L ᵖ (abstraction levels of inference) |
| 11 | Backward-pass visibility | **Y** (every gradient, per example, with values) | N † | N | L † | Y ᵖ | N | N | N ⁱ |
| 12 | Parameter-update visibility | **Y** (batch gradient, momentum, Δ, before → after) | L † (edge colours change) | N | L † | Y ᵖ | N | N | N ⁱ |
| 13 | Architecture families | **Y** (fully connected and convolutional, training) | L (fully connected, 2-D inputs) | L ᵖ (one fixed CNN, inference) | L (GAN with small MLPs) | L ᵖ (fully connected only) | L ᵖ (one transformer, GPT-2 small) | L ᵖ (decoder-only transformers) | L ᵖ (graph neural networks only) |
| 14 | Formal, serializable intermediate representation | **Y** (Neural Program Model) | N ⁱ | N ⁱ | N ⁱ | N ⁱ | N ⁱ | L ᵖ (pre-computed inference traces; no specified, verifiable format described) | N ⁱ |
| 15 | Curriculum structure (graded experiments, walkthroughs) | **Y** (10 experiments with prerequisites, walkthroughs, self-checks) | N | N | N | N ᵖ (beginner walkthroughs listed as future work) | N ⁱ | N ⁱ | L ᵖ (built with four domain experts, deployed in three university courses) |
| 16 | Deterministic replay | **Y** (byte-identical trace from a seed; SHA-256 in CI) | N † | n/a | N † | N ⁱ | n/a (inference; sampling is user-controlled) | L ⁱ (replays fixed traces; not a training run) | n/a |
| 17 | Learning gain measured as change: the same knowledge test before and after, against a comparison condition ⁴ | N ³ | N † | N † (observational study) | N † | N ᵖ (SUS and perceived transparency; learning outcomes listed as future work) | N ᵖ (a randomised controlled study of an objective learning outcome, n = 90, tool vs blog post vs video; post-test only, with no knowledge pre-test: it compares endpoints, not change) | N ⁱ (none described) | N ᵖ (course deployment and evaluation with teaching assistants and students) |

¹ The base paper's tools visualise programs written in several programming languages. None of the deep-learning tools here visualises source code, so the row does not differentiate them. DL-VizLab's language-independent counterpart is the NPM trace format, which any language can consume (NPM-SPEC §6).
² Usability has not been measured yet; SUS and NASA-TLX are instrumented in Study Mode.
³ The three-condition study is fully instrumented and its analysis validated on simulated data; no outcome has been measured yet, so DL-VizLab is coded **N** here, like every other system.
⁴ **Relabelled twice in Fix Round 3 (B2.2). Both narrowings are recorded here, not edited away.**
   - **Originally** the row read *Measured learning outcome*, with every prior system coded N or L. That implied the field does not measure learning, which is false.
   - **First narrowing** (from the abstracts): *Controlled learning-gain study*, on the assumption that Transformer Explainer's 90-participant study measured understanding without a controlled comparison. **That assumption was wrong.**
   - **What the study is** (CHI '26 paper, read in full by a team member):
     - **Design:** between-subjects, 90 non-expert participants randomly assigned to the tool, a blog post or a video series, for up to 45 minutes.
     - **Outcome:** a closed-book, 7-question multiple-choice test mapped to six learning objectives, analysed with GLMMs.
     - **Result:** tool users scored 73.3 % on average, significantly above both comparisons (p = 0.021 each). They also reported lower mental demand and higher self-rated understanding than blog readers.
     - **No knowledge pre-test.** Prior familiarity was self-rated and used as a covariate.

     So it is a controlled study of an objective learning outcome, and it compares **post-intervention endpoints**.
   - **Second narrowing, the current row.** It asks whether **learning gain is measured as change**: the same instrument administered before and after, against a comparison condition, with the pre-test as covariate. That measures change and controls for prior knowledge directly, rather than through a self-rating. This is DL-VizLab's planned design (STUDY-PROTOCOL), and it is still not run, so DL-VizLab is N.

   **What each system did evaluate:**
   - **TensorFlow Playground:** no published user evaluation †.
   - **CNN Explainer:** an observational study of use †.
   - **GAN Lab:** usage observations reported in the paper †.
   - **NeuroViz:** n = 31, SUS 80.97 and perceived transparency against six other tools ᵖ.
   - **Transformer Explainer:** the randomised, controlled endpoint study above ᵖ. It is the strongest learning evidence among these systems, and it answers "do learners know more after using it than after the alternatives" (with self-rated prior familiarity as the only control), not "how much did each learner's knowledge change".
   - **AnimatedLLM:** no evaluation described in the abstract ⁱ.
   - **GNN 101:** classroom deployment in three courses; evaluation with teaching assistants and students ᵖ.
   - **CS-OLabs:** single-group pre/post with educators, n = 23 analysed (PAPER-NOTES §5a). It measures change, but has no comparison condition.
   - **DL-VizLab:** a randomised three-condition learning-gain study, designed and instrumented, not yet run.

**Source marks** on prior-system cells (the three systems added in Fix Round 3 were checked against their abstracts and project pages through web-search excerpts; their full papers are † for a team member): ᵖ verified from the system's paper; ⁱ analytical inference (a feature the paper does not describe is coded absent); † to be checked against the paper or live tool (PAPER-NOTES §8). DL-VizLab cells describe what is implemented and tested in this repository.

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

- Cho, A., Kim, G. C., Karpekov, A., Lee, S., Helbling, A., Hoover, B., Wang, Z. J., Kahng, M., & Chau, D. H. (2026). Transformer Explainer: Learning LLM transformers with interactive visual explanation and experimentation. In *Proceedings of the 2026 CHI Conference on Human Factors in Computing Systems* (CHI '26), Article 7. https://doi.org/10.1145/3772318.3791725. (Supersedes the AAAI 2025 poster-track paper, doi:10.1609/aaai.v39i28.35347. Minsuk Kahng, first author of GAN Lab, is an author.)
- Kahng, M., Thorat, N., Chau, D. H., Viégas, F. B., & Wattenberg, M. (2018). GAN Lab: Understanding complex deep generative models using interactive visual experimentation. *IEEE TVCG*, 25(1).
- Kasner, Z., & Dušek, O. (2026). AnimatedLLM: Explaining LLMs with interactive visualizations. In *Proceedings of the 7th Workshop on Teaching Natural Language Processing (TeachNLP 2026)*, Rabat, Morocco, pp. 1–6. https://doi.org/10.18653/v1/2026.teachingnlp-1.1. (Preprint: arXiv:2601.04213.)
- Lu, Y., Chen, C., Chen, Y., Huang, K., Zitnik, M., & Wang, Q. (2026). GNN 101: Visual learning of graph neural networks in your web browser. *IEEE Transactions on Visualization and Computer Graphics*, 32(2), 1793–1805. https://doi.org/10.1109/TVCG.2025.3634087
- Sharma, T., & Rawassizadeh, R. (2026). NeuroViz: Real-time interactive visualization of forward and backward passes in neural network training. arXiv:2605.02044 (v2, 23 May 2026). Author order verified against the authors' Boston University lab publication page.
- Smilkov, D., Carter, S., Sculley, D., Viégas, F. B., & Wattenberg, M. (2017). Direct-manipulation visualization of deep networks. *ICML Workshop on Visualization for Deep Learning*.
- Swaminathan, J., Kavitha, K. R., Sibin, B., Raman, [[INITIAL TO CONFIRM]], & Nedungadi, P. (2025). A multi-aspect visualization framework for advancing STEM pedagogy and SDG4: Digital India's Computer Science OLabs. *SN Computer Science*, 6, 284. https://doi.org/10.1007/s42979-025-03735-6
- Wang, Z. J., Turko, R., Shaikh, O., Park, H., Das, N., Hohman, F., Kahng, M., & Chau, D. H. (2020). CNN Explainer: Learning convolutional neural networks with interactive visualization. *IEEE TVCG*, 27(2).

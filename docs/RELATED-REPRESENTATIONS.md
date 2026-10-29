# Related Representations: Where the NPM Sits Outside Educational Visualisation

**Why this document exists (Fix Round 3, B2.3).** The paper is a systems contribution. Its claim is that one run of supervised training can be represented as a flat, ordered, dataflow-explicit sequence of typed instructions, and that this sequence is:
- lossless and deterministic;
- independently verifiable;
- memory-bounded;
- enough to reconstruct any state of the run without the engine.

A reviewer will place that claim in three literatures other than educational visualisation. This document states, for each, what that work represents and how the Neural Program Model (NPM, `docs/NPM-SPEC.md`) differs. The educational comparison is in `COMPARISON-MATRIX.md`.

**The one-sentence distinction.** The systems below represent a *model* (to compile, exchange or deploy it), a *workflow* (to record its provenance) or a *program execution* (to debug it). The NPM represents **one execution of training, at the granularity of a single tensor operation**, with every operand a reference to an earlier result, so the trace alone suffices to re-derive and replay the run.

## 1. Compiler and interchange representations

| System | What it represents | Purpose | Represents an execution? |
|---|---|---|---|
| **MLIR** (Lattner et al., 2021) | Computations as operations in extensible dialects, at several levels of abstraction | Optimising and compiling them for hardware | No: a program to be transformed, not a record of a run |
| **ONNX** (onnx.ai specification) | A trained model as a computation graph of standard operators, with its weights | Moving a model between frameworks and runtimes for deployment (inference) | No: one graph with one set of weights |
| **NIR**, the Neuromorphic Intermediate Representation (Pedersen et al., 2024) | A spiking model as composable primitives (hybrid systems of continuous dynamics and discrete events), abstracted from discretisation and hardware | Moving models between 7 simulators and 4 hardware platforms (as validated in the paper) | No: a declarative model description |

**Distinction.**
- Each of these is a description of *what to compute*. A graph or a program is run many times, with different data and changing parameters, and the representation records none of those runs.
- The NPM is the opposite object: a record of *what was computed* in one run. It holds:
  - every parameter version;
  - every per-example forward and backward value;
  - every update, in execution order.
- An NPM trace could be produced from a model expressed in any of them. It does not compete with them.

**NIR, specifically.** NIR's name ("intermediate representation") and its framing as a "unified instruction set" invite a comparison. The overlap is in the words only:
- NIR's primitives are model components, and its graph has no notion of time steps of training, gradients or parameter updates;
- the NPM's instructions are executed steps, each tagged with the epoch, batch, example, phase and layer it belongs to (NPM-SPEC §5).

Cite NIR in the paper so the reviewer sees the distinction drawn rather than missed.

## 2. Provenance for deep learning

**DLProv** (Pina et al., 2025) is the closest work in purpose: a suite of provenance services giving end-to-end traceability of deep-learning workflows. Its principal features (from the paper's abstract):
- it captures provenance across data preparation, training and evaluation;
- it supports SQL queries during training;
- it exports W3C PROV-compliant provenance graphs, and its services are framework-independent (with Keras and physics-informed-network instances);
- it records hyperparameters, per-epoch loss and accuracy, model files, data splits and hardware;
- its measured overhead is at most 1.4 % of execution time.

| | DLProv | NPM |
|---|---|---|
| Unit of capture | The workflow activity and **the epoch**: hyperparameters, per-epoch metrics, artefacts | **The individual tensor operation**, for every example, in the forward pass, the backward pass and the update |
| Data flow | Between workflow activities and artefacts (PROV entities) | Between operations: every operand is a reference to the instruction that produced it (NPM-SPEC §2), so the full dataflow graph is recoverable from the trace alone |
| Can the run be re-derived from the record? | No (it records outcomes, not the intermediate values) | Yes: `tools/npm-verify.mjs` re-derives every result from its operands, without the engine |
| Granularities | Workflow and epoch | Six nested levels from one record: operation, layer, phase, example, batch, epoch (NPM-SPEC §5) |
| Purpose | Traceability, reproducibility and analysis of experiments | Inspecting, stepping and replaying one run, and verifying it independently |

**Multi-granularity as an open direction.** The brief records that DLProv's stated future work names multi-granularity capture as an open direction. The NPM's nesting path provides this: every instruction carries its position at every level, so one trace serves all six granularities.
- **Status: to verify before citing.** The DLProv full text (peerj.com) could not be opened from this build environment, and web-search excerpts of the abstract do not include its future-work section. A team member must confirm the wording against the paper's conclusion before the paper relies on it.
- **If DLProv does not say this,** keep the granularity comparison in the table, which rests on the abstract, and drop the future-work sentence.

**Distinction.** The two are complementary, not competing: a DLProv-style record could point to an NPM trace as the fine-grained artefact of one training activity.

## 3. Execution capture and replay

**The design, in systems terms.** The NPM store's checkpoint-plus-recomputation design is *omniscient debugging* applied to training (NPM-SPEC §9):
- it keeps a checkpoint per mini-batch;
- it regenerates any absent segment by re-running one batch;
- it holds materialised segments in a byte-bounded LRU cache.

An omniscient (back-in-time) debugger records the events of an execution so that any past state can be inspected. It meets the same obstacle the NPM does: the size of a complete record.

**Pothier, Tanter & Piquer (2007)** is the canonical reference for that space problem. Their system, TOD, makes omniscient debugging practical by combining:
- efficient instrumentation;
- a specialised distributed database for the trace;
- partial traces that record only the relevant events.

The trade it studies (how much to store, against how much to recompute or re-query when a past state is needed) is the trade the NPM store measures.

**Where the NPM differs.**
- **Determinism removes the general problem.** TOD must record events because a program's execution cannot, in general, be re-run to the same state. A training run in the NPM can: all randomness comes from a seeded generator and every reduction has a fixed order (NPM-SPEC §8).
- **So a checkpoint is enough to regenerate a segment exactly.** Regeneration is tested to be byte-identical for every segment of every planned architecture, and at 860,804 instructions (`VALIDATION-REPORT.md`, scale evidence).
- **Granularity.** The record is structured by the domain (epoch, batch, example, phase, layer), not by program events, which is what lets the same record serve six step sizes.

## References

- Lattner, C., Amini, M., Bondhugula, U., Cohen, A., Davis, A., Pienaar, J., Riddle, R., Shpeisman, T., Vasilache, N., & Zinenko, O. (2021). MLIR: Scaling compiler infrastructure for domain specific computation. In *2021 IEEE/ACM International Symposium on Code Generation and Optimization (CGO)*, pp. 2–14. https://doi.org/10.1109/CGO51591.2021.9370308
- ONNX: Open Neural Network Exchange, specification and operator set. https://onnx.ai (cite the specification version used, if the paper cites ONNX at all; it has no archival paper).
- Pedersen, J. E., et al. (2024). Neuromorphic intermediate representation: A unified instruction set for interoperable brain-inspired computing. *Nature Communications*, 15, 8122. https://doi.org/10.1038/s41467-024-52259-9
- Pina, D., Kunstmann, L., Chapman, A., de Oliveira, D., & Mattoso, M. (2025). DLProv: A suite of provenance services for deep learning workflow analyses. *PeerJ Computer Science*, 11, e2985. https://doi.org/10.7717/peerj-cs.2985
- Pothier, G., Tanter, É., & Piquer, J. (2007). Scalable omniscient debugging. In *Proceedings of the 22nd Annual ACM SIGPLAN Conference on Object-Oriented Programming Systems, Languages and Applications (OOPSLA '07)*, pp. 535–552. ACM. https://doi.org/10.1145/1297027.1297067. Also *ACM SIGPLAN Notices* 42(10).

**Citation checks.**
- **Verified through web-search excerpts of the publisher, ACL Anthology, project or university pages:** MLIR (DOI from the MLIR project's own citation entry), NIR, DLProv's bibliographic data, and Pothier et al.'s venue and pages.
- **Not yet checked against the ACM Digital Library record:** Pothier et al.'s DOI. The ACM DL and Crossref could not be reached from this build environment. A team member must check it there, as the brief requires, before submission.

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

**Multi-granularity as an open direction.** DLProv's authors name three directions for future work: **multi-granularity capture**, support for continuum computing environments, and improved usability and adoption (confirmed against the paper by a team member). The NPM's nesting path provides the first for a single training run: every instruction carries its position at every level, so one trace serves all six granularities, from one operation to one epoch.

**Querying (Fix Round 4, D2).** DLProv supports SQL queries against its provenance during training. Until this round the NPM held far richer information with no way to interrogate it, and the comparison was one the manuscript lost.
- **What there is now:** the trace view filters by instruction kind, layer, phase and epoch. It also searches for the first gradient below or above a magnitude, for example the first point at which a layer's gradient falls below 10⁻³.
- **How it is built:** pure functions over the trace alone (NPM-SPEC §10.1).
- **What it is not:** a query language. It is a fixed set of filters and one numeric search.

**Diagnostic questions (Fix Round 5, 3.2).** Five questions are now asked of the trace itself (NPM-SPEC §10.2, "Ask the trace"):
- where a weight gradient first falls below 10⁻⁴;
- which instructions read the weight that changed most in an epoch;
- which example had the largest loss in an epoch, and its forward pass;
- where a ReLU neuron went inactive and never recovered;
- after which instruction the loss stopped decreasing.

Each is a few lines over the instructions, and each depends on what DLProv does not record: per-operation values and the operand references between them. DLProv's SQL can answer the last question at epoch granularity. It cannot answer the other four, because the values they need are never captured.

The honest comparison is therefore:
- DLProv queries are general, over coarse records;
- NPM queries are specific, over every operation, and need no store beyond the trace file.

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

## 4. Training-specific record, inspection and visualisation (Fix Round 5, Part 7)

**Where these come from.** A literature search on 4 November 2026 (by the project team, given in the Fix Round 5 brief) found the systems below. Each row's description follows that search.

**What has not been checked.** This build environment could not re-check any of them against the source: its network policy blocks arxiv.org and research.google. Confirm each citation before the manuscript cites it, as was done for Pothier et al.

| System | What it does | Where it stops, relative to the NPM |
|---|---|---|
| **Chen et al. (2022)**, *Towards Training Reproducible Deep Learning Models* (arXiv 2202.02326) | Record-and-replay for training: intercepts `/dev/urandom` and `getrandom`, records their return values and replays them; patches non-deterministic GPU operations | It records the *inputs to nondeterminism*, not the execution. To see any intermediate value the run must be re-executed. The NPM records the execution itself and reconstructs any state without re-running training (NPM-SPEC §9; `tools/npm-replay.mjs`). |
| **tfdbg** (Cai et al., NIPS 2016 Workshop on Reliable Machine Learning in the Wild) | Inspects runtime dataflow graphs and intermediate tensor state, with simulated stepping | No specified format, no persisted artefact, and no reconstruction of an arbitrary earlier state. The NPM is a specified format (NPM-SPEC, `schema.json`) persisted as a file, and any earlier state is reconstructed from it. |
| **DLProv** (Pina et al., *PeerJ Computer Science* 11:e2985, July 2025) | Provenance services: per-epoch metrics and metadata; SQL over MonetDB during training; PROV-N export; Neo4j/Cypher; 12 example queries | Epoch granularity, no intermediate tensors, no replay (§2 above). The project already cites the PeerJ 2025 version; no reference to the 2024 ACM version remains. |
| **Deep4ge** (Jahan, arXiv 2607.12868, 2026) | "DNN training trajectories": 26 per-epoch scalar features over 719,560 epoch records; a benchmark for fault detection and seven-way diagnosis | It states that trajectories cannot replay training. Its **seven-category fault taxonomy** is a ready-made frame for a diagnostic case study using the NPM's queries (NPM-SPEC §10.1): a trace holds the per-operation evidence behind each per-epoch symptom. |
| **NNsight / NDIF** (arXiv 2407.14561) | Deferred remote execution over PyTorch; the intervention graph is a bipartite DAG, serialisable to JSON | An intervention *program*, not an execution *record*: no values are retained. Like MLIR and ONNX (§1), it describes what to compute. |
| **NeuroViz** (Sharma & Rawassizadeh, arXiv 2605.02044, May 2026) | Live animation of the forward and backward passes, per-neuron equations, hover tooltips; a 31-participant study, SUS 80.97 | No artefact: the computation is consumed as it happens, so it cannot step backwards. The NPM's stepping back is reconstruction from a record (verified by sampling, below). |
| **A Systematic Survey on Debugging Techniques for Machine Learning Systems** (arXiv 2503.03158, March 2025) | A taxonomy of ML debugging techniques | It has **no category for execution tracing, record-and-replay or training introspection**, and proposes "interactive environments for step-by-step inspection of model behaviour" as an open direction. The NPM, with its trace view and stepping, is one instance of that direction. |

**Conceded prior art: record-and-replay for programs.** Record-and-replay is a mature field for general program execution:
- `rr` (Mozilla's record-and-replay debugger);
- Pernosco (an omniscient debugger built on `rr` recordings);
- time-travel debugging in commercial debuggers;
- dedicated surveys in HPC and software engineering;
- omniscient debugging (§3 above, Pothier et al. 2007).

The NPM's novelty is not replay. It is **replay with training semantics**:
- each recorded step is a typed tensor operation of training;
- each step is placed by epoch, batch, example, phase and layer;
- its operands refer to the steps that produced them.

**The central claim, corrected (Fix Round 5, Part 7).** "Record-and-replay has never been applied to neural network training" is false and must not be made. The accurate form, used in NPM-SPEC and wherever novelty is asserted:

> Record-and-replay has been applied to training in order to reproduce runs. Intermediate tensors have been inspected at runtime. Training has been provenance-tracked at epoch granularity with SQL access. Execution graphs over model internals have been serialised. What has not been done is to record the execution itself — every operation, with its operands and results, structured by epoch, batch, example, phase and layer — as a specified artifact from which any intermediate state can be reconstructed without re-running.

**Evidence for "reconstructed without re-running" (Fix Round 5, 3.5).** `scripts/measure-reconstruction.ts` samples seeded positions in every curriculum configuration. At each position it compares three things value by value, bit for bit:
- the state reconstructed from the trace file alone;
- the state reconstructed from checkpoints;
- a reference execution halted at that position.

The results are in `VALIDATION-REPORT.md`, §6.

## References

- Lattner, C., Amini, M., Bondhugula, U., Cohen, A., Davis, A., Pienaar, J., Riddle, R., Shpeisman, T., Vasilache, N., & Zinenko, O. (2021). MLIR: Scaling compiler infrastructure for domain specific computation. In *2021 IEEE/ACM International Symposium on Code Generation and Optimization (CGO)*, pp. 2–14. https://doi.org/10.1109/CGO51591.2021.9370308
- ONNX: Open Neural Network Exchange, specification and operator set. https://onnx.ai (cite the specification version used, if the paper cites ONNX at all; it has no archival paper).
- Pedersen, J. E., et al. (2024). Neuromorphic intermediate representation: A unified instruction set for interoperable brain-inspired computing. *Nature Communications*, 15, 8122. https://doi.org/10.1038/s41467-024-52259-9
- Pina, D., Kunstmann, L., Chapman, A., de Oliveira, D., & Mattoso, M. (2025). DLProv: A suite of provenance services for deep learning workflow analyses. *PeerJ Computer Science*, 11, e2985. https://doi.org/10.7717/peerj-cs.2985
- Cai, S., Breck, E., Nielsen, E., Salib, M., & Sculley, D. (2016). TensorFlow Debugger: Debugging dataflow graphs for machine learning. *NIPS 2016 Workshop on Reliable Machine Learning in the Wild*. (Author list from memory; **confirm against the workshop paper**.)
- Chen, B., et al. (2022). Towards training reproducible deep learning models. arXiv:2202.02326. (**Confirm the authors and the published venue.**)
- Fiotto-Kaufman, J., et al. (2024). NNsight and NDIF: Democratizing access to foundation model internals. arXiv:2407.14561. (**Confirm.**)
- Jahan (2026). Deep4ge. arXiv:2607.12868. (Title and authors as given by the team's search; **confirm**.)
- Sharma & Rawassizadeh (2026). NeuroViz. arXiv:2605.02044. (**Confirm the title.**)
- A systematic survey on debugging techniques for machine learning systems (2025). arXiv:2503.03158. (**Confirm the authors.**)
- Pothier, G., Tanter, É., & Piquer, J. (2007). Scalable omniscient debugging. In *Proceedings of the 22nd Annual ACM SIGPLAN Conference on Object-Oriented Programming Systems, Languages and Applications (OOPSLA '07)*, Montréal, Canada, 21–25 October 2007, pp. 535–551. ACM. DOI **to be confirmed from the ACM Digital Library**: it is not printed on the paper. The candidate 10.1145/1297027.1297067 is unverified, so do not cite it until confirmed.

**Citation checks.**
- **Checked by a team member against the source:**
  - Pothier et al.: authors, title, venue, place, dates and pages 535–551, from the authors' own PDF. This corrects the 535–552 first given here.
  - DLProv's future-work wording, against the paper.
- **Verified through web-search excerpts** of publisher, ACL Anthology, project or university pages: MLIR (the DOI from the MLIR project's own citation entry), NIR, and DLProv's bibliographic data.
- **Still to confirm:** Pothier et al.'s DOI, from the ACM Digital Library record. The ACM DL and Crossref could not be reached from this build environment.

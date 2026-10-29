# Submission Readiness (Fix Round 3, Part B)

**What this audits.** The repository, against the requirements of a **systems and architecture** submission. The claim being submitted is that one run of supervised training can be represented as a flat, ordered, dataflow-explicit sequence of typed instructions that is:
- lossless and deterministic;
- independently verifiable;
- memory-bounded;
- enough to reconstruct any state of the run without the engine.

The educational environment motivates the representation and shows it is sufficient; it is not what is evaluated.

**How to read it.** Each item gives its state before this round (**present**, **partial** or **absent**), the action taken, and its state after. The list at the end is what still stands between the repository and a submission, by tier.

## Tier 1 (B2): fix now

| Item | Before | Action | After |
|---|---|---|---|
| **B2.1 Transformer Explainer citation** | **absent**: not cited anywhere (the brief expected an outdated AAAI citation; none existed) | Cited as Cho et al., CHI '26, Article 7, doi:10.1145/3772318.3791725, noting that it supersedes the AAAI 2025 poster paper and that Kahng is an author. Added as a column of COMPARISON-MATRIX. Verified against the project README and Georgia Tech's announcement (web-search excerpts). | **present** |
| **B2.1 AnimatedLLM citation** | **absent** (no arXiv citation existed either) | Cited as Kasner & Dušek, TeachNLP 2026, Rabat, pp. 1–6, doi:10.18653/v1/2026.teachingnlp-1.1, with the arXiv preprint noted. Column in COMPARISON-MATRIX. Verified against the ACL Anthology listing. | **present** |
| **B2.1 GNN 101** | **absent** | Cited as Lu et al., IEEE TVCG 32(2), 1793–1805, doi:10.1109/TVCG.2025.3634087. Column in COMPARISON-MATRIX and in TASK-ANALYSIS (a column, because tools are columns there; ADR-061). Volume, issue and pages verified against the University of Minnesota listing. | **present** |
| **B2.2 Gap claim** | **partial**: no sentence said "the field does not evaluate", but matrix row 17 (*Measured learning outcome*, every prior system N or L) and the comparison narrative implied it | Row relabelled *Controlled learning-gain study*, with a footnote recording what each system did evaluate. DL-VizLab's own cell is now N, because it has not run one. The narrowed claim, and the fact of the narrowing, are in PAPER-NOTES §8a. | **present**. One check is left for a human (Tier 1, below). |
| **B2.3 Related representations** | **absent** | `docs/RELATED-REPRESENTATIONS.md` covers three strands: MLIR, ONNX and NIR (none represents an execution); DLProv (epoch and workflow granularity, against the NPM's per-operation granularity); and omniscient debugging (Pothier, Tanter & Piquer 2007). An NPM-SPEC §9 paragraph places the measured trade-off curve in the omniscient-debugging tradition. | **present**. Two citation checks are left for a human (below). |
| **B2.4 Palette summary PDF** | present (closed in Fix Round 2, ADR-045) | Re-checked: `figures/palette-summary.pdf` exists and has 2 pages | **present** |
| **B2.4 Memory protocol** | present (ADR-045) | Re-checked: the 519–532 MB and 525–543 MB runs used the same protocol, one CNN performance test running alone. The clean range is 519–543 MB over seven runs; the 679 MB parallel-suite reading stays excluded | **present** |
| **B2.4 SUS convention sentence** | present (ADR-036, ADR-045) | Re-checked: PAPER-NOTES §5a has the manuscript sentence and states that the convention differs from the base paper's | **present** |
| **B2.4 Rounding at serialisation only** | present (ADR-045, with a unit test) | Re-checked: `_finite` rounds only while writing `results.json`; the in-memory results are unmodified (tested) | **present** |

## Tier 2 (B3): strengthen the submission

| Item | Before | Action | After |
|---|---|---|---|
| **B3.1 Scale evidence** | **partial**: largest run 86,084 instructions | `scripts/measure-scale.ts` runs **860,804 instructions** (10.0×; 4,001 segments, 200 MiB, 328 MiB of JSON). Every property holds: schema-valid; the verifier agrees on all 860,804; the round trip is byte-identical; 4,001 of 4,001 segments regenerate identically under a 1 % budget. The budget curve was measured too. **Reported honestly:** random-access time is not monotonic in the budget (4.9 ms at 25 % against 1.1 ms at 5 %). VALIDATION-REPORT §5 (generated) and NPM-SPEC §9 | **present** |
| **B3.2 Verification method** | **partial**: spread over ADR-038, ADR-050, ADR-054 and TEST-MUTATION-AUDIT | `docs/VERIFICATION-METHOD.md`: the principle, the mutation procedure by layer, the invariant catalogue A–H, the fuzz protocol, the staleness job, the three findings and how each was caught, and the counts (346 checks, 6 hollow, all fixed) | **present** |
| **B3.3 Independent consumers in NPM-SPEC §10** | **partial**: two bullet points. The verifier ran in CI; the **replay consumer was not exercised by any test** | §10 rewritten: line counts (473 and 86), imports (`node:fs` only), and what each establishes. New `tests/unit/consumers.test.ts`, 18 tests in the unit job: the samples are byte-identical to a fresh run in the current format; the verifier passes both samples; the replay consumer, run as a separate process at all six granularities, steps exactly as the navigator does; neither imports anything but Node's standard library | **present** |
| **B3.4 Browser rows** | present: the reason was already in the table cells and the paragraph below it, not only in KNOWN-GAPS | Re-checked: this environment still ships only Chromium and does not permit installing others. The PAPER-NOTES §4 command sequence matches the Playwright project names (`firefox`, `msedge`, `webkit`) and the report generator's file names | **partial**: the rows are unmeasured, with the reason stated in the table |
| **B3.5 Live deployment** | unknown | Could not be checked: `viz-mu-one.vercel.app` does not resolve from this build environment (network policy). The README now carries the link | **unverified**. A human must check it (Tier 2, below). |
| **B3.5 README** | **partial**: no Vercel link; no run-without-building instructions; ADR range stale (001–031) | Added the live link and how to run the verifier and the replay consumer on the samples without building. The ADR range and document list were updated, and "add an experiment" now names the A4 table. Build steps, architecture, adding an NPM instruction, licence and citation block were already present | **present** |
| **B3.5 CITATION.cff** | **partial**: **invalid**. The five empty `orcid: ''` values fail the CFF 1.2.0 schema, and so does the single-name author written as `name:` (an organisation key) | ORCID keys left out until known, with a comment saying how to add them; the single-name author is given as `given-names`. The file now validates against the CFF 1.2.0 schema (0 errors; jsonschema with cffconvert 2.0.0's bundled schema) | **present**, apart from the ORCIDs |
| **B3.5 Runnable without building** | present (samples and both tools, Node only) | Confirmed by the new consumer tests and the README commands | **present** |
| **B3.5 Data and code availability statement** | **absent** | Drafted in PAPER-NOTES §7a, with placeholders for the version DOI and the study-data sentence | **present** (as a draft) |

## Tier 3 (B4): report only

| Item | State now |
|---|---|
| **Experiments without purpose-built novice screens** | **7 of 10**: 2, 3, 4, 7, 8, D1 and D2. Only 1, 5 and 6 have them. This round built none. |
| **Cold-review observations scheduled with those screens** | **67**, unchanged (COLD-REVIEW counts). None was re-adjudicated. Part A added typed settings to the workbench of these seven, but no observation was scheduled on that basis. |
| **Screen-reader validation** | Not done; it needs a human. Automated checks: axe reports 0 violations across the screens listed in the Fix Round 3 section of PROGRESS. Every new parameter field is labelled, keyboard-operable, and announces a refusal through `role="alert"`, `aria-invalid` and `aria-describedby`. |
| **Independent re-rating of COMPARISON-MATRIX and TASK-ANALYSIS** | Single rater still. This round added three systems, coded from abstracts, project pages and listings. Cells marked † are to be checked against the papers or live tools. |
| **Participant studies** | None run. An institutional ethics determination is needed first (STUDY-PROTOCOL). |
| **Peak-memory overrun (4–9 %)** | Unchanged at 519–543 MB. The scale work (B3.1) is a Node measurement of the trace store and found no new cause: checkpoints for 4,001 segments cost 1.0 MiB, and resident memory follows the budget (1.5 % of the trace at a 1 % budget). The overrun is in the tab's renderer, not the store. |

## What remains outstanding

**Tier 1: a person must do these before submission.**
1. **Transformer Explainer's study design.** Read the full CHI '26 paper and check whether its 90-participant study had a comparison condition and measured learning gain. If it did, drop the third clause of the narrowed claim (PAPER-NOTES §8a) and recode COMPARISON-MATRIX row 17 for it.
2. **DLProv's future work.** Confirm that its stated future work names multi-granularity capture. peerj.com was unreachable from here, so the sentence is marked *to verify* in RELATED-REPRESENTATIONS §2.
3. **Pothier et al.'s DOI.** Check `10.1145/1297027.1297067` against the ACM Digital Library record. Crossref and the ACM DL were unreachable from here.
4. **The full papers behind the new columns.** Check the cells of the three new systems against their full papers (marked ᵖ from abstracts, ⁱ inferred, † to check).

**Tier 2.**
1. **Live deployment.** Open https://viz-mu-one.vercel.app and confirm it serves the current build (the experiment list shows typed *Try it* fields and *More settings*). Then run one experiment end to end.
2. **Browser rows.** Run the ten-minute browser sequence in PAPER-NOTES §4 on a laptop to fill the Firefox, Edge and WebKit rows.
3. **ORCIDs.** Each author adds an `orcid:` line in CITATION.cff.
4. **Availability placeholders.** Fill the version, the Zenodo DOI and the study-data sentence in the availability statement (PAPER-NOTES §7a).

**Tier 3, for a person or an institution.**
1. **Novice screens.** Build the seven missing ones, which also settles the 67 scheduled cold-review observations.
2. **Screen-reader validation** with users.
3. **A second rater** for the comparison matrix and the task analysis.
4. **The ethics determination,** then the study.
5. **The peak-memory overrun.** Decide whether to accept it or reduce it.

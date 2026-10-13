# Known Gaps

Items dropped, deferred, or known to be weak. Each entry names its phase.

- **P1 (SHOULD):** Web Worker boundary not established in P1; it is built in P3 together with the trace streaming protocol.
- **A4:** Concept-inventory distractors encode commonly reported novice difficulties, but each misconception has not yet been matched to a published source; the items have not been piloted or reviewed for content validity. Both are required before the ethics submission (STUDY-PROTOCOL §6, §10).
- **A4:** SUS grade and adjective thresholds (Sauro–Lewis; Bangor et al., 2009) are as commonly reproduced and should be checked against the primary sources before publication.
- **A4:** Consent and information-sheet text is draft wording with `[[PLACEHOLDERS]]`; it must be replaced verbatim by the approved text.
- **Repository access (resolved 2026-10-13):** pushes failed with HTTP 403 during P0–P4; access was restored and the branch was pushed on 2026-10-13.
- **P4 deployment:** `.github/workflows/pages.yml` deploys `dist/` to GitHub Pages, but it cannot run until the push works and Pages is enabled (Settings → Pages → Source: GitHub Actions). The production build was also published as a private claude.ai Artifact (https://claude.ai/artifact/1Y4v3owvbHYTHuE8DsUWRa); it must be shared by its owner before others can open it. Its rendering inside the Artifact viewer (module script + Web Worker) has not been verified by the build agent.
- **P4 performance:** browser measurements exist for headless Chromium only; Firefox and Edge are not installed in the build environment. Run `npx playwright test tests/e2e/perf.spec.ts --project=firefox` (and `msedge`) then `npm run report` to fill those rows.
- **P4 task analysis:** counts for third-party tools are analytical, from published descriptions; NeuroViz rows rest on the brief's summary only. A second rater should check them against the live tools.
- **P8:** Study Mode has been run end to end by automated tests only (all three conditions, withdrawal, refusal, export → pandas → analysis pipeline). A pilot with real participants (STUDY-PROTOCOL §10) is still required, in particular to check the 30-minute intervention length and the readability of the C1 screenshots.
- **P8:** The C2 condition needs network access to TensorFlow Playground, unlike the other conditions; for an offline lab a local Playground build must be served and the task URLs edited. Time spent inside the Playground tab is only measured as the stage duration (no Playground telemetry).
- **P8:** Exports from several lab machines must be concatenated by hand before analysis (same columns; participant codes are unique). A merge helper is FUTURE-WORK.
- **P9 memory:** at the CNN experiment, live memory after garbage collection is ~81 MB, but the peak resident set of the tab's renderer is 456–544 MB across runs, around the brief's "~500 MB" budget. The difference is the allocator's high-water mark from short-lived per-example training buffers (yielding to the event loop during generation was tried and did not reduce it). Reducing per-example allocations in the convolution kernels is the route to a lower peak (FUTURE-WORK).
- **P9 accessibility:** the WCAG audit is automated (axe-core, 19 screens) plus a manual criterion review; it has not been validated with screen-reader users.

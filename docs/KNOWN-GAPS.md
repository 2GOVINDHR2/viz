# Known Gaps

Items dropped, deferred, or known to be weak. Each entry names its phase.

- **P1 (SHOULD):** Web Worker boundary not established in P1; it is built in P3 together with the trace streaming protocol.
- **A4:** Concept-inventory distractors encode commonly reported novice difficulties, but each misconception has not yet been matched to a published source; the items have not been piloted or reviewed for content validity. Both are required before the ethics submission (STUDY-PROTOCOL §6, §10).
- **A4:** SUS grade and adjective thresholds (Sauro–Lewis; Bangor et al., 2009) are as commonly reproduced and should be checked against the primary sources before publication.
- **A4:** Consent and information-sheet text is draft wording with `[[PLACEHOLDERS]]`; it must be replaced verbatim by the approved text.
- **Repository access (blocking):** every `git push` from the build session failed with HTTP 403 ("Claude doesn't have GitHub access to 2GOVINDHR2/viz"). All work exists only as local commits on `claude/new-session-bnlb4r` in the build container until a human restores access and the branch is pushed. CI has therefore never run on GitHub.
- **P4 deployment:** `.github/workflows/pages.yml` deploys `dist/` to GitHub Pages, but it cannot run until the push works and Pages is enabled (Settings → Pages → Source: GitHub Actions). The production build was also published as a private claude.ai Artifact (https://claude.ai/artifact/1Y4v3owvbHYTHuE8DsUWRa); it must be shared by its owner before others can open it. Its rendering inside the Artifact viewer (module script + Web Worker) has not been verified by the build agent.
- **P4 performance:** browser measurements exist for headless Chromium only; Firefox and Edge are not installed in the build environment. Run `npx playwright test tests/e2e/perf.spec.ts --project=firefox` (and `msedge`) then `npm run report` to fill those rows.
- **P4 task analysis:** counts for third-party tools are analytical, from published descriptions; NeuroViz rows rest on the brief's summary only. A second rater should check them against the live tools.

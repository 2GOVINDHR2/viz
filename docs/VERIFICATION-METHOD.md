# Verification Method: An Assertion Is Evidence Only Once It Has Been Seen to Fail

**Why this is a named contribution (Fix Round 3, B3.2).** Five times in this project a published number or a passing check was wrong while the build was green (§6):
- two generated documents had gone stale;
- a memory peak was inflated by a parallel test run;
- tests were validating blank screens, alongside six further hollow assertions;
- a cache-latency curve was distorted by the process that measured it.

None was caught by the check it concerned. Each was caught by a check built to make the evidence fail on purpose, or to regenerate it independently. The method below came out of those findings and now governs every assertion and every measurement in the repository, including this round's.

## 1. The principle

> **A passing test is evidence about the system only if the test has been shown to fail when the behaviour it checks is broken.**

An assertion that has never been seen to fail may be checking:
- a constant;
- a value the test computed itself;
- a screen that was never rendered;
- a file that no longer reflects the code.

It is *hollow*: it reports success whatever the system does. The defence is mechanical: break the behaviour, run the test, and require it to fail **at that assertion**.

## 2. The mutation procedure

| Layer | Mutant | Kill criterion | Tool |
|---|---|---|---|
| Every e2e assertion | **Blank**: empty the page just before the assertion. **No-action**: delete the nearest preceding interaction. Line numbers are preserved, so a failure is attributed exactly. | The test fails *at that assertion's line*; a failure elsewhere does not count | `scripts/mutation/e2e-mutants.ts` |
| e2e assertions no mechanical mutant reaches (negative assertions, downloads, shared helpers) | A hand-written break of the app or of the test's own input, aimed at the assertion's exact target | as above | `scripts/mutation/targeted.ts`, `targeted.json` |
| Server-render unit tests | **Blank render**: every server render returns an empty screen. **Stale snapshot**: static renders show the store's initial state (the original defect, restored). | The test fails; every survivor is read and justified | `scripts/mutation/vitest.blank.config.ts`, `blank-server.ts` |
| Property invariants A–H | One injected defect per invariant, in the application: the behaviour the invariant guards is broken | The invariant's tests fail | A–E: hand-injected (PROGRESS, Fix Round 2b); F–H: `scripts/mutation/params-mutants.ts` |
| Numerical suites | A deliberately wrong gradient rule (a missing factor 2); a perturbed gradient value in a trace | The gradient check fails (relative error > 0.3); the verifier reports the mismatch | `tests/gradcheck`, `tests/unit/npm.test.ts` |
| Screenshot generators | A *Show me* action that changes nothing on screen | Generation stops with the step named | `scripts/gen-slides.ts` |

**What a survivor means.** Two possibilities:
- the assertion is hollow, so it is fixed or replaced and the mutant re-run; or
- the mutant is *equivalent*: it changes nothing observable, as when the greyscale ink tokens turned out to be unused. Then the mutant is replaced.

A survivor is never left unexplained.

## 3. The invariant catalogue

Invariants are written as properties over the live application store, with the engine running in-process (`tests/support/invariants.ts`, `tests/support/lab.ts`). They run on every experiment, in both modes.

| | Invariant | Introduced |
|---|---|---|
| A | The declared control surface renders, and nothing undeclared does; reset is required on every screen | Fix Round 2b |
| B | Every trainable parameter stays reachable and editable after every architecture mutation | Fix Round 2b |
| C | Selecting any node or edge shows that element's own trace values and data flow, at several cursor positions including mid-backward-pass | Fix Round 2b |
| D | Reset restores the initial state, including the examples, panel values and open sections (extended in Fix Round 3); the re-run trace hash is identical | Fix Round 2b |
| E | Seeded fuzz: random sequences of UI actions, with A–D checked after every action; typed entries were added in Fix Round 3, with G and H checked after each one | Fix Round 2b |
| F | Parameter necessity: every parameter of the A4 table is declared and renders as a typed field in both modes | Fix Round 3 |
| G | A typed value round-trips into the trace. It is read back from the trace (the header, the dataset, INIT_PARAM), never from the field that displays it | Fix Round 3 |
| H | An entry the engine cannot run is refused with a message naming what is valid, and the setting is unchanged. A divergent entry is accepted and reaches the pathology path | Fix Round 3 |

## 4. The fuzz protocol

`tests/support/fuzz.ts`, `tests/fuzz/fuzz.test.ts`.

**How sequences are drawn.**
- **Determinism:** a seeded PRNG (mulberry32); the project never uses `Math.random`.
- **What it draws:** only actions the current screen offers. These are:
  - architecture edits and starting values;
  - step sizes, steps, scrubbing and selection;
  - mode switches and resets;
  - since Fix Round 3, typed entries: a valid alternative, a divergent value, an extreme value or an invalid entry.

**How runs are checked.**
- **Size:** 200 sequences of 6 actions per experiment, capped at 3 epochs per run so that the job fits in CI.
- **Check:** A–D after every action, and G and H after every typed entry.
- **Failures:** a failing sequence is written out as data, triaged, and kept in `tests/fuzz/regressions.json`, which the unit suite replays exactly.

## 5. The generated-document staleness job

**What it does.** The CI job `generated` (ADR-038) re-runs every deterministic producer of a committed file, then fails if `git status --porcelain` is non-empty. The producers are:
- the four test suites that write `reports/*.json`;
- `npm run report` (VALIDATION-REPORT, TRACE-STATISTICS, the NPM-SPEC generated sections);
- the schema generator;
- the Python result skeleton and the inventory review.

**What it does not regenerate.** Measurements (`reports/perf-*.json`, `memory.json`, `scale.json`) are inputs, not outputs. A report generated from them is regenerated and compared; the measurement itself is re-taken only by `npm run measure` or `scripts/measure-scale.ts`.

## 6. The five findings: a published number that was wrong

**The pattern.** Each time, a number or a verdict the repository published was wrong while every check passed. The failure was never in the code being measured. It was in the link between the code and the claim:
- a document not regenerated;
- a measurement taken under the wrong conditions;
- an assertion that could not fail.

Each finding below is now prevented by a control that runs without anyone remembering to do it.

| # | Finding | How it was caught | Control that now prevents it |
|---|---|---|---|
| 1 | **A stale generated document: TRACE-STATISTICS** no longer matched the code that generates it (Fix Round 1 Supplement). | Building the staleness job, which regenerates every document and diffs it | The `generated` CI job: every deterministic producer is re-run, and a dirty tree fails the build (ADR-038, §5) |
| 2 | **A second stale document: the engine performance table in VALIDATION-REPORT.** Found while building the same job. The report said 527 MB peak, while its committed input said 679 MB. | The same job, which regenerated the report from its input and showed the disagreement | The same job. Reports are generated only from committed inputs, never edited by hand (ADR-038) |
| 3 | **A memory peak inflated by a parallel e2e run.** The 679 MB reading came from a full e2e suite running in parallel, not from the CNN performance test alone. | Finding 2 exposed it; the protocol of every earlier reading was then re-checked: seven solo runs, 519–543 MB (ADR-045) | Measurements are inputs, re-taken only under the stated protocol: one test, one worker, nothing else running (§7) |
| 4 | **Hollow tests.** The vocabulary test validated blank screens: zustand v5 serves the initial state as the server snapshot, so every static render showed a screen with no run (ADR-050). The per-assertion audit then found **six further hollow assertions**: two e2e assertions (ADR-054); the three vocabulary screen tests, still hollow against the very defect that prompted the audit; and, in Fix Round 3, invariant G's test values, which could not detect rounding. | The first by writing invariant A, whose render had to show a run. The six by mutation: blank-page and no-action mutants per e2e assertion, blank-render and stale-snapshot mutants for the unit render tests, and application mutants for F–H | Every assertion is mutation-checked before it counts (§2): a new invariant ships with mutants that it must kill (`scripts/mutation/`) |
| 5 | **A cache-latency curve distorted by its measurement process** (Fix Round 3). The scale run's 25 % row read 4.85 ms per random access, against about 1 ms at 5 %. It was measured in the process that had just serialised and parsed 328 MiB, where young-generation GC pauses ran three times longer. The NPM-SPEC §9 table had been measured the same way, with every row in one long-lived process and 300 reads. | A reviewer asked for the shape to be explained, not just reported. `scripts/diagnose-cache.ts` separated hit rate, regeneration and bookkeeping; replays in fresh processes did not reproduce the spike; GC tracing found the mechanism | Every row of a performance or memory table is measured in its own fresh process with nothing else running. `measure-scale.ts` and `measure-memory.ts` both do this now, and §9 was regenerated under it (§7) |

**What the five share, and what they do not.**
- **The tests did their job; the evidence pipeline did not.** In no case did a test fail to catch a bug in the system.
- **The defence is the same in every case:** treat each published number as the output of a reproducible procedure, and check that the procedure itself can be seen to fail (a mutant, a regeneration diff, a fresh-process replay).
- **What remains unexplained** in finding 5: why young-generation GC was dearer after serialisation. The likely cause is the uncollected old generation, but it has not been isolated (VALIDATION-REPORT §5).

## 7. Measurement protocol

The rules the five findings imply. They apply to every number the repository publishes.

1. **Performance and memory are measured in a fresh process with nothing else running.**
   - Each table row has its own process, so earlier rows' garbage, JIT state and heap growth cannot affect later ones: `scripts/measure-memory.ts` and `scripts/measure-scale.ts` spawn one child per row or curve.
   - Browser measurements run one spec on one worker, never inside a parallel e2e run (`npm run measure`).
   - After an e2e run, the measurement files it rewrote (`reports/perf-*.json`, `memory.json`) are restored, never committed. *(Findings 3 and 5.)*
2. **Generated documents are regenerated in CI, and a dirty tree fails the build.** No generated table is edited by hand. Measurements are committed inputs; the documents built from them are outputs, and CI regenerates them. *(Findings 1 and 2.)*
3. **Every assertion is mutation-checked.** An assertion, invariant or check counts as evidence only after it has been seen to fail against a deliberate break of what it checks. A survivor is either fixed or shown to be an equivalent mutant (§2). *(Finding 4.)*
4. **Every number quoted outside the repository is traceable to a committed script.** That covers the paper, the S7 project report and slides. It means:
   - a committed input under `reports/`;
   - the script that produced it, with its command line;
   - the generated document that presents it.

   A number with no such trace is not quoted. A number that changes is changed at its source and regenerated, never edited where it is quoted.
5. **Run-to-run variation is part of the number.** The measured cost of one cache miss (recomputing one batch) varies by up to 2× between processes:
   - 0.85–1.13 ms within one process;
   - about 0.75–1.5 ms across processes, at the same scale.

   **Rows that differ by less than that margin are to be read as equal.** For example, NPM-SPEC §9's MLP rows at 5 % and 1 % (0.79 and 0.70 ms) are not a reversal. A claim that depends on a difference inside the margin needs repeated measurements and a spread, not a single row.

## 8. Counts

Totals of assertions mutation-checked and of assertions found hollow, by layer. Each is from the generated audit named.

| Layer | Checked | Hollow found | Source |
|---|---|---|---|
| e2e assertions (Fix Round 2c audit, commit `c513535`) | 228 | 2 (both fixed) | `docs/TEST-MUTATION-AUDIT.md` |
| Server-render unit tests | 96 | 3 (the vocabulary screen tests; fixed) | `docs/TEST-MUTATION-AUDIT.md` |
| Invariants A–E (one injected defect each) | 5 | 0 | PROGRESS, Fix Round 2b |
| Invariants F–H (12 mutants of the application) | 12 | 1 (G's test values; fixed, and all 12 now killed) | `reports/mutation-params.json` |
| Consumer tests (Fix Round 3): replay steps merged, an application import, a stale sample | 3 | 0 | `tests/unit/consumers.test.ts`, by hand |
| Numerical suites (wrong-rule and perturbed-value mutants) | 2 | 0 | VALIDATION-REPORT, `tests/unit/npm.test.ts` |
| **Total** | **346** | **6** (all fixed) | |

**Fix Round 3's own result.** On its first two runs the F–H mutation check found **one hollow check, twice over**; on the third run all 12 mutants were killed. *Typed numbers are rounded to one decimal place* survived invariant G.
- **First cause:** every value G typed was already round (presets, +1, +0.5), so rounding changed nothing.
- **Fix, and the second cause:** the test values were made deliberately non-round. The mutant survived again, because the test helper returned the *validated* value. The mutated validator had already rounded it, so the test compared the mutant with itself.
- **Second fix:** the helper now returns the value as typed.

This is the method working as intended: an invariant that passed on correct code was shown not to detect the defect it named.

**Not covered.** The roughly 400 `expect` statements in the rest of the unit suite (engine, IR, sessions, study, figures, claims) and the 22 in the numerical suites have not had the per-assertion treatment. They compare against independent oracles (finite differences, TensorFlow.js, a second run, the independent verifier), which is a lower risk than screen tests. The method's next step is to extend the mechanical mutants to them.

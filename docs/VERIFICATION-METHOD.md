# Verification Method: An Assertion Is Evidence Only Once It Has Been Seen to Fail

**Why this is a named contribution (Fix Round 3, B3.2).** Three times in this project a green build meant nothing:
- two generated documents had silently gone stale;
- one test had been validating blank screens.

None was caught by the test it concerned. Each was caught by a check designed to make a test fail on purpose. The method below came out of those findings and now governs every assertion added to the repository, including this round's.

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

## 6. The three findings, and how each was caught

| # | Finding | How it was caught | What changed |
|---|---|---|---|
| 1 | **TRACE-STATISTICS and the engine performance table had gone stale.** The committed documents no longer matched the code that generates them. | Building the staleness job: regenerating every document and diffing | The `generated` CI job (ADR-038) |
| 2 | **VALIDATION-REPORT contradicted its own input.** It said 527 MB peak while the committed measurement said 679 MB, from a contended parallel run. | The same job, which regenerated the report from its input | Measurements are inputs, re-taken only under the stated protocol; the 679 MB reading is excluded (ADR-038, ADR-045) |
| 3 | **The vocabulary test validated blank screens.** zustand v5 serves the initial state as the server snapshot, so every static render showed a screen with no run, and the test passed. After a first fix, the three screen tests were *still* hollow against the very defect that prompted it. | Writing invariant A, whose render had to show a run (ADR-050); then the stale-snapshot mutant (ADR-054) | Static renders read the current state; each screen test asserts the cursor it rendered at |

## 7. Counts

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

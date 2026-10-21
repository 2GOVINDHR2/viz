# Test Mutation Audit (Fix Round 2c)

**What it checks:** for every assertion in the e2e suite, that it fails when the behaviour it checks is deliberately broken. An assertion that still passes is *hollow*: it reports success whatever the app does.

**Why now:** this round follows three silent passes — two stale generated reports and the vocabulary test that checked empty screens (ADR-050).

**This file is generated** by `scripts/mutation/report.py`. Do not edit it by hand.

## Method

Each assertion statement is one unit. An `expect(…)` inside a loop or a helper counts once, wherever it is.

1. **Mechanical mutants** (`scripts/mutation/e2e-mutants.ts`). Two per assertion, and line numbers are preserved, so a failure can be attributed exactly:
   - **blank:** empty the page just before the assertion;
   - **no-action:** delete the nearest preceding interaction.
2. **Kill criterion:** the assertion is *live* only if its test then fails **at that assertion's line**. A failure anywhere else does not count.
3. **Targeted mutants** (`reports/mutation-targeted.json`). An assertion no mechanical mutant could reach gets a hand-written mutation of the app or the test input, aimed at its exact target. This covers:
   - negative assertions ("no violations", "nothing undeclared renders"), which survive blanking by construction;
   - assertions on downloaded files;
   - assertions in helpers shared across specs.

## Result

| | Assertions |
|---|---|
| Assertions in the suite before the audit | 228 |
| live (mechanical) | 186 |
| live (targeted) | 40 |
| hollow, fixed | 2 |
| hollow | 0 |
| unverified | 0 |
| Added by the audit (replacing a hollow one): `controls.spec:477` | live (targeted) |

| Spec file | Assertions |
|---|---|
| a11y.spec.ts | 7 |
| app.spec.ts | 14 |
| cnn.spec.ts | 13 |
| controls.spec.ts | 122 |
| curriculum.spec.ts | 17 |
| export.spec.ts | 10 |
| helpers.ts | 1 |
| playground.spec.ts | 7 |
| study.spec.ts | 23 |
| views.spec.ts | 14 |

## Hollow assertions found (2)

| Assertion | What it claimed to check | Mutant it survived | Fix |
|---|---|---|---|
| `controls.spec:255` | `expect(after.length).toBeGreaterThan(0)` on a trace the test generated itself | none needed: cannot fail: it never reads the app | deleted; what it claimed (the app shows the edited run) is the `describesEnd` check two lines below, which is live |
| `controls.spec:476` | `expect(actions).toBe(<number of registry actions>)` | none needed: counts the same registry loop on both sides, so it cannot fail | replaced by `expect(actions).toBe(31)`, the audited count (`controls.spec:477`, verified by a targeted mutant) |

## Unit suite: the server-render tests

These are the unit tests that render screens on the server: the class of the hollow vocabulary test.

**Tests checked:** 96, in 7 files. Two whole-suite mutants were applied:

1. **Blank render.** Every server render returns an empty screen (`scripts/mutation/vitest.blank.config.ts`).
   - 51 tests fail, as they should.
   - 45 still pass, and each one was read. They either render nothing (they test declarations, the term list, the invariant checker or a contract), or they are the negative half of a parametrised test whose positive half fails.
   - None is hollow.
2. **Stale snapshot.** `renderCurrentState()` becomes a no-op, so a static render shows the store's initial state again (the ADR-050 defect).
   - **3 tests were hollow:** the three vocabulary screen tests, one per purpose-built screen.
   - They passed with screens that carried no run, because they checked only text that renders either way.
   - Each now asserts the cursor it rendered at, and fails under this mutant.
   - Every other test that passed under this mutant receives its state as props, not from the store, so the mutant cannot affect it.

| Test file | Test | Blank render | Stale snapshot | Reading |
|---|---|---|---|---|
| explanation-panel.test.ts | explanation verbosity changes the output single-neuron | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| explanation-panel.test.ts | explanation verbosity changes the output xor-mlp | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| fuzz-regressions.test.ts | E. kept fuzz regressions the regression file parses | passed | passed | checks the regression file parses; renders nothing |
| fuzz-regressions.test.ts | E. kept fuzz regressions xor-mlp seed 193748083 (mutation check (reset not clearing the se | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | every instruction lights its target in the view 1 A single neuron | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | every instruction lights its target in the view 2 Activation functions | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | every instruction lights its target in the view 3 Forward propagation | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | every instruction lights its target in the view 4 Loss functions | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | every instruction lights its target in the view 5 Gradient descent | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | every instruction lights its target in the view 6 Back-propagation | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | every instruction lights its target in the view 7 XOR needs a hidden layer | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | every instruction lights its target in the view 8 A CNN on handwritten digits | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | every instruction lights its target in the view D1 Vanishing gradients | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | every instruction lights its target in the view D2 Learning-rate pathology | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| illumination.test.ts | the lit element is the right one a bias update lights the bias, not the weights | passed | passed | checks the illumination contract directly; renders nothing |
| invariants.test.ts | A, C and D on every experiment, in both modes 1 A single neuron (expert) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 1 A single neuron (novice) | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 2 Activation functions (expert) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 2 Activation functions (novice) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 3 Forward propagation (expert) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 3 Forward propagation (novice) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 4 Loss functions (expert) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 4 Loss functions (novice) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 5 Gradient descent (expert) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 5 Gradient descent (novice) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 6 Back-propagation (expert) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 6 Back-propagation (novice) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 7 XOR needs a hidden layer (expert) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 7 XOR needs a hidden layer (novice) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 8 A CNN on handwritten digits (expert) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes 8 A CNN on handwritten digits (novice) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes D1 Vanishing gradients (expert) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes D1 Vanishing gradients (novice) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes D2 Learning-rate pathology (expert) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A, C and D on every experiment, in both modes D2 Learning-rate pathology (novice) | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | A. reset is a required control of every experiment screen 1 expert | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 1 novice | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 2 expert | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 2 novice | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 3 expert | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 3 novice | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 4 expert | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 4 novice | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 5 expert | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 5 novice | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 6 expert | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 6 novice | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 7 expert | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 7 novice | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 8 expert | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen 8 novice | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen D1 expert | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen D1 novice | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen D2 expert | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | A. reset is a required control of every experiment screen D2 novice | passed | passed | checks a declaration; renders nothing |
| invariants.test.ts | B. every parameter stays reachable and editable after every architecture mutation 1 A sing | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | B. every parameter stays reachable and editable after every architecture mutation 2 Activa | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | B. every parameter stays reachable and editable after every architecture mutation 3 Forwar | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | B. every parameter stays reachable and editable after every architecture mutation 6 Back-p | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | B. every parameter stays reachable and editable after every architecture mutation 7 XOR ne | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | B. every parameter stays reachable and editable after every architecture mutation D1 Vanis | failed | failed | fails when every render is blank (renders and checks what it rendered) |
| invariants.test.ts | the invariants catch the defects they were written for (fault injection) A catches a scree | passed | passed | tests the invariant checker, which reports the fault on any render |
| invariants.test.ts | the invariants catch the defects they were written for (fault injection) B catches a param | passed | passed | tests the invariant checker, which reports the fault on any render |
| invariants.test.ts | the invariants catch the defects they were written for (fault injection) C catches a panel | passed | passed | tests the invariant checker, which reports the fault on any render |
| surface.test.ts | granularity unlocked by the curriculum 1 A single neuron: declares only taught step sizes; | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum 2 Activation functions: declares only taught step s | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum 3 Forward propagation: declares only taught step si | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum 4 Loss functions: declares only taught step sizes;  | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum 5 Gradient descent: declares only taught step sizes | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum 6 Back-propagation: declares only taught step sizes | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum 7 XOR needs a hidden layer: declares only taught st | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum 8 A CNN on handwritten digits: declares only taught | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum D1 Vanishing gradients: declares only taught step s | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum D2 Learning-rate pathology: declares only taught st | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum every step size is available by the CNN experiment | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | granularity unlocked by the curriculum follows the table of the brief | passed | passed | checks a declaration; renders nothing |
| surface.test.ts | the architecture editor renders only where declared (§3.3) 1 A single neuron: "add hidden  | passed | passed | negative half of a parametrised test whose positive half ("is offered") fails under the blank render |
| surface.test.ts | the architecture editor renders only where declared (§3.3) 2 Activation functions: "add hi | passed | passed | negative half of a parametrised test whose positive half ("is offered") fails under the blank render |
| surface.test.ts | the architecture editor renders only where declared (§3.3) 3 Forward propagation: "add hid | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| surface.test.ts | the architecture editor renders only where declared (§3.3) 4 Loss functions: "add hidden l | passed | passed | negative half of a parametrised test whose positive half ("is offered") fails under the blank render |
| surface.test.ts | the architecture editor renders only where declared (§3.3) 5 Gradient descent: "add hidden | passed | passed | negative half of a parametrised test whose positive half ("is offered") fails under the blank render |
| surface.test.ts | the architecture editor renders only where declared (§3.3) 6 Back-propagation: "add hidden | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| surface.test.ts | the architecture editor renders only where declared (§3.3) 7 XOR needs a hidden layer: "ad | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| surface.test.ts | the architecture editor renders only where declared (§3.3) D1 Vanishing gradients: "add hi | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| surface.test.ts | the architecture editor renders only where declared (§3.3) D2 Learning-rate pathology: "ad | passed | passed | negative half of a parametrised test whose positive half ("is offered") fails under the blank render |
| surface.test.ts | the architecture editor renders only where declared (§3.3) declared exactly for experiment | passed | passed | checks a declaration; renders nothing |
| views-from-trace.test.ts | views render from the trace alone cursor -1 | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| views-from-trace.test.ts | views render from the trace alone cursor 10 | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| views-from-trace.test.ts | views render from the trace alone cursor 231 | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| views-from-trace.test.ts | views render from the trace alone cursor 25 | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| views-from-trace.test.ts | views render from the trace alone cursor 60 | failed | passed | fails when every render is blank (renders and checks what it rendered) |
| vocabulary.test.ts | vocabulary follows the curriculum backpropagation: the screen and its narration use only t | failed | passed before the fix (hollow); fails after it | fails when every render is blank (renders and checks what it rendered) |
| vocabulary.test.ts | vocabulary follows the curriculum every term is introduced by a real experiment or kept to | passed | passed | checks the term list and the checker; renders nothing |
| vocabulary.test.ts | vocabulary follows the curriculum gradient-descent: the screen and its narration use only  | failed | passed before the fix (hollow); fails after it | fails when every render is blank (renders and checks what it rendered) |
| vocabulary.test.ts | vocabulary follows the curriculum single-neuron: the screen and its narration use only ter | failed | passed before the fix (hollow); fails after it | fails when every render is blank (renders and checks what it rendered) |
| vocabulary.test.ts | vocabulary follows the curriculum the check catches a term used too early | passed | passed | checks the term list and the checker; renders nothing |

## Screenshot generators

**The scripts:** `scripts/gen-slides.ts` (the C1 study material), `scripts/cold-review-shots.ts`, and `scripts/gen-palette-summary.ts` / `scripts/gen-palette-sheet.ts`.

**Before this round:** they had **no content assertions**. Their only checks waited for the page to settle. That is how the D2 slide could say "watch the path" while showing no path: a *Show me* action that changed nothing produced a plausible slide.

**Now:**
- `gen-slides.ts` fails if a *Show me* action leaves the screen pixel-identical.
- **Verified by mutation:** with walkthrough step actions disabled, generation stops at "single-neuron step 2: the "Show me" action changed nothing on screen".
- The palette scripts are measurement captures. Their numbers come from `reports/cvd.json`, which the unit suite computes and checks; they are not assertions about behaviour.

## Not covered by this audit

- **The rest of the unit suite:** 400 `expect` statements in the other unit files (engine, IR, sessions, study, figures, claims).
- **The numerical suites:** 22 `expect` statements in the gradcheck, parity and determinism suites. These compare against independent oracles (finite differences, TensorFlow.js, a second run), which is a lower risk than screen tests.
- Neither group has yet had the per-assertion treatment.
- **The two perf specs:** measurements, not behaviour checks.

## Targeted mutants

| Assertion | Mutant | Outcome |
|---|---|---|
| `app.spec:35` | a page error is thrown before the assertion | killed |
| `cnn.spec:52` | a page error is thrown before the assertion | killed |
| `playground.spec:35` | a page error is thrown before the assertion | killed |
| `playground.spec:34` | the page fetches an external URL before the assertion | killed |
| `playground.spec:31` | the vendored font file is renamed so it cannot load | killed |
| `cnn.spec:30` | the "(trace: …)" part is removed from the computation | killed |
| `cnn.spec:31` | the trace value shown is the next cell's | killed |
| `controls.spec:177` | playback ignores the speed setting | killed |
| `controls.spec:229` | the learning-rate case uses a stable rate, so nothing explodes | killed |
| `controls.spec:259` | the edit picks the option already selected | killed |
| `controls.spec:364` | the panel also carries a value tagged with the next neuron | killed |
| `controls.spec:383` | neither reset nor regeneration clears the selection | killed |
| `controls.spec:418` | Simple starts with the maths shown | killed |
| `controls.spec:419` | Simple shows the instruction name | killed |
| `controls.spec:477` | one walkthrough action is dropped from the registry | killed |
| `controls.spec:495` | build number 2 never finishes | killed |
| `controls.spec:498` | build number 3 never finishes | killed |
| `controls.spec:515` | build number 4 never finishes | killed |
| `export.spec:28` | build number 2 never finishes | killed |
| `export.spec:32` | build number 3 never finishes | killed |
| `controls.spec:569` | the novice screen also renders a workbench control block | killed |
| `controls.spec:572` | experiment 6 also offers "one full pass" | killed |
| `controls.spec:597` | the breakpoints are rendered outside the disclosure | killed |
| `controls.spec:602` | the novice workbench offers all six | killed |
| `controls.spec:606` | the structure editor is allowed everywhere | killed |
| `controls.spec:609` | the export panel renders in both modes | killed |
| `controls.spec:650` | loading an example counts as a calculation | killed |
| `controls.spec:655` | the list opens by default | killed |
| `export.spec:24` | the single-figure download is prefixed with an XML declaration | killed |
| `export.spec:46` | the ZIP omits the CSVs | killed |
| `export.spec:49` | the mode suffix is dropped from file names | killed |
| `export.spec:50` | greyscale draws its first data series in blue | killed |
| `export.spec:51` | edited captions are ignored | killed |
| `helpers:32` | the page is emptied before the helper's check | killed |
| `study.spec:145` | the telemetry_events file is left out | killed |
| `study.spec:154` | every participant is exported as not completed | killed |
| `study.spec:165` | no step is counted | killed |
| `study.spec:166` | back steps are not counted | killed |
| `study.spec:167` | explanation opens are not counted | killed |
| `study.spec:168` | quotes are stripped from feedback on export | killed |
| `views.spec:50` | the diagram draws at least four neurons per layer | killed |

## Every assertion

| Assertion | Function | blank | no-action | Verdict |
|---|---|---|---|---|
| `a11y.spec:29` | audit | killed | n/a | live (mechanical) |
| `a11y.spec:73` | every experiment, mid-run, with the export panel open | killed | killed | live (mechanical) |
| `a11y.spec:88` | parameter editor open and the bound inspector with a weight  | killed | killed | live (mechanical) |
| `a11y.spec:91` | parameter editor open and the bound inspector with a weight  | killed | killed | live (mechanical) |
| `a11y.spec:107` | every novice screen (Fix Round 2): first view, after a predi | killed | survived | live (mechanical) |
| `a11y.spec:111` | every novice screen (Fix Round 2): first view, after a predi | killed | survived | live (mechanical) |
| `a11y.spec:143` | every Study Mode screen | killed | killed | live (mechanical) |
| `app.spec:11` | loads, steps forward and back, explains, and runs to a break | killed | killed | live (mechanical) |
| `app.spec:15` | loads, steps forward and back, explains, and runs to a break | killed | killed | live (mechanical) |
| `app.spec:16` | loads, steps forward and back, explains, and runs to a break | killed | elsewhere | live (mechanical) |
| `app.spec:21` | loads, steps forward and back, explains, and runs to a break | killed | killed | live (mechanical) |
| `app.spec:22` | loads, steps forward and back, explains, and runs to a break | killed | elsewhere | live (mechanical) |
| `app.spec:23` | loads, steps forward and back, explains, and runs to a break | killed | elsewhere | live (mechanical) |
| `app.spec:28` | loads, steps forward and back, explains, and runs to a break | killed | killed | live (mechanical) |
| `app.spec:29` | loads, steps forward and back, explains, and runs to a break | killed | elsewhere | live (mechanical) |
| `app.spec:30` | loads, steps forward and back, explains, and runs to a break | killed | elsewhere | live (mechanical) |
| `app.spec:34` | loads, steps forward and back, explains, and runs to a break | killed | killed | live (mechanical) |
| `app.spec:35` | loads, steps forward and back, explains, and runs to a break | survived | elsewhere | live (targeted) |
| `app.spec:48` | both experiments run end to end to the last instruction | killed | killed | live (mechanical) |
| `app.spec:49` | both experiments run end to end to the last instruction | killed | elsewhere | live (mechanical) |
| `app.spec:62` | neurons are keyboard-focusable and focus changes the explana | killed | killed | live (mechanical) |
| `cnn.spec:12` | CNN experiment: trains in the worker, shows kernels, sliding | killed | killed | live (mechanical) |
| `cnn.spec:14` | CNN experiment: trains in the worker, shows kernels, sliding | killed | elsewhere | live (mechanical) |
| `cnn.spec:21` | CNN experiment: trains in the worker, shows kernels, sliding | killed | killed | live (mechanical) |
| `cnn.spec:22` | CNN experiment: trains in the worker, shows kernels, sliding | killed | elsewhere | live (mechanical) |
| `cnn.spec:23` | CNN experiment: trains in the worker, shows kernels, sliding | killed | elsewhere | live (mechanical) |
| `cnn.spec:30` | CNN experiment: trains in the worker, shows kernels, sliding | elsewhere | elsewhere | live (targeted) |
| `cnn.spec:31` | CNN experiment: trains in the worker, shows kernels, sliding | elsewhere | elsewhere | live (targeted) |
| `cnn.spec:32` | CNN experiment: trains in the worker, shows kernels, sliding | killed | killed | live (mechanical) |
| `cnn.spec:39` | CNN experiment: trains in the worker, shows kernels, sliding | killed | killed | live (mechanical) |
| `cnn.spec:45` | CNN experiment: trains in the worker, shows kernels, sliding | killed | killed | live (mechanical) |
| `cnn.spec:48` | CNN experiment: trains in the worker, shows kernels, sliding | killed | killed | live (mechanical) |
| `cnn.spec:49` | CNN experiment: trains in the worker, shows kernels, sliding | killed | elsewhere | live (mechanical) |
| `cnn.spec:52` | CNN experiment: trains in the worker, shows kernels, sliding | survived | elsewhere | live (targeted) |
| `controls.spec:69` | expectCursor | killed | n/a | live (mechanical) |
| `controls.spec:92` | ready | killed | n/a | live (mechanical) |
| `controls.spec:133` | keyboard: arrows step, digits choose the step size, Home res | killed | killed | live (mechanical) |
| `controls.spec:147` | keyboard: arrows step, digits choose the step size, Home res | killed | killed | live (mechanical) |
| `controls.spec:151` | keyboard: arrows step, digits choose the step size, Home res | killed | killed | live (mechanical) |
| `controls.spec:177` | scrubber, reset, run/pause and speed change the position as  | survived | elsewhere | live (targeted) |
| `controls.spec:221` | each breakpoint toggle changes where "To breakpoint" stops,  | killed | elsewhere | live (mechanical) |
| `controls.spec:229` | each breakpoint toggle changes where "To breakpoint" stops,  | survived | elsewhere | live (targeted) |
| `controls.spec:255` | every declared parameter edit changes the computation and th | elsewhere | elsewhere | hollow, fixed |
| `controls.spec:258` | every declared parameter edit changes the computation and th | elsewhere | killed | live (mechanical) |
| `controls.spec:259` | every declared parameter edit changes the computation and th | elsewhere | elsewhere | live (targeted) |
| `controls.spec:276` | the CNN’s two declared parameters regenerate the run with th | killed | killed | live (mechanical) |
| `controls.spec:285` | the CNN’s two declared parameters regenerate the run with th | killed | elsewhere | live (mechanical) |
| `controls.spec:294` | structure view: expanding, editing each field, adding and re | killed | killed | live (mechanical) |
| `controls.spec:296` | structure view: expanding, editing each field, adding and re | elsewhere | killed | live (mechanical) |
| `controls.spec:301` | structure view: expanding, editing each field, adding and re | killed | killed | live (mechanical) |
| `controls.spec:302` | structure view: expanding, editing each field, adding and re | killed | elsewhere | live (mechanical) |
| `controls.spec:308` | structure view: expanding, editing each field, adding and re | killed | killed | live (mechanical) |
| `controls.spec:309` | structure view: expanding, editing each field, adding and re | killed | elsewhere | live (mechanical) |
| `controls.spec:312` | structure view: expanding, editing each field, adding and re | killed | killed | live (mechanical) |
| `controls.spec:313` | structure view: expanding, editing each field, adding and re | killed | elsewhere | live (mechanical) |
| `controls.spec:320` | network and inspector: a neuron, a weight, and clearing the  | killed | killed | live (mechanical) |
| `controls.spec:322` | network and inspector: a neuron, a weight, and clearing the  | killed | killed | live (mechanical) |
| `controls.spec:324` | network and inspector: a neuron, a weight, and clearing the  | killed | killed | live (mechanical) |
| `controls.spec:337` | parameter editor: a layer added by the structure editor has  | killed | killed | live (mechanical) |
| `controls.spec:345` | parameter editor: a layer added by the structure editor has  | killed | killed | live (mechanical) |
| `controls.spec:350` | parameter editor: a layer added by the structure editor has  | killed | killed | live (mechanical) |
| `controls.spec:362` | inspector: the panel names the element, shows its values and | killed | killed | live (mechanical) |
| `controls.spec:363` | inspector: the panel names the element, shows its values and | killed | elsewhere | live (mechanical) |
| `controls.spec:364` | inspector: the panel names the element, shows its values and | elsewhere | elsewhere | live (targeted) |
| `controls.spec:365` | inspector: the panel names the element, shows its values and | killed | elsewhere | live (mechanical) |
| `controls.spec:366` | inspector: the panel names the element, shows its values and | killed | elsewhere | live (mechanical) |
| `controls.spec:376` | reset experiment: an edited, moved, selected experiment retu | killed | killed | live (mechanical) |
| `controls.spec:381` | reset experiment: an edited, moved, selected experiment retu | killed | elsewhere | live (mechanical) |
| `controls.spec:383` | reset experiment: an edited, moved, selected experiment retu | survived | elsewhere | live (targeted) |
| `controls.spec:396` | training view: the gradient heat map and the table view | killed | killed | live (mechanical) |
| `controls.spec:404` | walkthrough: next, previous, hide and show change what is sh | killed | killed | live (mechanical) |
| `controls.spec:406` | walkthrough: next, previous, hide and show change what is sh | killed | killed | live (mechanical) |
| `controls.spec:408` | walkthrough: next, previous, hide and show change what is sh | elsewhere | killed | live (mechanical) |
| `controls.spec:410` | walkthrough: next, previous, hide and show change what is sh | killed | killed | live (mechanical) |
| `controls.spec:418` | explanation: Simple/Detailed and the two in-place reveals ch | elsewhere | survived | live (targeted) |
| `controls.spec:419` | explanation: Simple/Detailed and the two in-place reveals ch | elsewhere | survived | live (targeted) |
| `controls.spec:421` | explanation: Simple/Detailed and the two in-place reveals ch | killed | killed | live (mechanical) |
| `controls.spec:423` | explanation: Simple/Detailed and the two in-place reveals ch | killed | killed | live (mechanical) |
| `controls.spec:425` | explanation: Simple/Detailed and the two in-place reveals ch | killed | killed | live (mechanical) |
| `controls.spec:427` | explanation: Simple/Detailed and the two in-place reveals ch | killed | killed | live (mechanical) |
| `controls.spec:428` | explanation: Simple/Detailed and the two in-place reveals ch | killed | elsewhere | live (mechanical) |
| `controls.spec:438` | self-check: every option of every question gives its own fee | killed | killed | live (mechanical) |
| `controls.spec:468` | walkthrough: every "Show me" action changes the position, th | killed | elsewhere | live (mechanical) |
| `controls.spec:469` | walkthrough: every "Show me" action changes the position, th | killed | killed | live (mechanical) |
| `controls.spec:476` | walkthrough: every "Show me" action changes the position, th | survived | elsewhere | hollow, fixed |
| `controls.spec:485` | export: high contrast, back to colour, refresh at the cursor | killed | killed | live (mechanical) |
| `controls.spec:495` | export: high contrast, back to colour, refresh at the cursor | elsewhere | elsewhere | live (targeted) |
| `controls.spec:496` | export: high contrast, back to colour, refresh at the cursor | killed | killed | live (mechanical) |
| `controls.spec:498` | export: high contrast, back to colour, refresh at the cursor | elsewhere | elsewhere | live (targeted) |
| `controls.spec:499` | export: high contrast, back to colour, refresh at the cursor | killed | killed | live (mechanical) |
| `controls.spec:515` | export: high contrast, back to colour, refresh at the cursor | elsewhere | elsewhere | live (targeted) |
| `controls.spec:517` | export: high contrast, back to colour, refresh at the cursor | survived | killed | live (mechanical) |
| `controls.spec:530` | every curriculum button opens its experiment | killed | killed | live (mechanical) |
| `controls.spec:537` | switching mode keeps the position, in both directions | killed | elsewhere | live (mechanical) |
| `controls.spec:538` | switching mode keeps the position, in both directions | killed | elsewhere | live (mechanical) |
| `controls.spec:548` | switching mode keeps the position, in both directions | killed | killed | live (mechanical) |
| `controls.spec:549` | switching mode keeps the position, in both directions | killed | elsewhere | live (mechanical) |
| `controls.spec:551` | switching mode keeps the position, in both directions | killed | killed | live (mechanical) |
| `controls.spec:554` | switching mode keeps the position, in both directions | killed | killed | live (mechanical) |
| `controls.spec:555` | switching mode keeps the position, in both directions | killed | elsewhere | live (mechanical) |
| `controls.spec:558` | switching mode keeps the position, in both directions | killed | survived | live (mechanical) |
| `controls.spec:569` | no control renders that the experiment has not declared | elsewhere | elsewhere | live (targeted) |
| `controls.spec:572` | no control renders that the experiment has not declared | elsewhere | elsewhere | live (targeted) |
| `controls.spec:597` | no control renders that the experiment has not declared | elsewhere | elsewhere | live (targeted) |
| `controls.spec:600` | no control renders that the experiment has not declared | killed | killed | live (mechanical) |
| `controls.spec:602` | no control renders that the experiment has not declared | elsewhere | elsewhere | live (targeted) |
| `controls.spec:605` | no control renders that the experiment has not declared | killed | elsewhere | live (mechanical) |
| `controls.spec:606` | no control renders that the experiment has not declared | elsewhere | elsewhere | live (targeted) |
| `controls.spec:609` | no control renders that the experiment has not declared | elsewhere | elsewhere | live (targeted) |
| `controls.spec:635` | deeper | killed | killed | live (mechanical) |
| `controls.spec:645` | novice steps narrate what they pass, and the list expands to | killed | n/a | live (mechanical) |
| `controls.spec:650` | novice steps narrate what they pass, and the list expands to | elsewhere | elsewhere | live (targeted) |
| `controls.spec:652` | novice steps narrate what they pass, and the list expands to | killed | elsewhere | live (mechanical) |
| `controls.spec:655` | novice steps narrate what they pass, and the list expands to | elsewhere | elsewhere | live (targeted) |
| `controls.spec:657` | novice steps narrate what they pass, and the list expands to | killed | killed | live (mechanical) |
| `controls.spec:658` | novice steps narrate what they pass, and the list expands to | killed | elsewhere | live (mechanical) |
| `controls.spec:659` | novice steps narrate what they pass, and the list expands to | killed | elsewhere | live (mechanical) |
| `controls.spec:662` | novice steps narrate what they pass, and the list expands to | survived | killed | live (mechanical) |
| `controls.spec:666` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | n/a | live (mechanical) |
| `controls.spec:685` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | killed | live (mechanical) |
| `controls.spec:687` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | elsewhere | live (mechanical) |
| `controls.spec:691` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | killed | live (mechanical) |
| `controls.spec:692` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | elsewhere | live (mechanical) |
| `controls.spec:697` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | killed | live (mechanical) |
| `controls.spec:700` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | killed | live (mechanical) |
| `controls.spec:702` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | killed | live (mechanical) |
| `controls.spec:704` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | killed | live (mechanical) |
| `controls.spec:706` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | killed | live (mechanical) |
| `controls.spec:708` | 1 single neuron: step, sliders, prediction and reveal, learn | killed | killed | live (mechanical) |
| `controls.spec:714` | 1 single neuron: reset experiment restores the sliders, the  | killed | n/a | live (mechanical) |
| `controls.spec:720` | 1 single neuron: reset experiment restores the sliders, the  | killed | killed | live (mechanical) |
| `controls.spec:722` | 1 single neuron: reset experiment restores the sliders, the  | killed | elsewhere | live (mechanical) |
| `controls.spec:729` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | elsewhere | live (mechanical) |
| `controls.spec:748` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | killed | live (mechanical) |
| `controls.spec:752` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | killed | live (mechanical) |
| `controls.spec:759` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | killed | live (mechanical) |
| `controls.spec:760` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | elsewhere | live (mechanical) |
| `controls.spec:762` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | killed | live (mechanical) |
| `controls.spec:763` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | elsewhere | live (mechanical) |
| `controls.spec:773` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | killed | live (mechanical) |
| `controls.spec:776` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | elsewhere | live (mechanical) |
| `controls.spec:791` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | killed | live (mechanical) |
| `controls.spec:792` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | elsewhere | live (mechanical) |
| `controls.spec:795` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | killed | live (mechanical) |
| `controls.spec:797` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | killed | live (mechanical) |
| `controls.spec:799` | 5 gradient descent: step sizes, play, jump, learning rate an | killed | killed | live (mechanical) |
| `controls.spec:806` | 6 back-propagation: three step sizes, following a weight, pr | killed | elsewhere | live (mechanical) |
| `controls.spec:829` | 6 back-propagation: three step sizes, following a weight, pr | killed | killed | live (mechanical) |
| `controls.spec:842` | 6 back-propagation: three step sizes, following a weight, pr | killed | killed | live (mechanical) |
| `controls.spec:845` | 6 back-propagation: three step sizes, following a weight, pr | killed | killed | live (mechanical) |
| `controls.spec:846` | 6 back-propagation: three step sizes, following a weight, pr | killed | elsewhere | live (mechanical) |
| `controls.spec:848` | 6 back-propagation: three step sizes, following a weight, pr | elsewhere | killed | live (mechanical) |
| `controls.spec:850` | 6 back-propagation: three step sizes, following a weight, pr | killed | killed | live (mechanical) |
| `controls.spec:852` | 6 back-propagation: three step sizes, following a weight, pr | killed | killed | live (mechanical) |
| `controls.spec:854` | 6 back-propagation: three step sizes, following a weight, pr | killed | killed | live (mechanical) |
| `controls.spec:857` | 6 back-propagation: three step sizes, following a weight, pr | killed | killed | live (mechanical) |
| `curriculum.spec:7` | prerequisites lock later experiments until the self-check is | killed | killed | live (mechanical) |
| `curriculum.spec:9` | prerequisites lock later experiments until the self-check is | killed | elsewhere | live (mechanical) |
| `curriculum.spec:10` | prerequisites lock later experiments until the self-check is | killed | elsewhere | live (mechanical) |
| `curriculum.spec:13` | prerequisites lock later experiments until the self-check is | killed | killed | live (mechanical) |
| `curriculum.spec:16` | prerequisites lock later experiments until the self-check is | killed | killed | live (mechanical) |
| `curriculum.spec:17` | prerequisites lock later experiments until the self-check is | killed | elsewhere | live (mechanical) |
| `curriculum.spec:19` | prerequisites lock later experiments until the self-check is | killed | killed | live (mechanical) |
| `curriculum.spec:24` | the walkthrough performs its steps and resumes after a reloa | killed | killed | live (mechanical) |
| `curriculum.spec:25` | the walkthrough performs its steps and resumes after a reloa | killed | elsewhere | live (mechanical) |
| `curriculum.spec:28` | the walkthrough performs its steps and resumes after a reloa | killed | killed | live (mechanical) |
| `curriculum.spec:31` | the walkthrough performs its steps and resumes after a reloa | killed | killed | live (mechanical) |
| `curriculum.spec:34` | the walkthrough performs its steps and resumes after a reloa | killed | elsewhere | live (mechanical) |
| `curriculum.spec:36` | the walkthrough performs its steps and resumes after a reloa | killed | killed | live (mechanical) |
| `curriculum.spec:41` | a chosen starting weight restarts the run with that value | killed | killed | live (mechanical) |
| `curriculum.spec:46` | a chosen starting weight restarts the run with that value | killed | killed | live (mechanical) |
| `curriculum.spec:49` | a chosen starting weight restarts the run with that value | killed | elsewhere | live (mechanical) |
| `curriculum.spec:52` | a chosen starting weight restarts the run with that value | killed | killed | live (mechanical) |
| `export.spec:11` | figure export: the standard set at the cursor as SVG, CSV an | killed | killed | live (mechanical) |
| `export.spec:15` | figure export: the standard set at the cursor as SVG, CSV an | killed | killed | live (mechanical) |
| `export.spec:24` | figure export: the standard set at the cursor as SVG, CSV an | elsewhere | elsewhere | live (targeted) |
| `export.spec:28` | figure export: the standard set at the cursor as SVG, CSV an | elsewhere | elsewhere | live (targeted) |
| `export.spec:32` | figure export: the standard set at the cursor as SVG, CSV an | elsewhere | elsewhere | live (targeted) |
| `export.spec:46` | figure export: the standard set at the cursor as SVG, CSV an | elsewhere | elsewhere | live (targeted) |
| `export.spec:49` | figure export: the standard set at the cursor as SVG, CSV an | elsewhere | elsewhere | live (targeted) |
| `export.spec:50` | figure export: the standard set at the cursor as SVG, CSV an | elsewhere | elsewhere | live (targeted) |
| `export.spec:51` | figure export: the standard set at the cursor as SVG, CSV an | elsewhere | elsewhere | live (targeted) |
| `export.spec:58` | figure export: the standard set at the cursor as SVG, CSV an | survived | killed | live (mechanical) |
| `helpers:32` | openExperiment | n/a | n/a | live (targeted) |
| `playground.spec:26` | the vendored TensorFlow Playground runs offline with the tas | killed | killed | live (mechanical) |
| `playground.spec:28` | the vendored TensorFlow Playground runs offline with the tas | killed | elsewhere | live (mechanical) |
| `playground.spec:29` | the vendored TensorFlow Playground runs offline with the tas | killed | elsewhere | live (mechanical) |
| `playground.spec:31` | the vendored TensorFlow Playground runs offline with the tas | elsewhere | elsewhere | live (targeted) |
| `playground.spec:33` | the vendored TensorFlow Playground runs offline with the tas | killed | killed | live (mechanical) |
| `playground.spec:34` | the vendored TensorFlow Playground runs offline with the tas | survived | elsewhere | live (targeted) |
| `playground.spec:35` | the vendored TensorFlow Playground runs offline with the tas | survived | elsewhere | live (targeted) |
| `study.spec:12` | setup | killed | killed | live (mechanical) |
| `study.spec:13` | setup | killed | elsewhere | live (mechanical) |
| `study.spec:15` | setup | elsewhere | killed | live (mechanical) |
| `study.spec:23` | consentAndDemographics | killed | killed | live (mechanical) |
| `study.spec:25` | consentAndDemographics | killed | elsewhere | live (mechanical) |
| `study.spec:37` | answerAll | killed | n/a | live (mechanical) |
| `study.spec:55` | runCondition | killed | elsewhere | live (mechanical) |
| `study.spec:57` | runCondition | killed | killed | live (mechanical) |
| `study.spec:58` | runCondition | killed | elsewhere | live (mechanical) |
| `study.spec:60` | runCondition | killed | elsewhere | live (mechanical) |
| `study.spec:65` | runCondition | killed | elsewhere | live (mechanical) |
| `study.spec:71` | runCondition | killed | killed | live (mechanical) |
| `study.spec:75` | runCondition | killed | killed | live (mechanical) |
| `study.spec:91` | runCondition | killed | killed | live (mechanical) |
| `study.spec:106` | runs the full protocol for all three conditions, a withdrawa | killed | killed | live (mechanical) |
| `study.spec:108` | runs the full protocol for all three conditions, a withdrawa | killed | killed | live (mechanical) |
| `study.spec:117` | runs the full protocol for all three conditions, a withdrawa | killed | killed | live (mechanical) |
| `study.spec:145` | runs the full protocol for all three conditions, a withdrawa | survived | elsewhere | live (targeted) |
| `study.spec:154` | runs the full protocol for all three conditions, a withdrawa | survived | elsewhere | live (targeted) |
| `study.spec:165` | runs the full protocol for all three conditions, a withdrawa | survived | elsewhere | live (targeted) |
| `study.spec:166` | runs the full protocol for all three conditions, a withdrawa | survived | elsewhere | live (targeted) |
| `study.spec:167` | runs the full protocol for all three conditions, a withdrawa | survived | elsewhere | live (targeted) |
| `study.spec:168` | runs the full protocol for all three conditions, a withdrawa | survived | elsewhere | live (targeted) |
| `views.spec:12` | training view follows the cursor and its charts move the cur | killed | n/a | live (mechanical) |
| `views.spec:16` | training view follows the cursor and its charts move the cur | killed | killed | live (mechanical) |
| `views.spec:17` | training view follows the cursor and its charts move the cur | killed | elsewhere | live (mechanical) |
| `views.spec:22` | training view follows the cursor and its charts move the cur | killed | elsewhere | live (mechanical) |
| `views.spec:23` | training view follows the cursor and its charts move the cur | killed | killed | live (mechanical) |
| `views.spec:32` | inspector shows a weight’s numbers and the structure view hi | killed | killed | live (mechanical) |
| `views.spec:33` | inspector shows a weight’s numbers and the structure view hi | killed | elsewhere | live (mechanical) |
| `views.spec:34` | inspector shows a weight’s numbers and the structure view hi | killed | elsewhere | live (mechanical) |
| `views.spec:40` | what-changed lists the step’s effects | killed | killed | live (mechanical) |
| `views.spec:41` | what-changed lists the step’s effects | killed | elsewhere | live (mechanical) |
| `views.spec:48` | editing the architecture regenerates the run and resets the  | killed | killed | live (mechanical) |
| `views.spec:49` | editing the architecture regenerates the run and resets the  | killed | elsewhere | live (mechanical) |
| `views.spec:50` | editing the architecture regenerates the run and resets the  | elsewhere | elsewhere | live (targeted) |
| `views.spec:52` | editing the architecture regenerates the run and resets the  | killed | killed | live (mechanical) |
| `controls.spec:477` | walkthrough: every "Show me" action changes the position, th | n/a | n/a | live (targeted) |

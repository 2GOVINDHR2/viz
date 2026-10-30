# Parameter Audit (Fix Round 3, Part A)

**What it checks.** For every experiment, every parameter its objective needs the learner to change, using the brief's table A4 plus a seed wherever the experiment initialises randomly. For each one it gives:
- its status before this round;
- its input modality before and after;
- what was added.

**The rule** (A2). A parameter belongs here if changing it is needed to reach the experiment's stated objective. Parameters were added behind each experiment's own progressive disclosure:
- **On the workbench:** a *More settings* section of *Try it*, closed in novice mode and open in expert mode.
- **On a purpose-built novice screen:** a *Going deeper* section, so the screen still opens with one question and one control (ADR-055).

**The test data.** The A4 table in `tests/unit/parameters.test.ts` is this document's table as data: invariant F fails if a parameter listed there is not declared, or does not render as a typed field.

## Modalities

| Code | Meaning |
|---|---|
| **typed** | A text field: an exact value, applied on Enter or on leaving the field; out-of-range entries are refused with a message naming the valid range, never clamped (ADR-055, ADR-060) |
| **typed + drag** | Both, bound to the same state: dragging shows the value in the field, typing moves the slider |
| **choice** | A select, for a named choice (an activation, a loss); a choice cannot be typed wrongly |
| **preset** | Before this round only: a select or buttons offering a few fixed values, so any other value was unreachable |
| **drag** | Before this round only: a slider with a fixed range and step, so values off its grid or outside its range were unreachable |
| **absent** | Not editable |

## Results

| Exp. | Parameter (A4) | Before | Modality before → after | What was added |
|---|---|---|---|---|
| 1 Single neuron | weight w₁ | present | drag (−3…3, step 0.25) → typed + drag | Typed field bound to the slider; any value accepted |
| 1 | weight w₂ | present | drag → typed + drag | as above |
| 1 | bias b | present | drag → typed + drag | as above |
| 1 | inputs x₁, x₂ of each of the 4 examples (8 parameters) | **absent** | absent → typed | 8 fields in *Going deeper → Change the examples* (novice) and *More settings* (workbench), editing the dataset as explicit points |
| 1 | seed | **absent** | absent → typed | Field; 0 to 2³²−1 |
| 2 Activations | input value | **absent** | absent → typed | Field; any value, e.g. 8 |
| 2 | activation | present | preset select → choice | (unchanged: a named choice) |
| 2 | starting weight w (not in A4; kept) | present | drag (0.25…8) → typed + drag | Typed field bound to the slider |
| 3 Forward propagation | every weight and bias | present | typed, but an invalid entry was silently reverted → typed with a message | The starting-value editor now refuses with a message (ADR-060) |
| 3 | input vector (2 features of the first example) | **absent** | absent → typed | 2 fields in *More settings* |
| 3 | seed | **absent** | absent → typed | Field |
| 3 | hidden width (not in A4; kept) | present | preset select → typed | Typed field; presets as suggestions |
| 4 Loss | prediction ŷ | **absent** | absent → typed + drag | A loss calculator (panel probe) showing both losses for typed ŷ and y |
| 4 | target y | **absent** | absent → typed + drag | as above |
| 4 | loss | present | preset select → choice | (unchanged) |
| 4 | seed | **absent** | absent → typed | Field |
| 5 Gradient descent | learning rate | present | preset buttons (4 values) → preset buttons + typed | *…or type any learning rate*, through the same predict-then-reveal path; divergent values allowed |
| 5 | starting parameter value (w and b) | **absent** | absent → typed + drag | 2 fields in *Going deeper → Change the starting point and the passes* |
| 5 | batch size | present | preset buttons (3 values) → preset buttons + typed | *…or type any batch size*, through the prediction path; 1 to 50 |
| 5 | number of steps (passes) | **absent** | absent → typed | Field; limit from the instruction budget (ADR-057) |
| 6 Backpropagation | every weight | partial: workbench only | typed, silently reverted, workbench only → typed with a message, novice and workbench | The starting-value editor in the novice screen's *Going deeper → settings* section |
| 6 | input (2 features) | **absent** | absent → typed | 2 fields |
| 6 | target | **absent** | absent → typed | Field; 0 to 1 (cross-entropy) |
| 6 | learning rate | **absent** | absent → typed | Field |
| 6 | seed | **absent** | absent → typed | Field |
| 6 | activation (not in A4; kept) | present | choice | (unchanged) |
| 7 XOR | width | present | preset select; structure editor typed but **silently clamped** to 1–32 → typed | Typed field; the structure editor's clamp replaced by a message (defect found, ADR-060) |
| 7 | activation | partial: structure editor only | choice in the structure editor → choice in *Try it* too | Field in *More settings* |
| 7 | learning rate | present | preset select → typed | Typed field; the structure editor's preset select is typed too |
| 7 | epochs | partial: structure editor only | preset select → typed | Field in *More settings*; the structure editor's preset select is typed too |
| 7 | seed | **absent** | absent → typed | Field |
| 8 CNN | number of kernels | **absent** | absent → typed | Field; 1–16 |
| 8 | kernel size | **absent** | absent → typed | Field; 1–9, refused if a later layer would have no size |
| 8 | stride | **absent** | absent → typed | Field; 1–4, same check |
| 8 | padding | **absent** | absent → typed | Field; 0–8 |
| 8 | learning rate | present | preset select → typed | Typed field |
| 8 | batch size | **absent** | absent → typed | Field; 1 to 1,500 (the training-set size) |
| 8 | epochs | **absent** | absent → typed | Field; instruction budget |
| 8 | seed | **absent** | absent → typed | Field |
| 8 | activation (not in A4; kept) | present | choice | (unchanged) |
| D1 Vanishing gradients | depth | partial: structure editor only (add / remove a layer) | buttons → typed | Field; 1–12 hidden layers, each a copy of the first, keeping the initialisation scale |
| D1 | activation | present | choice | (unchanged) |
| D1 | initialisation scale | **absent** | absent → typed | Field; a factor on the seeded starting weights (1 = the usual size) |
| D1 | seed | **absent** | absent → typed | Field |
| D2 Learning-rate pathology | compared learning rate 1 | **absent** (fixed at 0.02) | absent → typed | Each comparison run's rate is its own field; divergent rates are trained and labelled *divergent* |
| D2 | compared learning rate 2 | **absent** (fixed at 0.3) | absent → typed | as above |
| D2 | compared learning rate 3 | **absent** (fixed at 0.95) | absent → typed | as above |
| D2 | compared learning rate 4 | **absent** (fixed at 1.1) | absent → typed | as above |
| D2 | main run's learning rate (not in A4; kept) | present | preset select → typed | Typed field |

## Totals

Counted per parameter: the *inputs* row of experiment 1 is 8 parameters, and *every weight and bias* counts as 1.

| | Count |
|---|---|
| A4 parameters audited, including seeds | **54** |
| …absent before this round | **38** |
| …partial before (drag or preset only, structure editor only, or workbench only) | **13** |
| …adequate before (named choices) | **3** |
| Parameters added to experiment definitions (new `editable` entries; 16 before, 57 after) | **41** |
| Already-editable parameters outside A4 converted to typed entry | 5: experiment 2's starting weight, experiment 3's width, D2's main learning rate, and the structure editor's learning-rate and epoch fields |
| Silent-clamp or silent-revert defects found and fixed | **2**: the structure editor's width (clamped to 1–32), and the starting-value editor (reverted a non-numeric entry without saying why) |

**Why 41 added, not 38.** All 38 absent parameters became entries. Three partial ones also became entries in *Try it*:
- XOR's activation and epochs (before: structure editor only);
- D1's depth (before: add and remove buttons).

**Partial parameters that were completed in place.** The learning rate and batch size of experiment 5 and every weight of experiments 3 and 6 did not need a new entry: their existing control gained a typed field, a message, or a place on the novice screen.

## Seeds (A4, final row)

**Where a seed field was added.** Experiments 1, 3, 4, 6, 7, 8 and D1. This was decided by measurement, not assumption: a run with seed s and a run with seed s + 1 were compared with the header's seed fields removed.

**Where it was not added, and why** (ADR-058). Experiments 2, 5 and D2 have no seed field:
- every parameter is given and nothing is shuffled, so the seed cannot change the computation;
- `tests/unit/parameters.test.ts` checks that two seeds give byte-identical instruction streams for each of the three.

A seed field there would be a control that does nothing, which the declared-surface rule (invariant A) forbids in spirit.

## How the requirements of A5 are checked

| A5 requirement | Check |
|---|---|
| Declared and rendered in novice and expert modes | Invariant F, `tests/unit/parameters.test.ts`: every A4 parameter, both modes, purpose-built screens with their sections open |
| Typed entry | F: the field is `<input type="text">`, or a select for a named choice |
| Changes the trace | `tests/e2e/controls.spec.ts`, *every declared parameter, typed exactly, changes the computation and the trace*: every regenerating parameter of every experiment except the CNN (whose fields are covered by G), typed in the browser |
| Survives an architecture change | Invariant B (existing) for the starting-value editor; G applies depth and width edits and reads the trace back |
| Invalid entry: message, no clamp, no crash, no inconsistent state | Invariant H: every parameter, several invalid entries each; the setting is unchanged afterwards. In the browser: the curriculum, D2 and loss tests |
| Divergent value accepted and reaches the pathology path | H: a learning rate of 50 and an initialisation scale of 1,000 reach a pathology breakpoint; extreme inputs and weights (10⁶) are accepted and run. In the browser, a compared rate of 50 is labelled *divergent* |
| Reset restores the default | G ends with invariant D, extended to the dataset, the panel values and the open sections |
| Taught vocabulary | The labels are the experiment's own words (*weight w₁*, *Batch size B*, *Learning rate η*); the vocabulary test renders every novice screen with its settings, and its rules apply to them |
| Fuzz | Invariant E now draws typed entries (valid, divergent, extreme and invalid) and checks G and H after each one |

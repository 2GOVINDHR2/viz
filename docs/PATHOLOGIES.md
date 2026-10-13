# Pathology Catalogue

The training failures DL-VizLab detects and turns into teachable events. Every detector is a breakpoint over the trace (`src/core/npm/breakpoints.ts`); its threshold lives in one place (`src/core/npm/pathologies.ts`), which the controls, the tests and this document share. When a detector fires, the run stops on the instruction that triggered it, the cursor moves there, and all three views and the explanation show the state at that instruction. The controls show the one-sentence reason quoted below. A pathology never crashes the engine: non-finite values are ordinary values in the trace.

Every row is verified in `tests/unit/pathologies.test.ts` by producing the failure in a real training run and checking that a healthy run of the same model does **not** trigger it.

| Pathology | Detection (evaluated on) | Threshold | What the learner is shown | Produced in the test by | Healthy control |
|---|---|---|---|---|---|
| **NaN / ±∞** | Any result of any instruction contains a non-finite number (every instruction) | — | “*KIND* produced a non-finite value (NaN or ±∞) in “*slot*” — training has numerically broken down” | Line fit (D2's model) with η = 8 for 150 epochs: the loss grows ~25× per epoch until it overflows | η = 0.3 |
| **Exploding gradients** | Largest element magnitude of a parameter's batch-mean gradient, max\|gᵢ\| (`GRAD_ACCUMULATE`) | max\|gᵢ\| > 10 | “the gradient of *P* reached *v* (above 10) — it may be exploding” | D2 at η = 1.1 | D2 at η = 0.3 |
| **Vanishing gradients** | Every element of a parameter's batch-mean gradient is small (`GRAD_ACCUMULATE`) | max\|gᵢ\| < 10⁻⁴ | “every element of the gradient of *P* is below 0.0001 (largest *v*) — this layer has almost stopped learning” | D1: eight sigmoid hidden layers; fires in an early layer | D1 with ReLU |
| **Dead ReLUs** | For each ReLU layer, which units received a non-zero bias gradient in at least one batch of the epoch (`GRAD_ACCUMULATE` of `L.b`, reported at `EPOCH_END`) | a unit whose bias gradient was exactly 0 in every batch of a whole epoch | “unit *k* of layer *L* received no gradient during the whole epoch: its ReLU was inactive (z ≤ 0) for every training example — a “dead” ReLU, whose incoming weights can no longer change” | 2-3-1 ReLU network whose first hidden unit starts with bias −50 | same network, bias 0.1 |
| **Learning-rate divergence** | Epoch mean loss compared with the previous epoch's (`EPOCH_END`) | rises by more than 10 % | “the mean loss rose from *a* to *b* over one epoch — the steps overshoot; the learning rate is probably too large” | D2 at η = 1.1 | D2 at η = 0.3 and η = 0.95 (oscillating but not diverging) |

## Notes on the detectors

- **Why the bias gradient for dead ReLUs.** For a ReLU unit, ∂ℓ/∂b equals ∂ℓ/∂z, which is exactly zero whenever z ≤ 0. A batch-mean bias gradient of exactly 0 therefore means the unit was inactive for every example of the batch (or that the error reaching it was exactly zero, which does not happen in practice with float64). Requiring this for every batch of an epoch makes the claim "inactive for every training example". With a batch size of 1, a single inactive example would otherwise be a false alarm.
- **Whole epochs only.** The dead-ReLU detector needs to see an epoch from its start, so a search that begins mid-epoch reports nothing for that epoch (tested).
- **Magnitude = max\|gᵢ\|.** The largest element is used, not the norm, so a threshold means the same thing for layers of different sizes.
- **Divergence vs oscillation.** A rate that is too large but convergent (D2, η = 0.95) zig-zags while its epoch loss still falls, so it is not flagged; the learning-rate comparison panel labels it "too large" from weight-sign flips instead (ADR-022).
- **Other stops.** "Loss plateau" (epoch loss improves by less than 10⁻⁴) and "back-propagation starts" are breakpoints for exploration, not pathologies.

## Where learners meet them

| Experiment | Pathologies switched on by default |
|---|---|
| D1 Vanishing gradients | vanishing |
| D2 Learning-rate pathology | NaN/∞, exploding, divergence |
| All experiments | NaN/∞ (always on unless the learner switches it off) |

Dead ReLUs can be explored by switching D1 to ReLU and setting a large learning rate, or with any ReLU network; the detector is available in every experiment's breakpoint list.

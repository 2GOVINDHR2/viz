# Limitations

Honest limitations, written for the paper's limitations section.

- **Scale.** The engine is a CPU, float64, single-threaded-per-worker TypeScript implementation intended for networks with at most tens of thousands of parameters. It is a teaching instrument, not a training framework.
- **Provenance of the prototype.** The pre-existing prototype described in project documents was never committed; no claims about it can be verified (see `docs/AUDIT.md`).
- **Instrument.** The concept inventory is researcher-developed and, at the time of writing, unvalidated beyond internal consistency; results by concept rest on one to three items each.
- **Test selection.** Shapiro–Wilk is highly sensitive at larger samples, so the pre-specified rule may select the non-parametric primary test for trivial departures from normality; both analyses are always reported.
- **Comparison condition.** TensorFlow Playground cannot show convolutional networks or discrete steps, so the C2 condition cannot cover the CNN content with the same medium.

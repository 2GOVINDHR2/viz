# Limitations

Honest limitations, written for the paper's limitations section.

- **Scale.** The engine is a CPU, float64, single-threaded-per-worker TypeScript implementation intended for networks with at most tens of thousands of parameters. It is a teaching instrument, not a training framework.
- **Provenance of the prototype.** The pre-existing prototype described in project documents was never committed; no claims about it can be verified (see `docs/AUDIT.md`).
- **Instrument.** The concept inventory is researcher-developed and, at the time of writing, unvalidated beyond internal consistency; gains are therefore reported by four concept clusters — fundamentals (7 items), optimisation (5), backpropagation (5) and convolutional (3) — and by Bloom level (recall 4, understand 9, apply 7), with per-concept results only as an exploratory appendix, because most single concepts rest on one to three items. Two items whose content no condition teaches (overfitting, symmetric initialisation) were retired before data collection (ADR-032).
- **Test selection.** Shapiro–Wilk is highly sensitive at larger samples, so the pre-specified rule may select the non-parametric primary test for trivial departures from normality; both analyses are always reported.
- **Comparison condition.** TensorFlow Playground cannot show convolutional networks or discrete steps, so the C2 condition cannot cover the CNN content with the same medium.
- **Accessibility.** The tool is designed to WCAG 2.1 AA. It has been checked with an automated audit (axe-core, 19 screens, zero violations) and a manual criterion-by-criterion review, but not with screen-reader users or other assistive-technology users. Automated tools detect only a subset of WCAG failures, so AA conformance is not claimed; learners who rely on assistive technology may meet barriers the audit did not find.

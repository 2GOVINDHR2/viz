# Limitations

Honest limitations, written for the paper's limitations section.

- **Scale.** The engine is a CPU, float64, single-threaded-per-worker TypeScript implementation intended for networks with at most tens of thousands of parameters. It is a teaching instrument, not a training framework.
- **Provenance of the prototype.** The pre-existing prototype described in project documents was never committed; no claims about it can be verified (see `docs/AUDIT.md`).

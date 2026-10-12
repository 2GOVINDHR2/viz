# DL-VizLab

A browser-based, client-only learning environment that makes neural-network **training** observable step by step. Every operation of a training run (forward pass, loss, each gradient of back-propagation, each parameter update) is recorded as an instruction of the **Neural Program Model (NPM)**, a formally specified, serializable, replayable intermediate representation. Learners step through it at six granularities (operation, layer, phase, example, batch, epoch), forwards and backwards. Each instruction is explained with its general formula, the same formula with that step's numbers, and a plain-language sentence.

Status: v0.1, phases P0–P4 of `docs/PROGRESS.md` complete.

## Run

```sh
npm ci
npm run dev          # app at http://localhost:5173
npm test             # unit, gradcheck, TF.js parity, determinism
npm run test:e2e     # browser tests (Playwright)
npm run build
python3 -m unittest analysis/test_analysis.py && python3 analysis/validate.py   # study analysis pipeline
```

## Evidence

- `docs/VALIDATION-REPORT.md`: gradient checks, TF.js parity, determinism and performance, generated from the test suites.
- `docs/TRACE-STATISTICS.md`: how runs decompose into instructions, and how that scales.
- `docs/NPM-SPEC.md`: the IR specification, including the LayerNorm extension tutorial.
- `figures/`: vector figures with CSV data beside each.
- `tools/npm-verify.mjs`, `tools/npm-replay.mjs`: independent consumers of trace files (`samples/`).

## Study materials

`docs/STUDY-PROTOCOL.md`, `docs/DATA-DICTIONARY.md`, `src/study/config/` (concept inventory, consent text), `analysis/`, `docs/RESULTS-SKELETON.md` (simulated data only).

## Licence

To be decided before release (P9).

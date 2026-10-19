# Third-Party Components Shipped with DL-VizLab

Runtime libraries installed from npm are listed in `package.json` with their own licences (React, Zustand, d3-array, d3-scale, KaTeX). This file records third-party material that is **copied into the repository** and served with the app.

| Component | Where | Version / source | Licence | Notes |
|---|---|---|---|---|
| TensorFlow Playground | `public/playground/` | github.com/tensorflow/playground, commit `02469bd3751764b20486015d4202b792af5362a6` (6 June 2022), built with the upstream toolchain | Apache License 2.0 (`public/playground/LICENSE`) | Study condition C2. Two modifications for offline, privacy-preserving use (Google Analytics stubbed; fonts served locally), listed in `public/playground/NOTICE.md`. Reproduce with `scripts/vendor-playground.sh`. |
| Roboto font (latin 300/400/500) | `public/playground/fonts/` | `@fontsource/roboto@5.1.0` | Apache License 2.0 (`fonts/LICENSE-roboto`) | Used by the vendored Playground only |
| Material Icons font | `public/playground/fonts/` | `@fontsource/material-icons@5.1.0` | Apache License 2.0 (`fonts/LICENSE-material-icons`) | Used by the vendored Playground only |
| Reduced MNIST | `src/experiments/data/mnist-subset.ts` | MNIST (LeCun, Cortes & Burges), 1 800 images | CC BY-SA 3.0 | See `docs/DATASETS.md` |

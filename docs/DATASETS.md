# Datasets

Every dataset ships with the application; nothing is downloaded at run time.

## Synthetic datasets (`src/core/engine/datasets.ts`)

Generated from the seeded PRNG, so they are identical on every machine: XOR (the four canonical points), noisy XOR clusters, two Gaussian clusters, concentric circles, a k-arm spiral, a noisy line (regression), and "bars" (small images of horizontal, vertical and diagonal bars, used for CNN tests).

## Reduced MNIST (`src/experiments/data/mnist-subset.ts`)

| Property | Value |
|---|---|
| Source | The MNIST database of handwritten digits, Y. LeCun, C. Cortes and C. J. C. Burges, files as mirrored at `https://storage.googleapis.com/cvdf-datasets/mnist/` |
| Licence | Creative Commons Attribution-Share Alike 3.0 (as published with MNIST); the subset is redistributed under the same licence |
| Classes | digits 0, 1, 2 |
| Size | 500 training and 100 test images per class (1 500 / 300), from the official training and test splits respectively |
| Selection | without replacement, `numpy.random.default_rng(2026)`; classes interleaved so any prefix is balanced |
| Format | 28 × 28 uint8 pixels (0 = background) and uint8 labels, base64-encoded in a TypeScript module (1.9 MB), scaled to [0, 1] when loaded |
| Loading | code-split: the browser downloads the module only when the CNN experiment is opened, from the same origin as the app |
| Integrity | the generator refuses source files whose SHA-256 differs from: train images `440fcabf…3609`, train labels `35525…255c`, test images `8d422c7b…aec6`, test labels `f7ae60f9…aec6` (full hashes in the script) |
| Regenerate | `python3 scripts/gen-mnist-subset.py <dir with the four MNIST .gz files>` |

# Future Work

Things worth building that are out of scope for this project (see B3 non-goals).

- Recurrent and attention-based architectures (explicit non-goal).
- GPU execution via WebGPU for larger CNNs.
- An R port of `analysis/analysis.py` for reviewers who prefer R.
- A delayed retention test (e.g. two weeks) in addition to the immediate post-test.
- Editing convolutional architectures in the Structure View (P5 edits cover dense hidden layers only; ADR-019).
- **Study exports from several machines:** a small merge helper (`analysis/merge.py`) that concatenates exports and checks for duplicate participant codes.
- **Lower peak memory for CNNs:** reuse per-example buffers in the convolution kernels (im2col, gradient scratch) so the allocator's high-water mark stays near the live size.

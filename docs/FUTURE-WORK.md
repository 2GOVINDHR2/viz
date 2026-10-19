# Future Work

Things worth building that are out of scope for this project (see B3 non-goals).

- Recurrent and attention-based architectures (explicit non-goal).
- GPU execution via WebGPU for larger CNNs.
- An R port of `analysis/analysis.py` for reviewers who prefer R.
- A delayed retention test (e.g. two weeks) in addition to the immediate post-test.
- Editing convolutional architectures in the Structure View (P5 edits cover dense hidden layers only; ADR-019).
- **Lower peak memory for CNNs:** the remaining allocator high-water mark comes from the per-example tensors the trace records (ADR-035). Options are float32 storage for cached trace tensors, or streaming generation with a smaller cache; both must preserve the float64 evidence.

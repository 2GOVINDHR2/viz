# DL-VizLab

DL-VizLab is an interactive prototype for inspecting introductory neural-network computation. It pairs a small handwritten TypeScript engine with an operation trace, numeric inspector, execution explanations, and SVG network/chart views.

The project is intended to support exploration: select an experiment, inspect its data and parameters, step through operations, compare intermediate values, and reset or run the model. It does not currently establish that the interface improves learning, and it is not a general-purpose model-training platform.

## Experiments

The current prototype contains ten experiments: Single Neuron, Activation Functions, Perceptron, Forward Propagation, Loss Functions, Gradient Descent, Backpropagation, Weight Update, XOR Problem, and MLP Training. Each includes a learning objective, terms, reflection prompt, and related concept in the experiment sidebar.

MLP Training supports small feature-vector datasets (XOR, two clusters, and two moons). Its optional learning-rate comparison runs two isolated branches from the same initialization and data order. The custom engine currently supports small dense feed-forward models; convolutional and sequence-oriented models are discussed as data/model examples, not implemented.

## Development

Requirements: Node.js compatible with the installed Vite/Vitest versions.

```sh
npm install
npm run dev
```

Available checks:

```sh
npm test
npm run build
npm run lint
```

The current execution environment is WSL 1 with Windows Node routing, which has prevented those commands from starting here. See [the final implementation report](docs/FINAL_IMPLEMENTATION_REPORT.md) for verification status and [the manual verification register](docs/MANUAL_VERIFICATION.md) for pending browser and human review.

## Project documentation

- [Project status and repository inventory](docs/PROJECT_STATUS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design decisions](docs/DESIGN_DECISIONS.md)
- [Limitations](docs/LIMITATIONS.md)
- [Phase 1A stabilization details](docs/phase-1a-stabilization.md)
- [Manual verification register](docs/MANUAL_VERIFICATION.md)
- [Final implementation report](docs/FINAL_IMPLEMENTATION_REPORT.md)

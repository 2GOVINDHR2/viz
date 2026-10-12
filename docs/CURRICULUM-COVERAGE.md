# Curriculum Coverage

The ten planned experiments (P6, P7) mapped against learning outcomes of an introductory deep-learning course. Outcomes are phrased for this document and grouped by the corresponding chapters of Goodfellow, Bengio & Courville (2016), *Deep Learning* — Ch. 6 *Deep feedforward networks*, Ch. 7 *Regularization*, Ch. 8 *Optimization*, Ch. 9 *Convolutional networks* — which most introductory courses follow for this material. Status reflects this repository at the end of P4.

## Experiments

| # | Experiment | Status |
|---|---|---|
| E1 | Single neuron | **Runnable** (AND gate, sigmoid, BCE) |
| E2 | Activation functions | Planned P6 |
| E3 | Forward propagation | Planned P6 (the XOR experiment already supports forward stepping) |
| E4 | Loss | Planned P6 |
| E5 | Gradient descent (loss surface + trajectory, learning-rate divergence) | Planned P6 |
| E6 | Backpropagation (chain rule layer by layer) | Planned P6 (backward stepping already available in E1 and E7) |
| E7 | XOR with an MLP | **Runnable** (2-4-1 tanh/sigmoid, defaults chosen by recorded sweep) |
| E8 | CNN on reduced MNIST | Planned P7 (engine and IR support conv/pool/flatten today) |
| D1 | Vanishing gradients (diagnostic) | Planned P6 (engine, breakpoint and figure exist: `figures/vanishing-gradients.pdf`) |
| D2 | Learning-rate pathology (diagnostic) | Planned P6 |

## Outcome coverage

✓ = the experiment directly targets the outcome; · = touches it; blank = not covered.

| Outcome (after the course, a learner can…) | Book ch. | E1 | E2 | E3 | E4 | E5 | E6 | E7 | E8 | D1 | D2 | Covered |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| O1 compute a neuron's output from inputs, weights and bias | 6 | ✓ | · | · | | | | · | | | | ✓ |
| O2 describe common activation functions and their derivatives, including saturation | 6 | · | ✓ | | | | · | | | ✓ | | ✓ |
| O3 carry out a forward pass through a multi-layer network | 6 | | | ✓ | | | | ✓ | · | | | ✓ |
| O4 choose and interpret a loss function for regression and classification | 6 | · | | | ✓ | | | · | · | | | ✓ |
| O5 explain why softmax is paired with cross-entropy | 6 | | | | ✓ | | · | | ✓ | | | ✓ |
| O6 explain gradient descent and the role of the learning rate | 8 | · | | | | ✓ | | · | | | ✓ | ✓ |
| O7 apply the chain rule to back-propagate gradients through layers | 6 | · | | | | | ✓ | ✓ | · | ✓ | | ✓ |
| O8 explain mini-batch gradient averaging and momentum | 8 | | | | | ✓ | | | · | | · | ✓ |
| O9 explain why hidden layers and non-linearity are needed (XOR) | 6 | · | ✓ | | | | | ✓ | | | | ✓ |
| O10 explain convolution, weight sharing and pooling | 9 | | | | | | | | ✓ | | | ✓ |
| O11 diagnose vanishing/exploding gradients and learning-rate pathologies | 8 | | · | | | · | · | | | ✓ | ✓ | ✓ |
| O12 explain parameter initialisation and symmetry breaking | 8 | · | | | | | | · | | · | | · (inventory item TR05; no dedicated experiment) |
| O13 explain overfitting and generalisation | 5, 7 | | | | | | | | | | | **not covered** |
| O14 apply regularisation (weight decay, dropout, early stopping) | 7 | | | | | | | | | | | **not covered** |
| O15 compare adaptive optimisers (RMSProp, Adam) | 8 | | | | | | | | | | | **not covered** |

**Coverage: 11 of 15 outcomes directly targeted, 1 touched, 3 not covered.** Of the 11, 3 (O1, O3/O7 via XOR, O9) are covered by experiments runnable today; the rest depend on P6–P7.

## Gaps and decisions

- Overfitting (O13) is examined by the concept inventory (item CI18) but no experiment shows it, because every dataset is evaluated on its training set. A held-out split for the 2-D datasets is a small extension (FUTURE-WORK).
- Regularisation (O14) and adaptive optimisers (O15) are out of scope for this project; listed in FUTURE-WORK. The NPM extension model is the intended route (each is a new instruction kind plus explainer).

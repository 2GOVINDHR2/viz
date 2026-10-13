# Curriculum Coverage

The ten planned experiments (P6, P7) mapped against learning outcomes of an introductory deep-learning course. Outcomes are phrased for this document and grouped by the corresponding chapters of Goodfellow, Bengio & Courville (2016), *Deep Learning* — Ch. 6 *Deep feedforward networks*, Ch. 7 *Regularization*, Ch. 8 *Optimization*, Ch. 9 *Convolutional networks* — which most introductory courses follow for this material. Status reflects this repository at the end of P7.

## Experiments

| # | Experiment | Status |
|---|---|---|
| E1 | Single neuron | **Runnable** (AND gate; learner-chosen starting weights) |
| E2 | Activation functions | **Runnable** (activation panel; saturation) |
| E3 | Forward propagation | **Runnable** (2-3-1, layer stepping) |
| E4 | Loss | **Runnable** (MSE vs cross-entropy panel) |
| E5 | Gradient descent (loss surface + trajectory, learning-rate divergence) | **Runnable** (loss-surface panel) |
| E6 | Backpropagation (chain rule layer by layer) | **Runnable** |
| E7 | XOR with an MLP | **Runnable** (2-4-1 tanh/sigmoid, defaults chosen by recorded sweep) |
| E8 | CNN on reduced MNIST | **Runnable** (conv–pool–dense, 97 % held-out accuracy; convolution view) |
| D1 | Vanishing gradients (diagnostic) | **Runnable** (8-layer sigmoid stack; ReLU switch) |
| D2 | Learning-rate pathology (diagnostic) | **Runnable** (four rates side by side) |

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

**Coverage: 11 of 15 outcomes directly targeted, 1 touched, 3 not covered.** All 11 are covered by experiments runnable today.

## Gaps and decisions

- Overfitting (O13) is examined by the concept inventory (item CI18) but no experiment shows it, because only the MNIST experiment has a held-out split and its gap is small (99.2 % vs 97.0 %). A held-out split for the 2-D datasets is a small extension (FUTURE-WORK).
- Regularisation (O14) and adaptive optimisers (O15) are out of scope for this project; listed in FUTURE-WORK. The NPM extension model is the intended route (each is a new instruction kind plus explainer).

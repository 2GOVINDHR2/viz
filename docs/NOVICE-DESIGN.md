# Novice Path — Design

This is the design of DL-VizLab's novice path (the "Guided path"), written so that someone who has not seen the implementation can judge the screens against it. It is the only document the cold reviewer receives (Fix Round 2b), together with screenshots of every screen.

## The learner

An undergraduate meeting neural networks for the first time:
- comfortable with programming and school algebra;
- no machine-learning coursework;
- no familiarity with the vocabulary (weight, bias, activation, loss, gradient, learning rate, back-propagation, epoch, batch, convolution).

Each experiment should be workable by this learner, in order, in about three minutes, without outside help.

## What the tool is

A browser lab of ten experiments, done in order. Each one trains a small neural network and lets the learner step through the training one piece at a time. Every number on screen comes from the actual run, not from an illustration.

The ten experiments, in order:

| # | Title | The question it answers |
|---|---|---|
| 1 | A single neuron | Can one neuron learn AND? |
| 2 | Activation functions | What other squashing functions are there, and why does the choice matter? |
| 3 | Forward propagation | How does an input travel through layers to become an output? |
| 4 | Loss functions | How do we measure how wrong an answer is? |
| 5 | Gradient descent | How does a model walk downhill on its loss, and how big should each step be? |
| 6 | Back-propagation | Which weights are to blame for an error, and by how much? |
| 7 | XOR needs a hidden layer | Can a network with a hidden layer learn something one neuron never can? |
| 8 | A CNN on handwritten digits | How does a network look at an image? |
| D1 | Vanishing gradients | Why do deep networks with some activations stop learning? |
| D2 | Learning-rate pathology | What happens when the step size is wrong? |

An experiment unlocks when the previous one's self-check has been answered.

## Two paths

- **Guided path (the default).** One screen per experiment, showing only what that experiment needs.
- **Expert mode.** A full workbench with every view and control. It is reachable from every screen but never required.

Experiments 1, 5 and 6 have purpose-built guided screens. The other seven currently show a reduced workbench: only the controls the experiment declares, with a note that the beginner screen is in progress.

## Principles

1. **Question first.** A screen opens with one question in plain words and one control. It is never a dashboard.
2. **One thing on screen.** One view to start. A second view appears only on request, with one line on why a second perspective helps.
3. **Detail revealed in place.** Each panel has its own *show the numbers*, *show the maths* or *add a view*, under "Going deeper". Nothing gates entry.
4. **Vocabulary follows the curriculum.** A term is used only once the experiment that introduces it has been reached, and it is explained when first used. Technical tool vocabulary (instruction, operation, trace, tensor, granularity) is kept to expert mode.
5. **Each experiment declares its controls.** Only those appear. Every screen has a **Reset experiment** control that returns it to how it opened.

## Step sizes

The learner moves through training with **Next** / **Back**. The size of one step is unlocked as the curriculum teaches it:

| Step size (as the learner sees it) | First offered in |
|---|---|
| one calculation | 1 |
| one layer | 3 |
| one example | 5 |
| one batch | 5 |
| forward / backward / update | 6 |
| one full pass | 7 |

When only one size is offered, there is a single *Next* button and no selector.

## The screen template

1. **The question**, at the top.
2. **The minimum control:** sliders for experiment 1, a learning-rate choice for 5, choosing which weight to follow for 6.
3. **The prediction.** At the moment that matters most, the learner commits with one click before seeing the result.
4. **The observation:** one view, plus one plain sentence per step saying what just happened.
5. **The reveal:** whether the prediction held, and why, using the run's own numbers.
6. **Going deeper:** the numbers, the maths, a second view, the full workbench.
7. **Check your understanding** (two or three multiple-choice questions), then a **next question** line naming what the following experiment asks.

## The purpose-built screens

### 1 — A single neuron
- **Question:** can one neuron learn AND (say "yes" only when both inputs are 1)?
- **Control:** sliders for the two weights and the bias.
- **View:** the neuron, and a table of its output for each of the four examples.
- **Prediction:** "if you make the bias larger, the four outputs will… all go up / all go down / stay the same."
- **Action:** "Let it learn" trains the neuron.

### 5 — Gradient descent
- **Question:** how does a model find the best straight line through 50 points, and how big should each step be?
- **Control:** a choice of learning rate.
- **View:** the loss as a landscape, with the path the model takes over it.
- **Prediction:** for each new learning rate, the final loss will be lower / the same / higher / blow up.
- **Second control (on request):** batch size, with a prediction of how many steps one pass makes.

### 6 — Back-propagation
- **Question:** the network gets an example a little wrong; which weights are to blame, and by how much? Follow the error backwards one step at a time.
- **Control:** click a line (a weight) in the network to follow it.
- **View:** the network, with the chain-rule factors for the followed weight appearing one by one as the backward pass computes them. Their product is checked against the gradient the engine computed.
- **Prediction:** "this example will push the weight you are following… up / down / hardly at all."

## Visual conventions

- **Network diagram:**
  - circles are neurons, and the number inside is the current value;
  - lines are weights: solid blue is positive, dashed orange is negative, and thickness is size;
  - during an update, dotted overlays show each weight's change.
- **The current phase** (forward, backward, update) is shown by a banner above the network diagram. This is from experiment 3 onward, and on experiment 6's screen; experiments 1 and 5 have no network diagram with phases.
- **Clicking** a neuron or a weight shows a details panel for that element only.

## Accessibility

- Keyboard reachable throughout.
- Colour is never the only carrier of meaning.
- Every new screen must have zero automated accessibility (axe) violations.

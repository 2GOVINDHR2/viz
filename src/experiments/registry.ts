/**
 * The curriculum (P6): seven core experiments in strict prerequisite order,
 * the CNN experiment (P7), and two diagnostic experiments. Every definition is
 * data; tests train each configuration and check that it shows what its
 * objective claims.
 */
import type { TrainConfig } from '../core/engine/session';
import type { Experiment } from './types';

export type { Experiment } from './types';

const dense = (units: number, activation: 'linear' | 'sigmoid' | 'tanh' | 'relu' | 'softmax') => ({
  type: 'dense' as const,
  units,
  activation,
});

const lineRegression = (lr: number, epochs = 40): TrainConfig => ({
  seed: 4,
  epochs,
  batchSize: 50,
  shuffle: false,
  loss: 'mse',
  optimizer: { type: 'sgd', lr },
  model: { inputShape: [1], layers: [dense(1, 'linear')] },
  initialParams: { 'L1.W': [-1.5], 'L1.b': [1.5] },
});

const stepXs = [-4, -3, -2, -1, -0.5, 0.5, 1, 2, 3, 4];

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'single-neuron',
    number: '1',
    track: 'core',
    title: 'A single neuron',
    objective:
      'Compute a neuron’s output from its inputs, weights and bias, and see how changing a weight or the bias changes that output.',
    prerequisite: null,
    intro:
      'Two inputs, one sigmoid neuron, the AND truth table. Set the starting weights and bias yourself, then step through one example and watch the weighted sum, the bias and the activation.',
    status: 'available',
    config: {
      seed: 7,
      epochs: 60,
      batchSize: 4,
      shuffle: true,
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 1 },
      boundaryGrid: 24,
      model: { inputShape: [2], layers: [dense(1, 'sigmoid')] },
      initialParams: { 'L1.W': [0.5, -0.5], 'L1.b': [0] },
    },
    dataset: {
      kind: 'points',
      name: 'and',
      xs: [
        [0, 0],
        [0, 1],
        [1, 0],
        [1, 1],
      ],
      ys: [[0], [0], [0], [1]],
    },
    defaultGranularity: 'operation',
    suggestedBreakpoints: ['gradInit'],
    editable: [
      {
        kind: 'initialValue',
        param: 'L1.W',
        index: 0,
        label: 'starting weight w₁',
        min: -3,
        max: 3,
        step: 0.25,
      },
      {
        kind: 'initialValue',
        param: 'L1.W',
        index: 1,
        label: 'starting weight w₂',
        min: -3,
        max: 3,
        step: 0.25,
      },
      {
        kind: 'initialValue',
        param: 'L1.b',
        index: 0,
        label: 'starting bias b',
        min: -3,
        max: 3,
        step: 0.25,
      },
    ],
    panels: [],
    walkthrough: [
      {
        text: 'This neuron computes z = w₁x₁ + w₂x₂ + b and then a = σ(z). Your starting weights are on the left. Step to the first example.',
        action: { type: 'runToKind', kind: 'LOAD_INPUT' },
        actionLabel: 'Load the first example',
      },
      {
        text: 'Step once: MATMUL forms the weighted sum u = w₁x₁ + w₂x₂. The explanation shows the sum with this example’s numbers.',
        action: { type: 'step', count: 1 },
        actionLabel: 'Step once',
      },
      {
        text: 'Two more steps add the bias and apply the sigmoid. Notice that the output is always between 0 and 1.',
        action: { type: 'step', count: 2 },
        actionLabel: 'Step twice',
      },
      {
        text: 'Now drag the starting weight w₁ on the left. The run restarts with your value; step back to this point and compare the output.',
      },
      {
        text: 'Finally, jump to the end. Training found weights that output ≈ 1 only for (1, 1): the AND function. The decision boundary in “Training so far” is a straight line.',
        action: { type: 'jump', to: 'end' },
        actionLabel: 'Jump to the end',
      },
    ],
    selfCheck: [
      {
        id: 'sn1',
        question: 'With x = (1, 1), w = (0.5, −0.5) and b = 0, what is z?',
        options: [
          { text: '0', correct: true, feedback: 'Right: 1·0.5 + 1·(−0.5) + 0 = 0, so a = σ(0) = 0.5.' },
          { text: '1', feedback: 'The second weight is negative: 0.5 − 0.5 = 0.' },
          { text: '0.5', feedback: 'That is σ(z), the output, not z itself.' },
        ],
      },
      {
        id: 'sn2',
        question:
          'If you increase the bias b while keeping the weights fixed, the neuron’s output for every input…',
        options: [
          {
            text: 'increases',
            correct: true,
            feedback: 'Yes: b adds to z for every input, and σ is increasing.',
          },
          { text: 'decreases', feedback: 'b is added to z, and a larger z gives a larger σ(z).' },
          {
            text: 'is unchanged unless an input is non-zero',
            feedback: 'The bias does not multiply an input; it shifts z even when all inputs are 0.',
          },
        ],
      },
    ],
  },
  {
    id: 'activations',
    number: '2',
    track: 'core',
    title: 'Activation functions',
    objective:
      'Compare sigmoid, tanh and ReLU on the same inputs, and see how a saturated unit passes back almost no gradient.',
    prerequisite: 'single-neuron',
    intro:
      'One input, one neuron, ten points of a step function. Pick the activation and the starting weight: a large weight pushes z into the flat, saturated part of sigmoid and tanh.',
    status: 'available',
    config: {
      seed: 2,
      epochs: 40,
      batchSize: 10,
      shuffle: false,
      loss: 'mse',
      optimizer: { type: 'sgd', lr: 0.1 },
      model: { inputShape: [1], layers: [dense(1, 'sigmoid')] },
      initialParams: { 'L1.W': [4], 'L1.b': [0] },
    },
    dataset: {
      kind: 'points',
      name: 'step',
      xs: stepXs.map((x) => [x]),
      ys: stepXs.map((x) => [x > 0 ? 1 : 0]),
    },
    defaultGranularity: 'operation',
    suggestedBreakpoints: [],
    editable: [
      { kind: 'activation', layer: 0, options: ['sigmoid', 'tanh', 'relu', 'linear'] },
      {
        kind: 'initialValue',
        param: 'L1.W',
        index: 0,
        label: 'starting weight w',
        min: 0.25,
        max: 8,
        step: 0.25,
      },
    ],
    panels: ['activation'],
    walkthrough: [
      {
        text: 'The panel “Activation function” plots f(z) and its slope f′(z). Run to the first activation to see where this example’s z lands.',
        action: { type: 'runToKind', kind: 'ACTIVATE' },
        actionLabel: 'Run to the activation',
      },
      {
        text: 'Now run to GRAD_ACTIVATE: the gradient is multiplied by f′(z). With w = 4 and x = −4, z = −16: the slope is almost 0.',
        action: { type: 'runToKind', kind: 'GRAD_ACTIVATE' },
        actionLabel: 'Run to the gradient',
      },
      {
        text: 'Switch the activation to ReLU and repeat. For z < 0, ReLU’s slope is exactly 0; for z > 0 it is exactly 1.',
      },
      {
        text: 'Lower the starting weight to 0.5. z stays near 0, where sigmoid and tanh are steepest, and the gradients are larger.',
      },
    ],
    selfCheck: [
      {
        id: 'ac1',
        question: 'The sigmoid’s slope σ′(z) is largest at…',
        options: [
          {
            text: 'z = 0, where it equals 0.25',
            correct: true,
            feedback: 'Yes: σ′(0) = σ(0)(1 − σ(0)) = 0.25, its maximum.',
          },
          {
            text: 'large positive z, where the output is largest',
            feedback: 'There the curve is flat (saturated): the slope tends to 0.',
          },
          { text: 'every z equally', feedback: 'Only a linear function has a constant slope.' },
        ],
      },
      {
        id: 'ac2',
        question:
          'A ReLU unit has z = −2 for an example. During back-propagation its incoming weights receive…',
        options: [
          {
            text: 'zero gradient from this example',
            correct: true,
            feedback: 'Right: ReLU′(z) = 0 for z < 0, which blocks the gradient.',
          },
          {
            text: 'a negative gradient, because z is negative',
            feedback: 'The sign of z does not set the gradient sign; ReLU′(−2) = 0 blocks it entirely.',
          },
          { text: 'the same gradient as an active unit', feedback: 'An inactive ReLU passes back nothing.' },
        ],
      },
    ],
  },
  {
    id: 'forward-propagation',
    number: '3',
    track: 'core',
    title: 'Forward propagation',
    objective: 'Carry out a forward pass through a two-layer network, layer by layer.',
    prerequisite: 'activations',
    intro:
      'A 2-3-1 network on two Gaussian clusters. Step layer by layer: each layer turns the previous layer’s outputs into its own.',
    status: 'available',
    config: {
      seed: 5,
      epochs: 20,
      batchSize: 8,
      shuffle: true,
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 0.5 },
      boundaryGrid: 24,
      model: { inputShape: [2], layers: [dense(3, 'tanh'), dense(1, 'sigmoid')] },
    },
    dataset: { kind: 'gaussians', n: 40, seed: 3 },
    defaultGranularity: 'layer',
    suggestedBreakpoints: [],
    editable: [{ kind: 'hiddenUnits', layer: 0, options: [1, 2, 3, 4, 6] }],
    panels: [],
    walkthrough: [
      {
        text: 'Step size is “Layer”. Step until the first example is loaded: its two features become the input layer.',
        action: { type: 'runToKind', kind: 'LOAD_INPUT' },
        actionLabel: 'Load the first example',
      },
      {
        text: 'One step runs layer 1 completely: u = a·W, z = u + b, a = tanh(z). All three hidden values appear at once.',
        action: { type: 'step', count: 1 },
        actionLabel: 'Run layer 1',
      },
      { text: 'Click a hidden neuron: the inspector shows its weighted sum term by term.' },
      {
        text: 'Step again to run layer 2. Its input is layer 1’s output. The result is the prediction ŷ.',
        action: { type: 'step', count: 1 },
        actionLabel: 'Run layer 2',
      },
    ],
    selfCheck: [
      {
        id: 'fp1',
        question:
          'Layer 1 has 3 neurons and the input has 2 features. How many weights does layer 1 have (not counting biases)?',
        options: [
          { text: '6', correct: true, feedback: 'Yes: one weight for every input–neuron pair, 2 × 3.' },
          { text: '5', feedback: 'That adds instead of multiplying: there is a weight for every pair.' },
          { text: '3', feedback: 'That is the number of biases.' },
        ],
      },
      {
        id: 'fp2',
        question: 'To compute layer 2’s output you need…',
        options: [
          {
            text: 'layer 1’s outputs and layer 2’s weights and biases',
            correct: true,
            feedback: 'Right: each layer only reads the layer before it and its own parameters.',
          },
          { text: 'the loss', feedback: 'The loss is computed after the forward pass.' },
          { text: 'the gradients from the last step', feedback: 'Gradients belong to the backward pass.' },
        ],
      },
    ],
  },
  {
    id: 'loss',
    number: '4',
    track: 'core',
    title: 'Loss functions',
    objective: 'Interpret a loss value, and compare squared error and cross-entropy on the same prediction.',
    prerequisite: 'forward-propagation',
    intro:
      'A single sigmoid neuron classifying two clusters. The panel plots both losses against the prediction ŷ for the current example’s target and marks where this prediction is.',
    status: 'available',
    config: {
      seed: 3,
      epochs: 30,
      batchSize: 10,
      shuffle: true,
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 0.5 },
      boundaryGrid: 24,
      model: { inputShape: [2], layers: [dense(1, 'sigmoid')] },
    },
    dataset: { kind: 'gaussians', n: 40, seed: 8, separation: 1.5 },
    defaultGranularity: 'phase',
    suggestedBreakpoints: [],
    editable: [{ kind: 'loss', options: ['bce', 'mse'] }],
    panels: ['lossCompare'],
    walkthrough: [
      {
        text: 'Run to the first COMPUTE_LOSS. The panel marks this example’s prediction on both loss curves.',
        action: { type: 'runToKind', kind: 'COMPUTE_LOSS' },
        actionLabel: 'Run to the loss',
      },
      {
        text: 'Compare the curves near the wrong end: cross-entropy grows without bound as a confident prediction becomes more wrong; squared error stays at most 1.',
      },
      {
        text: 'Run to GRAD_INIT: the slope of the loss at ŷ is where back-propagation starts. Cross-entropy’s slope is steep for confident mistakes, so they get corrected fastest.',
        action: { type: 'runToKind', kind: 'GRAD_INIT' },
        actionLabel: 'Run to the gradient',
      },
      {
        text: 'Switch the loss to MSE and jump to the end: compare the final accuracy and loss curve with cross-entropy.',
      },
    ],
    selfCheck: [
      {
        id: 'lo1',
        question: 'For a target of 1, which prediction has the larger cross-entropy loss?',
        options: [
          { text: 'ŷ = 0.1', correct: true, feedback: 'Yes: −log 0.1 ≈ 2.30 versus −log 0.9 ≈ 0.11.' },
          { text: 'ŷ = 0.9', feedback: 'ŷ = 0.9 is close to the target 1, so its loss is small.' },
          {
            text: 'They are equal',
            feedback: 'Loss measures distance from the target; 0.1 is much further from 1.',
          },
        ],
      },
      {
        id: 'lo2',
        question: 'A loss of exactly 0 means…',
        options: [
          {
            text: 'the prediction equals the target',
            correct: true,
            feedback: 'Right: both losses are zero only for a perfect prediction.',
          },
          {
            text: 'the network has stopped learning',
            feedback: 'It means there is nothing left to correct for that example, not that learning failed.',
          },
          { text: 'the accuracy is 0 %', feedback: 'It is the opposite: a perfect prediction.' },
        ],
      },
    ],
  },
  {
    id: 'gradient-descent',
    number: '5',
    track: 'core',
    title: 'Gradient descent',
    objective:
      'Explain gradient descent on a loss surface and the effect of the learning rate, including divergence.',
    prerequisite: 'loss',
    intro:
      'Fit a line y = w·x + b to 50 noisy points. With only two parameters the whole loss surface L(w, b) can be drawn, and every update is a step on it.',
    status: 'available',
    config: lineRegression(0.3),
    dataset: { kind: 'line', n: 50, seed: 2 },
    defaultGranularity: 'batch',
    suggestedBreakpoints: ['nonFinite'],
    editable: [{ kind: 'learningRate', options: [0.02, 0.3, 0.9, 1.1] }],
    panels: ['surface'],
    walkthrough: [
      {
        text: 'The panel shows contour lines of the loss L(w, b) over the two parameters, and the path the parameters have taken so far. Step one batch.',
        action: { type: 'step', count: 2 },
        actionLabel: 'Step one batch',
      },
      {
        text: 'Each step moves against the gradient — downhill, perpendicular to the contour lines. Keep stepping by batch and watch the path.',
        action: { type: 'step', count: 8 },
        actionLabel: 'Step eight batches',
      },
      {
        text: 'Set the learning rate to 0.02: the steps are tiny and after 40 epochs the path is still far from the minimum.',
      },
      {
        text: 'Set it to 0.9: the path zig-zags across the valley but still converges. At 1.1 every step overshoots further than the last and the loss diverges — the NaN breakpoint will eventually stop the run.',
      },
    ],
    selfCheck: [
      {
        id: 'gd1',
        question: 'The update rule is θ ← θ − η·∂L/∂θ. Why the minus sign?',
        options: [
          {
            text: 'The gradient points uphill; we want to go downhill',
            correct: true,
            feedback: 'Yes: the gradient is the direction of steepest increase of L.',
          },
          {
            text: 'To keep the parameters small',
            feedback: 'That would be regularisation; the sign is about direction.',
          },
          {
            text: 'Because the loss is negative',
            feedback: 'Losses here are non-negative; the sign comes from the gradient’s direction.',
          },
        ],
      },
      {
        id: 'gd2',
        question: 'The loss grows larger after every step. The most likely fix is to…',
        options: [
          {
            text: 'lower the learning rate',
            correct: true,
            feedback: 'Right: steps that are too large overshoot the minimum by more each time.',
          },
          { text: 'train for more epochs', feedback: 'More steps of a diverging process diverge further.' },
          { text: 'raise the learning rate', feedback: 'That makes the overshoot worse.' },
        ],
      },
    ],
  },
  {
    id: 'backpropagation',
    number: '6',
    track: 'core',
    title: 'Back-propagation',
    objective: 'Apply the chain rule to send the error back through a network layer by layer.',
    prerequisite: 'gradient-descent',
    intro:
      'A 2-3-1 sigmoid network. The backward pass is the centre of this experiment: each layer multiplies the incoming gradient by its own local derivative and passes the result on.',
    status: 'available',
    config: {
      seed: 6,
      epochs: 30,
      batchSize: 4,
      shuffle: true,
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 1 },
      boundaryGrid: 24,
      model: { inputShape: [2], layers: [dense(3, 'sigmoid'), dense(1, 'sigmoid')] },
    },
    dataset: { kind: 'gaussians', n: 24, seed: 11 },
    defaultGranularity: 'operation',
    suggestedBreakpoints: ['gradInit'],
    editable: [{ kind: 'activation', layer: 0, options: ['sigmoid', 'tanh', 'relu'] }],
    panels: [],
    walkthrough: [
      {
        text: 'Run to the start of back-propagation. GRAD_INIT gives ∂ℓ/∂ŷ: how the loss changes with the output.',
        action: { type: 'runToKind', kind: 'GRAD_INIT' },
        actionLabel: 'Run to GRAD_INIT',
      },
      {
        text: 'Step once: GRAD_ACTIVATE multiplies by σ′(z) of the output — the first link of the chain.',
        action: { type: 'step', count: 1 },
        actionLabel: 'Step once',
      },
      {
        text: 'Two more steps give the bias and weight gradients of layer 2. A weight’s gradient is (its input) × (the error of the neuron it feeds).',
        action: { type: 'step', count: 2 },
        actionLabel: 'Step twice',
      },
      {
        text: 'GRAD_MATMUL_X sends the error back along the same weights to layer 1. Step and watch the hidden neurons receive ∂ℓ/∂a.',
        action: { type: 'step', count: 1 },
        actionLabel: 'Step once',
      },
      {
        text: 'Switch step size to Layer and step through layer 1’s backward pass. Then step back and forward to compare.',
        action: { type: 'granularity', granularity: 'layer' },
        actionLabel: 'Use layer steps',
      },
    ],
    selfCheck: [
      {
        id: 'bp1',
        question: 'The gradient that reaches layer 1’s output is computed from…',
        options: [
          {
            text: 'layer 2’s error signal and layer 2’s weights',
            correct: true,
            feedback: 'Yes: ∂ℓ/∂a¹ = ∂ℓ/∂z² · (W²)ᵀ.',
          },
          {
            text: 'layer 1’s weights only',
            feedback: 'Layer 1’s weights are used for layer 1’s own weight gradient, later.',
          },
          {
            text: 'the input features',
            feedback: 'Inputs enter the weight gradient of layer 1, not the error arriving at it.',
          },
        ],
      },
      {
        id: 'bp2',
        question: 'Why is the backward pass done from the output towards the input?',
        options: [
          {
            text: 'Each layer’s gradient needs the gradient of the layer after it',
            correct: true,
            feedback: 'Right: the chain rule is evaluated from the loss backwards, reusing each result.',
          },
          {
            text: 'Because the forward pass changed the inputs',
            feedback: 'The inputs never change; the order comes from the chain rule.',
          },
          {
            text: 'It is arbitrary',
            feedback: 'Going forwards would require the later gradients before they exist.',
          },
        ],
      },
    ],
  },
  {
    id: 'xor-mlp',
    number: '7',
    track: 'core',
    title: 'XOR needs a hidden layer',
    objective:
      'Explain why a hidden layer with a non-linearity is needed to learn XOR, and watch the decision boundary form.',
    prerequisite: 'backpropagation',
    intro:
      'Four XOR examples, four tanh hidden units, one sigmoid output, full-batch gradient descent. Defaults chosen by a recorded sweep: 20 of 20 seeds solve XOR within 100 epochs; with 2 hidden units only 9 of 20 do.',
    status: 'available',
    config: {
      seed: 3,
      epochs: 150,
      batchSize: 4,
      shuffle: true,
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 1 },
      boundaryGrid: 24,
      model: { inputShape: [2], layers: [dense(4, 'tanh'), dense(1, 'sigmoid')] },
    },
    dataset: { kind: 'xor' },
    defaultGranularity: 'epoch',
    suggestedBreakpoints: [],
    editable: [
      { kind: 'hiddenUnits', layer: 0, options: [1, 2, 3, 4, 8] },
      { kind: 'learningRate', options: [0.3, 1, 2] },
    ],
    panels: [],
    walkthrough: [
      {
        text: 'XOR is 1 when exactly one input is 1. No straight line separates the two classes — a single neuron cannot learn it.',
      },
      {
        text: 'Step by epoch and watch the decision boundary in “Training so far”: after a slow start it bends into two regions.',
        action: { type: 'epochEnd', epoch: 40 },
        actionLabel: 'Go to epoch 41',
      },
      {
        text: 'Jump to the end: accuracy is 100 %. Each hidden unit draws one line; the output combines them.',
        action: { type: 'jump', to: 'end' },
        actionLabel: 'Jump to the end',
      },
      {
        text: 'Set hidden units to 1 and jump to the end: one hidden line cannot separate XOR, so the accuracy stays below 100 %.',
      },
    ],
    selfCheck: [
      {
        id: 'xo1',
        question: 'Why can a single neuron not learn XOR?',
        options: [
          {
            text: 'Its decision boundary is a straight line, and XOR’s classes are not linearly separable',
            correct: true,
            feedback: 'Yes: a single sigmoid neuron separates the plane with one line.',
          },
          {
            text: 'Its learning rate is too small',
            feedback: 'No learning rate fixes a boundary of the wrong shape.',
          },
          {
            text: 'XOR has too few examples',
            feedback: 'Four examples are enough; the problem is the shape of the boundary.',
          },
        ],
      },
      {
        id: 'xo2',
        question: 'If the hidden layer used the linear (identity) activation, the network would…',
        options: [
          {
            text: 'still fail on XOR',
            correct: true,
            feedback: 'Right: two linear layers compose into one linear map.',
          },
          {
            text: 'learn XOR faster',
            feedback: 'Without a non-linearity the hidden layer adds no expressive power.',
          },
          {
            text: 'need more epochs but succeed',
            feedback: 'No amount of training makes a linear model solve XOR.',
          },
        ],
      },
    ],
  },
  {
    id: 'cnn-mnist',
    number: '8',
    track: 'core',
    title: 'A CNN on handwritten digits',
    objective:
      'Explain convolution, weight sharing and pooling by watching a small CNN learn to tell handwritten 0s, 1s and 2s apart.',
    prerequisite: 'xor-mlp',
    intro:
      '1 500 MNIST digits (0, 1, 2) at 28×28, with 300 more held out for testing. Four 3×3 kernels slide over each image, max-pooling halves each feature map, and a dense softmax layer chooses the digit. Generating the full run takes a few seconds.',
    status: 'available',
    config: {
      seed: 1,
      epochs: 3,
      batchSize: 20,
      shuffle: true,
      loss: 'cce',
      optimizer: { type: 'momentum', lr: 0.05, momentum: 0.9 },
      model: {
        inputShape: [1, 28, 28],
        layers: [
          { type: 'conv2d', filters: 4, kernel: 3, activation: 'relu' },
          { type: 'pool', mode: 'max', size: 2 },
          { type: 'flatten' },
          dense(3, 'softmax'),
        ],
      },
    },
    dataset: { kind: 'asset', name: 'mnist-012' },
    defaultGranularity: 'layer',
    suggestedBreakpoints: [],
    editable: [
      { kind: 'activation', layer: 0, options: ['relu', 'tanh', 'sigmoid'] },
      { kind: 'learningRate', options: [0.005, 0.05, 0.5] },
    ],
    panels: [],
    walkthrough: [
      {
        text: 'Load the first digit. The input panel shows its 28 × 28 pixels.',
        action: { type: 'runToKind', kind: 'LOAD_INPUT' },
        actionLabel: 'Load a digit',
      },
      {
        text: 'Step once: CONV2D slides each 3 × 3 kernel over the image. Watch the window sweep; the dot product under it becomes one cell of a feature map.',
        action: { type: 'runToKind', kind: 'CONV2D' },
        actionLabel: 'Run the convolution',
      },
      {
        text: 'Click any cell of a feature map: the window stops there and the computation lists the nine pixel × weight products. The same nine weights are used at every position — weight sharing.',
      },
      {
        text: 'Step to POOL: each 2 × 2 block keeps only its largest value, halving the map in each direction.',
        action: { type: 'runToKind', kind: 'POOL' },
        actionLabel: 'Run the pooling',
      },
      {
        text: 'Run to GRAD_CONV2D: each kernel weight’s gradient adds up evidence from all 676 positions it was used at.',
        action: { type: 'runToKind', kind: 'GRAD_CONV2D' },
        actionLabel: 'Run to the kernel gradient',
      },
      {
        text: 'Jump to the end. “Training so far” shows test accuracy on 300 digits the network never trained on.',
        action: { type: 'jump', to: 'end' },
        actionLabel: 'Jump to the end',
      },
    ],
    selfCheck: [
      {
        id: 'cn1',
        question:
          'A 3 × 3 kernel slides over a 28 × 28 image with stride 1 and no padding. How large is the feature map?',
        options: [
          {
            text: '26 × 26',
            correct: true,
            feedback: 'Yes: (28 − 3)/1 + 1 = 26 positions in each direction.',
          },
          { text: '28 × 28', feedback: 'Without padding the kernel cannot be centred on the border pixels.' },
          { text: '9 × 9', feedback: 'That would be the number of kernel weights, not output positions.' },
        ],
      },
      {
        id: 'cn2',
        question: 'Why does this convolutional layer have only 4 × 9 + 4 = 40 parameters?',
        options: [
          {
            text: 'Each kernel’s 9 weights are shared across every position of the image',
            correct: true,
            feedback:
              'Right: weight sharing. A dense layer from 784 pixels to 2 704 outputs would need over 2 million weights.',
          },
          {
            text: 'Pooling removes most of the weights',
            feedback: 'Pooling has no weights at all; it only down-samples.',
          },
          {
            text: 'Only the image border is connected',
            feedback: 'Every position is connected, through the same shared kernel.',
          },
        ],
      },
      {
        id: 'cn3',
        question: 'During back-propagation, a 2 × 2 max-pooling layer sends each gradient…',
        options: [
          {
            text: 'only to the position that held the maximum',
            correct: true,
            feedback: 'Yes: only the winner influenced the output, so only it receives gradient.',
          },
          { text: 'equally to all four positions', feedback: 'That is average pooling.' },
          {
            text: 'nowhere, because pooling has no weights',
            feedback: 'It has no weights, but it still passes gradient back to its inputs.',
          },
        ],
      },
    ],
  },
  {
    id: 'vanishing-gradients',
    number: 'D1',
    track: 'diagnostic',
    title: 'Vanishing gradients',
    objective: 'Diagnose vanishing gradients in a deep sigmoid network and see how ReLU avoids them.',
    prerequisite: 'backpropagation',
    intro:
      'Eight sigmoid hidden layers on the circles dataset. The heatmap “Gradient magnitude per layer” shows layer 1’s gradient orders of magnitude below layer 9’s.',
    status: 'available',
    config: {
      seed: 5,
      epochs: 20,
      batchSize: 16,
      shuffle: true,
      loss: 'bce',
      optimizer: { type: 'sgd', lr: 0.5 },
      boundaryGrid: 24,
      model: {
        inputShape: [2],
        layers: [...Array.from({ length: 8 }, () => dense(8, 'sigmoid')), dense(1, 'sigmoid')],
      },
    },
    dataset: { kind: 'circles', n: 64, seed: 3 },
    defaultGranularity: 'epoch',
    suggestedBreakpoints: ['vanishing'],
    editable: [{ kind: 'activation', layer: -1, options: ['sigmoid', 'relu', 'tanh'] }],
    panels: [],
    walkthrough: [
      {
        text: 'The breakpoint “a layer’s gradient vanishes” is on. Run to it.',
        action: { type: 'runToBreakpoint' },
        actionLabel: 'Run to the breakpoint',
      },
      {
        text: 'Jump to the end and read the heatmap: the top rows (early layers) are pale. Their gradients are thousands of times smaller, so they barely learn.',
        action: { type: 'jump', to: 'end' },
        actionLabel: 'Jump to the end',
      },
      {
        text: 'Switch all hidden activations to ReLU and jump to the end again: the rows are now of similar shade.',
      },
    ],
    selfCheck: [
      {
        id: 'vg1',
        question: 'Why do gradients shrink layer by layer in a deep sigmoid network?',
        options: [
          {
            text: 'Each layer multiplies the gradient by σ′(z) ≤ 0.25',
            correct: true,
            feedback: 'Yes: a product of many factors below 0.25 shrinks geometrically.',
          },
          {
            text: 'The early layers have fewer weights',
            feedback: 'All hidden layers here have the same size.',
          },
          {
            text: 'The learning rate is smaller for early layers',
            feedback: 'One learning rate is used for every layer.',
          },
        ],
      },
      {
        id: 'vg2',
        question: 'Which change most directly reduces vanishing gradients here?',
        options: [
          {
            text: 'Using ReLU in the hidden layers',
            correct: true,
            feedback: 'Yes: ReLU′ = 1 for active units, so the product does not shrink.',
          },
          {
            text: 'Training for more epochs',
            feedback: 'The early layers still receive tiny gradients every step.',
          },
          {
            text: 'Adding more sigmoid layers',
            feedback: 'That adds more factors ≤ 0.25 and makes it worse.',
          },
        ],
      },
    ],
  },
  {
    id: 'lr-pathology',
    number: 'D2',
    track: 'diagnostic',
    title: 'Learning-rate pathology',
    objective:
      'Recognise learning rates that are too small, good, too large and divergent from their loss curves.',
    prerequisite: 'gradient-descent',
    intro:
      'The same line-fitting problem as experiment 5, trained four times with four learning rates side by side. The main run uses the rate you select.',
    status: 'available',
    config: lineRegression(0.95, 30),
    dataset: { kind: 'line', n: 50, seed: 2 },
    defaultGranularity: 'epoch',
    suggestedBreakpoints: ['nonFinite', 'exploding'],
    editable: [{ kind: 'learningRate', options: [0.02, 0.3, 0.95, 1.1] }],
    panels: ['lrCompare'],
    walkthrough: [
      {
        text: 'The panel shows four complete runs. Too small (0.02): the loss falls slowly and is far from done. Good (0.3): fast and smooth.',
      },
      {
        text: 'Too large (0.95): fast but oscillating — each step overshoots and comes back. Divergent (1.1): every step overshoots further and the loss explodes.',
      },
      {
        text: 'Select 1.1 as the main run, then run to the exploding-gradient breakpoint.',
        action: { type: 'runToBreakpoint' },
        actionLabel: 'Run to the breakpoint',
      },
    ],
    selfCheck: [
      {
        id: 'lr1',
        question: 'A loss curve that falls quickly but zig-zags up and down suggests the learning rate is…',
        options: [
          {
            text: 'a little too large',
            correct: true,
            feedback: 'Yes: steps overshoot the valley floor and come back.',
          },
          { text: 'too small', feedback: 'A too-small rate gives a smooth but slow curve.' },
          { text: 'exactly right', feedback: 'A good rate gives a fast, smooth decrease.' },
        ],
      },
      {
        id: 'lr2',
        question: 'With a learning rate that is far too small, after many epochs the loss is…',
        options: [
          {
            text: 'still decreasing slowly, far from its minimum',
            correct: true,
            feedback: 'Right: every step is in the right direction but tiny.',
          },
          { text: 'NaN', feedback: 'NaN comes from rates that are too large.' },
          { text: 'oscillating', feedback: 'Oscillation means the steps are too large.' },
        ],
      },
    ],
  },
];

export const experimentById = (id: string): Experiment => {
  const e = EXPERIMENTS.find((x) => x.id === id);
  if (!e) throw new Error(`unknown experiment ${id}`);
  return e;
};

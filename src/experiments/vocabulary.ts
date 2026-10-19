/**
 * Vocabulary follows the curriculum (Fix Round 2, §2.2 principle 4): no term
 * appears on a novice screen before the experiment that teaches it.
 * `tests/unit/vocabulary.test.ts` renders every purpose-built novice screen
 * and fails if a screen uses a term introduced by a later experiment.
 *
 * Experiment titles in the curriculum list are names, not vocabulary, and the
 * handoff sentence may name the next experiment's question; both are outside
 * the check.
 */

export interface Term {
  /** Matched case-insensitively on word boundaries. */
  pattern: RegExp;
  label: string;
  /** Id of the experiment that introduces the term; 'expert' for technical terms kept to expert mode. */
  introducedIn: string;
}

export const TERMS: Term[] = [
  { label: 'activation function', pattern: /\bactivations?\b/i, introducedIn: 'activations' },
  { label: 'tanh', pattern: /\btanh\b/i, introducedIn: 'activations' },
  { label: 'ReLU', pattern: /\brelu\b/i, introducedIn: 'activations' },
  { label: 'saturation', pattern: /\bsaturat/i, introducedIn: 'activations' },
  { label: 'layer', pattern: /\blayers?\b/i, introducedIn: 'forward-propagation' },
  { label: 'hidden', pattern: /\bhidden\b/i, introducedIn: 'forward-propagation' },
  { label: 'forward pass', pattern: /\bforward\b/i, introducedIn: 'forward-propagation' },
  { label: 'loss', pattern: /\bloss(es)?\b/i, introducedIn: 'loss' },
  { label: 'cross-entropy', pattern: /\bcross-entropy\b/i, introducedIn: 'loss' },
  { label: 'gradient', pattern: /\bgradients?\b/i, introducedIn: 'gradient-descent' },
  { label: 'learning rate', pattern: /\blearning rate\b/i, introducedIn: 'gradient-descent' },
  { label: 'batch', pattern: /\bbatch(es)?\b/i, introducedIn: 'gradient-descent' },
  { label: 'epoch', pattern: /\bepochs?\b/i, introducedIn: 'gradient-descent' },
  { label: 'parameter', pattern: /\bparameters?\b/i, introducedIn: 'gradient-descent' },
  { label: 'back-propagation', pattern: /\bback-?propagat/i, introducedIn: 'backpropagation' },
  { label: 'backward pass', pattern: /\bbackwards?\b/i, introducedIn: 'backpropagation' },
  { label: 'chain rule', pattern: /\bchain rule\b/i, introducedIn: 'backpropagation' },
  { label: 'derivative', pattern: /\bderivatives?\b/i, introducedIn: 'backpropagation' },
  { label: 'multi-layer perceptron', pattern: /\bMLP\b/, introducedIn: 'xor-mlp' },
  { label: 'convolution', pattern: /\bconvol/i, introducedIn: 'cnn-mnist' },
  { label: 'kernel', pattern: /\bkernels?\b/i, introducedIn: 'cnn-mnist' },
  { label: 'feature map', pattern: /\bfeature maps?\b/i, introducedIn: 'cnn-mnist' },
  { label: 'pooling', pattern: /\bpool(ing|ed)?\b/i, introducedIn: 'cnn-mnist' },
  { label: 'softmax', pattern: /\bsoftmax\b/i, introducedIn: 'cnn-mnist' },
  { label: 'vanishing gradient', pattern: /\bvanish/i, introducedIn: 'vanishing-gradients' },
  { label: 'granularity', pattern: /\bgranularit/i, introducedIn: 'expert' },
  { label: 'operation', pattern: /\boperations?\b/i, introducedIn: 'expert' },
  { label: 'instruction', pattern: /\binstructions?\b/i, introducedIn: 'expert' },
  { label: 'trace', pattern: /\btraces?\b/i, introducedIn: 'expert' },
  { label: 'tensor', pattern: /\btensors?\b/i, introducedIn: 'expert' },
];

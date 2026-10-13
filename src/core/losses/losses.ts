/**
 * Loss selection and the activation/loss pairing rules.
 *
 * Pairing is validated, not assumed: categorical cross-entropy is only defined
 * after a softmax output and is computed fused on the logits; binary
 * cross-entropy needs probabilities, so it requires a sigmoid output.
 */
import type { Tape, Var } from '../autodiff';
import type { Activation } from '../layers/model';

export type LossName = 'mse' | 'bce' | 'cce';

export const LOSS_OP: Record<LossName, string> = {
  mse: 'mseLoss',
  bce: 'bceLoss',
  cce: 'softmaxCrossEntropy',
};

export function validatePairing(loss: LossName, outputActivation: Activation | null): void {
  if (loss === 'cce' && outputActivation !== 'softmax') {
    throw new Error(
      `categorical cross-entropy needs a softmax output layer, got ${outputActivation ?? 'none'}`,
    );
  }
  if (loss === 'bce' && outputActivation !== 'sigmoid') {
    throw new Error(`binary cross-entropy needs a sigmoid output layer, got ${outputActivation ?? 'none'}`);
  }
}

/** Whether the final softmax must be kept off the gradient path because the loss applies it. */
export const fusesSoftmax = (loss: LossName): boolean => loss === 'cce';

export function applyLoss(tape: Tape, loss: LossName, output: Var, logits: Var, target: Var): Var {
  const input = loss === 'cce' ? logits : output;
  return tape.apply(LOSS_OP[loss], [input, target], {}, { layer: 'loss' });
}

import { describe, expect, it } from 'vitest';
import { emptyProgress, isComplete, isUnlocked } from '../../src/experiments/progress';
import { experimentById } from '../../src/experiments/registry';

describe('curriculum progress and prerequisite enforcement', () => {
  it('locks everything after the first experiment until prerequisites are completed', () => {
    const p = emptyProgress();
    expect(isUnlocked('single-neuron', p)).toBe(true);
    expect(isUnlocked('activations', p)).toBe(false);
    expect(isUnlocked('vanishing-gradients', p)).toBe(false);
    p.completed.push('single-neuron');
    expect(isUnlocked('activations', p)).toBe(true);
    expect(isUnlocked('forward-propagation', p)).toBe(false);
  });

  it('planned experiments stay locked', () => {
    const p = emptyProgress();
    p.completed.push('xor-mlp');
    expect(isUnlocked('cnn-mnist', p)).toBe(experimentById('cnn-mnist').status === 'available');
  });

  it('an experiment is complete only when every self-check is answered correctly', () => {
    const e = experimentById('single-neuron');
    const p = emptyProgress();
    p.answers[e.id] = { [e.selfCheck[0].id]: e.selfCheck[0].options.findIndex((o) => o.correct) };
    expect(isComplete(e.id, p)).toBe(false);
    p.answers[e.id][e.selfCheck[1].id] = e.selfCheck[1].options.findIndex((o) => !o.correct);
    expect(isComplete(e.id, p)).toBe(false);
    p.answers[e.id][e.selfCheck[1].id] = e.selfCheck[1].options.findIndex((o) => o.correct);
    expect(isComplete(e.id, p)).toBe(true);
  });
});

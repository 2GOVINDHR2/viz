/**
 * Fix Round 6, C (ADR-083): the instructor view opens every experiment for a demonstration without completing
 * anything, the learner's gate is unchanged, and turning it off restores exactly the learner's own locks.
 */
import { describe, expect, it } from 'vitest';
import { loadInstructorOpen, openable } from '../../src/experiments/instructor';
import { emptyProgress, isComplete, isUnlocked } from '../../src/experiments/progress';
import { EXPERIMENTS } from '../../src/experiments/registry';
import { lab, open } from '../support/lab';

describe('C. the instructor view', () => {
  it('opens every available experiment; the gate itself is unchanged', () => {
    const p = emptyProgress();
    for (const e of EXPERIMENTS) {
      const own = isUnlocked(e.id, p);
      expect(openable(own, e.status === 'available', true)).toBe(e.status === 'available');
      expect(openable(own, e.status === 'available', false)).toBe(own);
    }
    expect(EXPERIMENTS.filter((e) => !isUnlocked(e.id, p)).length).toBeGreaterThan(5);
  });

  it('is turned on by a link with ?instructor=open, and not otherwise', () => {
    expect(loadInstructorOpen('?instructor=open')).toBe(true);
    expect(loadInstructorOpen('?mode=novice&instructor=open')).toBe(true);
    expect(loadInstructorOpen('')).toBe(false);
    expect(loadInstructorOpen('?instructor=1')).toBe(false);
  });

  it('never writes into progress; turning it off leaves a locked experiment for the first one', async () => {
    await open('single-neuron', 'novice');
    const before = JSON.stringify(lab().progress);
    lab().setInstructorOpen(true);
    await lab().load('cnn-mnist');
    expect(lab().experimentId).toBe('cnn-mnist');
    expect(JSON.stringify(lab().progress)).toBe(before);
    expect(isComplete('cnn-mnist', lab().progress)).toBe(false);
    lab().setInstructorOpen(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(lab().instructorOpen).toBe(false);
    expect(JSON.stringify(lab().progress)).toBe(before);
    expect(lab().experimentId).toBe('single-neuron');
  }, 120_000);
});

import { expect, type Page } from '@playwright/test';

/** Marks every experiment complete in localStorage, so tests can open any of them. */
export async function unlockAll(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const ids = [
      'single-neuron',
      'activations',
      'forward-propagation',
      'loss',
      'gradient-descent',
      'backpropagation',
      'xor-mlp',
      'cnn-mnist',
      'vanishing-gradients',
      'lr-pathology',
    ];
    localStorage.setItem(
      'dl-vizlab.progress.v1',
      JSON.stringify({ completed: ids, walkthrough: {}, answers: {} }),
    );
  });
}

export async function openExperiment(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`^\\S+\\. ${title}`) }).click();
  await expect(page.getByText(/Instruction 0 \//)).toBeVisible({ timeout: 60_000 });
}

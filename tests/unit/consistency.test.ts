/** Fix Round 5, 5.4: "1 layer", not "1 layers"; the empty state names the training run, not "nothing executed". */
import { describe, expect, it } from 'vitest';
import { lab, open, renderApp } from '../support/lab';

describe('5.4 consistency', () => {
  it('a one-layer model reads "1 layer"; a two-layer one "2 layers"', async () => {
    await open('loss', 'expert');
    expect(renderApp()).toMatch(/>1 layer · /);
    expect(renderApp()).not.toMatch(/\b1 layers\b/);
    await open('xor-mlp', 'expert');
    expect(renderApp()).toMatch(/>2 layers · /);
  });

  it('before the first step the screen says the training run has not started, not "nothing has executed"', async () => {
    await open('single-neuron', 'expert');
    await lab().jump(-1);
    const html = renderApp();
    expect(html).toContain('The training run has not started yet.');
    expect(html).not.toContain('Nothing has executed yet');
  });
});

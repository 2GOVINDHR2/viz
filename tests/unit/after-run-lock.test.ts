/**
 * Follow-up to Fix Round 5: experiment 1's third question (about what training does with the starting settings)
 * looked broken. It opened only while the current settings were exactly the starting ones, and the screen invites
 * changing them. It now opens once the starting run has been watched to its end, and stays open; while locked, it
 * offers one click that runs the starting settings to the end.
 */
import { describe, expect, it } from 'vitest';
import { experimentById } from '../../src/experiments/registry';
import { lab, open, renderApp } from '../support/lab';

const radios = (html: string, id: string): string[] =>
  [...html.matchAll(new RegExp(`<input[^>]*data-control="selfcheck:${id}"[^>]*>`, 'g'))].map((m) => m[0]);

describe('a question about the run opens once the run has been watched, and stays open', () => {
  it('locked at first, with a button that runs the starting settings to the end', async () => {
    await open('single-neuron', 'novice');
    const html = renderApp();
    expect(radios(html, 'sn3').length).toBe(3);
    for (const r of radios(html, 'sn3')) expect(r).toContain('disabled');
    expect(html).toContain('data-control="selfcheck:run-own"');
    // The button is not inside a disabled fieldset, so it can be pressed.
    expect(html).not.toMatch(/<fieldset[^>]*disabled/);
  });

  it('the button opens it; changing the settings afterwards does not close it again', async () => {
    await open('single-neuron', 'novice');
    const e = experimentById('single-neuron');
    // Try other settings first, as the screen invites, then press the button.
    await lab().applySetting(e.editable[1], 3);
    await lab().runOwn();
    expect(lab().cursor).toBe(lab().length - 1);
    for (const r of radios(renderApp(), 'sn3')) expect(r).not.toContain('disabled');
    await lab().applySetting(e.editable[0], 4);
    expect(lab().reachedEnd).toBe(false);
    for (const r of radios(renderApp(), 'sn3')) expect(r).not.toContain('disabled');
    expect(renderApp()).not.toContain('data-control="selfcheck:run-own"');
  });

  it('running other settings to the end does not open it', async () => {
    await open('single-neuron', 'novice');
    const e = experimentById('single-neuron');
    await lab().applySetting(e.editable[1], 3);
    await lab().jump(lab().length - 1);
    for (const r of radios(renderApp(), 'sn3')) expect(r).toContain('disabled');
  });
});

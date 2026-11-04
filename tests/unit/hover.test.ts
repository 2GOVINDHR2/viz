/** Fix Round 5, 5.1 (ADR-077): what a hovered neuron or weight involves, as the canvas lights it. */
import { describe, expect, it } from 'vitest';
import { involvement } from '../../src/views/execution/NetworkView';

describe('5.1 hover involvement', () => {
  const sizes = [2, 3, 1]; // input 2, hidden 3, output 1
  it('a hidden neuron: every input and the weights from them, and the output and the weight to it', () => {
    const v = involvement({ type: 'unit', c: 1, i: 2 }, sizes);
    expect([...v.units].sort()).toEqual(['0:0', '0:1', '1:2', '2:0']);
    expect([...v.edges].sort()).toEqual(['1:0:2', '1:1:2', '2:2:0']);
  });
  it('an input: itself and the hidden neurons it feeds; an output: the hidden neurons that feed it', () => {
    expect([...involvement({ type: 'unit', c: 0, i: 1 }, sizes).edges].sort()).toEqual([
      '1:1:0',
      '1:1:1',
      '1:1:2',
    ]);
    expect([...involvement({ type: 'unit', c: 2, i: 0 }, sizes).units].sort()).toEqual([
      '1:0',
      '1:1',
      '1:2',
      '2:0',
    ]);
  });
  it('a weight: the neuron it reads and the neuron it feeds', () => {
    const v = involvement({ type: 'edge', c: 2, i: 1, j: 0 }, sizes);
    expect([...v.units].sort()).toEqual(['1:1', '2:0']);
    expect([...v.edges]).toEqual(['2:1:0']);
  });
  it('nothing hovered: nothing involved', () => {
    expect(involvement(null, sizes).units.size).toBe(0);
  });
});

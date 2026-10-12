/**
 * Structural checks on the concept inventory, plus re-computation of every
 * numerical item's keyed answer with the engine, so a typo in an item can
 * never make a wrong option the key.
 */
import { describe, expect, it } from 'vitest';
import { Tape, backward } from '../../src/core/autodiff';
import { conv2dOutputSize, matmul, relu, sigmoidScalar, softmax } from '../../src/core/tensor/ops';
import { Tensor } from '../../src/core/tensor/tensor';
import inventory from '../../src/study/config/concept-inventory.json';

type Item = (typeof inventory.items)[number] & { check?: Record<string, unknown>; transfer?: boolean };
const all = [...inventory.items, ...inventory.transfer_items] as Item[];
const t = (shape: number[], v: number[]) => Tensor.from(shape, v);
const parse = (s: string): number => Number(s.replace('−', '-').replace(/\s/g, ''));

describe('concept inventory', () => {
  it('has 20 core items and 5 transfer items with unique ids', () => {
    expect(inventory.items).toHaveLength(20);
    expect(inventory.transfer_items).toHaveLength(5);
    expect(new Set(all.map((i) => i.id)).size).toBe(25);
  });

  it('every item has four distinct options, a valid key, a valid concept and Bloom level, and a misconception for each distractor', () => {
    for (const i of all) {
      expect(i.options, i.id).toHaveLength(4);
      expect(new Set(i.options.map((o) => o.text)).size, i.id).toBe(4);
      expect(i.answer).toBeGreaterThanOrEqual(0);
      expect(i.answer).toBeLessThan(4);
      expect(inventory.concepts).toContain(i.concept);
      expect(inventory.bloom_levels).toContain(i.bloom);
      i.options.forEach((o, k) => {
        if (k !== i.answer)
          expect((o as { misconception?: string }).misconception, `${i.id} option ${k}`).toBeTruthy();
      });
    }
  });

  it('covers every target concept and all three Bloom levels in the core 20', () => {
    const concepts = new Set(inventory.items.map((i) => i.concept));
    for (const c of [
      'perceptron',
      'activation',
      'forward_propagation',
      'loss',
      'gradient',
      'chain_rule',
      'learning_rate',
      'weight_update',
      'overfitting',
      'convolution',
      'pooling',
    ])
      expect(concepts.has(c), c).toBe(true);
    expect(new Set(inventory.items.map((i) => i.bloom))).toEqual(new Set(['recall', 'understand', 'apply']));
  });

  it('every numerical item’s keyed answer is re-computed by the engine', () => {
    const checked: string[] = [];
    for (const i of all) {
      const c = i.check as Record<string, never> | undefined;
      if (!c) continue;
      const key = i.options[i.answer].text;
      switch (c.type as string) {
        case 'neuron': {
          const z = (c.x as number[]).reduce((s, x, k) => s + x * (c.w as number[])[k], 0) + (c.b as number);
          expect(z).toBeCloseTo(c.expected, 12);
          expect(parse(key)).toBeCloseTo(z, 12);
          break;
        }
        case 'sigmoid_derivative': {
          const s = sigmoidScalar(c.z);
          expect(s * (1 - s)).toBeLessThan(c.max);
          break;
        }
        case 'mlp': {
          const h = relu(
            Tensor.from(
              [1, 2],
              matmul(t([1, 2], c.x), t([2, 2], (c.W1 as number[][]).flat())).data.map(
                (v, k) => v + (c.b1 as number[])[k],
              ),
            ),
          );
          const y = matmul(h, t([2, 1], c.w2)).item();
          expect(y).toBe(c.expected);
          expect(parse(key)).toBe(y);
          break;
        }
        case 'bce_compare': {
          const l = (p: number): number =>
            -((c.y as number) * Math.log(p) + (1 - (c.y as number)) * Math.log(1 - p));
          expect(l(c.p_a) > l(c.p_b)).toBe(c.a_larger);
          break;
        }
        case 'mse': {
          const p = c.pred as number[];
          const m = p.reduce((s, v, k) => s + (v - (c.target as number[])[k]) ** 2, 0) / p.length;
          expect(m).toBe(c.expected);
          expect(parse(key)).toBe(m);
          break;
        }
        case 'sgd': {
          const w = (c.w as number) - (c.lr as number) * (c.grad as number);
          expect(w).toBeCloseTo(c.expected, 12);
          expect(parse(key)).toBeCloseTo(w, 12);
          break;
        }
        case 'chain': {
          // Use the autodiff engine: L = (σ(z) − y)², z = w·x, with w chosen so σ(w·x) = a.
          const z = Math.log((c.a as number) / (1 - (c.a as number)));
          const tape = new Tape();
          const w = tape.leaf(Tensor.scalar(z / (c.x as number)), true);
          const a = tape.apply('sigmoid', [tape.apply('mul', [w, tape.leaf(Tensor.scalar(c.x), false)])]);
          const L = tape.apply('square', [tape.apply('sub', [a, tape.leaf(Tensor.scalar(c.y), false)])]);
          const g = backward(tape, L).get(w.id)!.item();
          expect(g).toBeCloseTo(c.expected, 10);
          expect(parse(key)).toBeCloseTo(g, 10);
          break;
        }
        case 'gd_quadratic': {
          let w = c.w0 as number;
          const seq = [];
          for (let k = 0; k < 2; k++) seq.push((w = w - (c.lr as number) * 2 * w));
          expect(seq).toEqual(c.expected);
          break;
        }
        case 'conv_size': {
          const n = conv2dOutputSize(c.n, c.k, c.s, c.p);
          expect(n).toBe(c.expected);
          expect(key).toBe(`${n}×${n}`);
          break;
        }
        case 'softmax_grad_sign': {
          const p = softmax(t([1, 3], c.z));
          const g = Array.from(p.data, (v, k) => v - (c.y as number[])[k]);
          expect(g.map((v, k) => (v < 0 ? k : -1)).filter((k) => k >= 0)).toEqual(c.expected_negative);
          break;
        }
        case 'conv_params': {
          const n = (c.filters as number) * (c.k as number) ** 2 * (c.c as number) + (c.filters as number);
          expect(n).toBe(c.expected);
          expect(parse(key)).toBe(n);
          break;
        }
        default:
          throw new Error(`unknown check ${String(c.type)}`);
      }
      checked.push(i.id);
    }
    expect(checked.length).toBeGreaterThanOrEqual(11);
  });
});

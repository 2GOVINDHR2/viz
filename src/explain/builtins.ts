/**
 * Explainers for every built-in instruction kind. Each is a pure function of
 * the instruction and the operand values it references.
 */
import type { Instruction, Operand } from '../core/npm/ir';
import { layerNumber } from '../core/npm/ir';
import type { Tensor } from '../core/tensor/tensor';
import { norm, num, shapeText, tex, texSum, texVec, texp, unravel } from './format';
import { type ExplainContext, type Explanation, registerExplainer } from './registry';

const ACT_TEX: Record<string, { f: string; df: string; name: string }> = {
  sigmoid: {
    f: '\\sigma(z) = \\frac{1}{1+e^{-z}}',
    df: "\\sigma'(z) = \\sigma(z)\\,(1-\\sigma(z))",
    name: 'sigmoid',
  },
  tanh: {
    f: '\\tanh(z) = \\frac{e^{z}-e^{-z}}{e^{z}+e^{-z}}',
    df: "\\tanh'(z) = 1-\\tanh^2(z)",
    name: 'tanh',
  },
  relu: { f: '\\mathrm{ReLU}(z) = \\max(0, z)', df: "\\mathrm{ReLU}'(z) = [z > 0]", name: 'ReLU' },
  linear: { f: 'f(z) = z', df: "f'(z) = 1", name: 'identity (linear)' },
  softmax: {
    f: '\\mathrm{softmax}(z)_j = \\frac{e^{z_j}}{\\sum_k e^{z_k}}',
    df: '\\frac{\\partial a_j}{\\partial z_k} = a_j(\\delta_{jk} - a_k)',
    name: 'softmax',
  },
};

const sup = (l: number): string => `^{(${l})}`;
const L = (i: Instruction): number => layerNumber(i.path.layer);
const op = (i: Instruction, role: string): Operand => {
  const o = i.operands.find((x) => x.role === role);
  if (!o) throw new Error(`${i.kind} #${i.id} has no "${role}" operand`);
  return o;
};
const val = (i: Instruction, ctx: ExplainContext, role: string): Tensor => ctx.value(op(i, role));
const maybe = (i: Instruction, ctx: ExplainContext, role: string): Tensor | null => {
  const o = i.operands.find((x) => x.role === role);
  return o ? ctx.value(o) : null;
};
const main = (i: Instruction): Tensor => Object.values(i.results)[0];
const focusIn = (t: Tensor, ctx: ExplainContext): number => Math.min(Math.max(0, ctx.focus), t.size - 1);
const paramTex = (name: unknown): string => {
  const [layer, role] = String(name).split('.');
  const sym = role === 'W' || role === 'b' ? role : `\\${role}`;
  return `${sym}${sup(layerNumber(layer))}`;
};
const paramWords = (name: unknown): string => {
  const [layer, role] = String(name).split('.');
  const what = role === 'W' ? 'weights' : role === 'b' ? 'biases' : `${role} parameters`;
  return `${what} of layer ${layerNumber(layer)}`;
};
const unitWord = (t: Tensor): string => (t.rank === 4 ? 'feature-map cell' : 'neuron');
const idxText = (t: Tensor, k: number): string => {
  if (t.rank === 2 && t.shape[0] === 1) return `${k + 1}`;
  return unravel(k, t.shape)
    .slice(t.shape[0] === 1 ? 1 : 0)
    .map((v) => v + 1)
    .join(',');
};

function explainInitParam(i: Instruction, ctx: ExplainContext): Explanation {
  const v = main(i);
  const shape = (i.meta.shape as number[]) ?? [...v.shape];
  const init = String(i.meta.initializer);
  const fanIn = shape.length === 4 ? shape[1] * shape[2] * shape[3] : shape[0];
  const fanOut = shape.length === 4 ? shape[0] * shape[2] * shape[3] : (shape[1] ?? shape[0]);
  const p = paramTex(i.meta.param);
  const k = focusIn(v, ctx);
  const forms: Record<string, [string, string, number]> = {
    glorotUniform: [
      `${p}_{ij} \\sim \\mathcal{U}(-r, r),\\; r = \\sqrt{\\tfrac{6}{n_{in}+n_{out}}}`,
      `r = \\sqrt{\\tfrac{6}{${fanIn}+${fanOut}}}`,
      Math.sqrt(6 / (fanIn + fanOut)),
    ],
    heUniform: [
      `${p}_{ij} \\sim \\mathcal{U}(-r, r),\\; r = \\sqrt{\\tfrac{6}{n_{in}}}`,
      `r = \\sqrt{\\tfrac{6}{${fanIn}}}`,
      Math.sqrt(6 / fanIn),
    ],
    glorotNormal: [
      `${p}_{ij} \\sim \\mathcal{N}(0, s^2),\\; s = \\sqrt{\\tfrac{2}{n_{in}+n_{out}}}`,
      `s = \\sqrt{\\tfrac{2}{${fanIn}+${fanOut}}}`,
      Math.sqrt(2 / (fanIn + fanOut)),
    ],
    heNormal: [
      `${p}_{ij} \\sim \\mathcal{N}(0, s^2),\\; s = \\sqrt{\\tfrac{2}{n_{in}}}`,
      `s = \\sqrt{\\tfrac{2}{${fanIn}}}`,
      Math.sqrt(2 / fanIn),
    ],
  };
  if (init === 'given') {
    return {
      general: `${p} = \\text{chosen starting values}`,
      substituted: `${p} = ${texVec(v)}`,
      sentence: `The ${paramWords(i.meta.param)} start at fixed values chosen for this experiment instead of random ones, so every run starts from the same place.`,
    };
  }
  if (init === 'zeros') {
    return {
      general: `${p} = 0`,
      substituted: `${p} = ${texVec(v)}`,
      sentence: `The ${paramWords(i.meta.param)} start at zero. The weights start at different random values, so that is enough to make the units differ.`,
    };
  }
  const [g, s, r] = forms[init] ?? [`${p} \\sim \\text{${init}}`, '', 0];
  return {
    general: g,
    substituted: `${s} = ${tex(r)},\\quad ${p}_{${idxText(v, k)}} = ${tex(v.data[k])}`,
    sentence: `Before any learning, the ${paramWords(i.meta.param)} (${shapeText(v)}) are drawn at random from a seeded distribution. Random starting values break the symmetry between neurons so that each can learn something different; the same seed always gives the same values.`,
    detail: `The spread r is scaled by the layer's fan-in and fan-out (${fanIn} and ${fanOut}) so that signals neither explode nor vanish as they pass through the layer.`,
  };
}

function explainLoadInput(i: Instruction): Explanation {
  return {
    general: 'a^{(0)} = x^{(i)},\\quad y = y^{(i)}',
    substituted: `a^{(0)} = ${texVec(i.results.x)},\\quad y = ${texVec(i.results.y)}`,
    sentence: `Training example #${String(i.meta.datasetIndex)} enters the network. Its features become the input layer's activations; its target y is held aside until the loss compares it with the prediction.`,
  };
}

function explainMatmul(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const a = val(i, ctx, 'input');
  const W = val(i, ctx, 'weight');
  const out = main(i);
  const j = focusIn(out, ctx) % out.shape[1];
  const n = W.shape[0];
  const m = W.shape[1];
  const terms = Array.from({ length: n }, (_, k) => `${texp(a.data[k])} \\cdot ${texp(W.data[k * m + j])}`);
  return {
    general: `u${sup(l)}_j = \\sum_{i} a${sup(l - 1)}_i \\, W${sup(l)}_{ij}`,
    substituted: `u${sup(l)}_{${j + 1}} = ${texSum(terms)} = ${tex(out.data[j])}`,
    sentence: `Each of the ${m} neurons in layer ${l} forms a weighted sum of the ${n} incoming activations; neuron ${j + 1}'s sum is ${num(out.data[j])}. This is the linear part of the layer — the bias and the non-linearity come next.`,
    detail: `In matrix form u = a·W with a of shape ${shapeText(a)} and W of shape ${shapeText(W)}. Weight W_{ij} scales how strongly input i drives neuron j; its sign decides whether it excites or inhibits.`,
  };
}

function explainConv(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const x = val(i, ctx, 'input');
  const K = val(i, ctx, 'kernel');
  const out = main(i);
  const k = focusIn(out, ctx);
  const [, f, r, c] = unravel(k, out.shape);
  const s = Number(i.meta.stride);
  const p = Number(i.meta.padding);
  const [, C, H, W] = x.shape;
  const [, , KH, KW] = K.shape;
  const terms: string[] = [];
  for (let ch = 0; ch < C; ch++)
    for (let u = 0; u < KH; u++)
      for (let v = 0; v < KW; v++) {
        const rr = r * s + u - p;
        const cc = c * s + v - p;
        if (rr < 0 || rr >= H || cc < 0 || cc >= W) continue;
        terms.push(
          `${texp(x.data[(ch * H + rr) * W + cc])} \\cdot ${texp(K.data[((f * C + ch) * KH + u) * KW + v])}`,
        );
      }
  return {
    general: `u${sup(l)}_{f,i,j} = \\sum_{c,u,v} a${sup(l - 1)}_{c,\\, is+u-p,\\, js+v-p}\\; K${sup(l)}_{f,c,u,v}`,
    substituted: `u${sup(l)}_{${f + 1},${r + 1},${c + 1}} = ${texSum(terms)} = ${tex(out.data[k])}`,
    sentence: `Each of the ${K.shape[0]} kernels (${KH}×${KW}) slides across the input with stride ${s}, taking a dot product with the patch underneath. Kernel ${f + 1} at row ${r + 1}, column ${c + 1} gives ${num(out.data[k])}: high where the patch looks like the kernel.`,
    detail: `Output size per side is ⌊(n + 2p − k)/s⌋ + 1, here ⌊(${H} + ${2 * p} − ${KH})/${s}⌋ + 1 = ${out.shape[2]}. The same kernel weights are reused at every position, which is why a CNN has far fewer weights than a dense layer on the same image.`,
  };
}

function explainAddBias(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const u = val(i, ctx, 'input');
  const b = val(i, ctx, 'bias');
  const z = main(i);
  const k = focusIn(z, ctx);
  const ch = u.rank === 4 ? unravel(k, z.shape)[1] : k % z.shape[1];
  return {
    general: `z${sup(l)}_j = u${sup(l)}_j + b${sup(l)}_j`,
    substituted: `z${sup(l)}_{${idxText(z, k)}} = ${tex(u.data[k])} + ${texp(b.data[ch])} = ${tex(z.data[k])}`,
    sentence: `The bias shifts each ${unitWord(z)}'s sum before the activation, letting it fire (or not) even when its inputs are zero. Here the bias ${num(b.data[ch])} moves ${num(u.data[k])} to ${num(z.data[k])}.`,
  };
}

function explainActivate(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const fn = String(i.meta.fn);
  const z = val(i, ctx, 'preactivation');
  const a = main(i);
  const k = focusIn(a, ctx);
  const t = ACT_TEX[fn] ?? { f: `${fn}(z)`, df: '', name: fn };
  let sentence = `The ${t.name} activation turns ${unitWord(a)} ${idxText(a, k)}'s value z = ${num(z.data[k])} into ${num(a.data[k])}. Without a non-linearity, stacked layers would collapse into a single linear map.`;
  if ((fn === 'sigmoid' || fn === 'tanh') && Math.abs(z.data[k]) > 4)
    sentence += ` At |z| > 4 the curve is almost flat (saturated), so very little gradient will flow back through this neuron.`;
  if (fn === 'relu' && z.data[k] <= 0)
    sentence +=
      ' Because z ≤ 0 the neuron is inactive for this example: it outputs 0 and will pass back no gradient.';
  if (fn === 'softmax')
    sentence = `Softmax turns the ${a.shape[1]} scores into probabilities that sum to 1; class ${(k % a.shape[1]) + 1} gets ${num(a.data[k])}.`;
  if (i.meta.fusedWithLoss)
    sentence +=
      ' (The loss works from the raw scores directly, which is numerically safer; these probabilities are shown so you can read the prediction.)';
  const sub =
    fn === 'softmax'
      ? `a${sup(l)} = \\mathrm{softmax}\\left(${texVec(z)}\\right) = ${texVec(a)}`
      : `a${sup(l)}_{${idxText(a, k)}} = ${fn === 'relu' ? `\\max(0, ${tex(z.data[k])})` : `${fn === 'sigmoid' ? '\\sigma' : fn === 'tanh' ? '\\tanh' : 'f'}(${tex(z.data[k])})`} = ${tex(a.data[k])}`;
  return { general: `a${sup(l)} = ${t.f}`, substituted: sub, sentence };
}

function explainPool(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const x = val(i, ctx, 'input');
  const out = main(i);
  const k = focusIn(out, ctx);
  const [, c, r, q] = unravel(k, out.shape);
  const size = Number(i.meta.size);
  const s = Number(i.meta.stride);
  const W = x.shape[3];
  const H = x.shape[2];
  const win: number[] = [];
  for (let u = 0; u < size; u++)
    for (let v = 0; v < size; v++) win.push(x.data[(c * H + r * s + u) * W + q * s + v]);
  const isMax = i.meta.mode === 'max';
  return {
    general: isMax
      ? `a${sup(l)}_{c,i,j} = \\max_{u,v} a${sup(l - 1)}_{c,\\,is+u,\\,js+v}`
      : `a${sup(l)}_{c,i,j} = \\frac{1}{k^2}\\sum_{u,v} a${sup(l - 1)}_{c,\\,is+u,\\,js+v}`,
    substituted: `a${sup(l)}_{${c + 1},${r + 1},${q + 1}} = \\${isMax ? 'max' : 'operatorname{mean}'}(${win.map(tex).join(', ')}) = ${tex(out.data[k])}`,
    sentence: `${isMax ? 'Max' : 'Average'} pooling shrinks each channel by summarising every ${size}×${size} window with its ${isMax ? 'largest value' : 'mean'}, keeping the strongest evidence for a feature while discarding its exact position. ${shapeText(x)} becomes ${shapeText(out)}.`,
  };
}

function explainFlatten(i: Instruction, ctx: ExplainContext): Explanation {
  const x = val(i, ctx, 'input');
  const out = main(i);
  return {
    general: `a${sup(L(i))} = \\operatorname{vec}(a${sup(L(i) - 1)})`,
    substituted: `${shapeText(x)} \\to ${shapeText(out)}`,
    sentence: `The ${x.shape[1]} feature maps are laid out end to end as one vector of ${out.shape[1]} numbers so a dense layer can read them. No arithmetic happens; only the arrangement changes.`,
  };
}

function explainForwardLayerEnd(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const a = val(i, ctx, 'layer output');
  const last = l === ctx.header.model.layers.length;
  return {
    general: `a${sup(l)} = f${sup(l)}(a${sup(l - 1)})`,
    substituted: `a${sup(l)} = ${texVec(a)}`,
    sentence: last
      ? `Layer ${l} is done and its output is the network's prediction ŷ for this example. Next, the loss compares it with the target.`
      : `Layer ${l} is done: its ${a.size} activations become the input of layer ${l + 1}.`,
  };
}

const LOSS_FORMS: Record<string, string> = {
  mse: '\\ell = \\frac{1}{K}\\sum_k (\\hat y_k - y_k)^2',
  bce: '\\ell = -\\frac{1}{K}\\sum_k \\left[y_k \\log \\hat y_k + (1-y_k)\\log(1-\\hat y_k)\\right]',
  cce: '\\ell = -\\sum_k y_k \\log \\mathrm{softmax}(z)_k',
};

function explainLoss(i: Instruction, ctx: ExplainContext): Explanation {
  const kind = String(i.meta.loss);
  const y = val(i, ctx, 'target');
  const l = main(i).item();
  const pred = maybe(i, ctx, 'prediction') ?? val(i, ctx, 'logits');
  let sub: string;
  let what: string;
  if (kind === 'mse') {
    sub = `\\ell = \\frac{1}{${pred.size}}\\left(${texSum(Array.from(pred.data, (p, k) => `(${tex(p)} - ${tex(y.data[k])})^2`))}\\right) = ${tex(l)}`;
    what = `The prediction ${num(pred.data[0])} vs. target ${num(y.data[0])}`;
  } else if (kind === 'bce') {
    sub = `\\ell = -\\left[${tex(y.data[0])}\\log ${tex(pred.data[0])} + ${tex(1 - y.data[0])}\\log(1-${tex(pred.data[0])})\\right] = ${tex(l)}`;
    what = `Predicting probability ${num(pred.data[0])} when the target is ${num(y.data[0])}`;
  } else {
    const cls = Array.from(y.data).indexOf(Math.max(...y.data));
    const z = pred.data;
    const m = Math.max(...z);
    const p = Math.exp(z[cls] - m) / Array.from(z).reduce((s, v) => s + Math.exp(v - m), 0);
    sub = `\\ell = -\\log \\mathrm{softmax}(z)_{${cls + 1}} = -\\log ${tex(p)} = ${tex(l)}`;
    what = `Giving the correct class (${cls + 1}) probability ${num(p)}`;
  }
  return {
    general: LOSS_FORMS[kind] ?? '\\ell(\\hat y, y)',
    substituted: sub,
    sentence: `${what} costs ${num(l)}. A perfect prediction would cost 0; learning means reducing this number.`,
    detail:
      kind === 'cce'
        ? 'Softmax and cross-entropy are computed together from the raw scores z so that a tiny probability never produces log(0).'
        : undefined,
  };
}

function explainLossReduce(i: Instruction, ctx: ExplainContext): Explanation {
  const losses = i.operands.map((o) => ctx.value(o).item());
  return {
    general: 'L = \\frac{1}{B}\\sum_{s=1}^{B} \\ell_s',
    substituted: `L = \\frac{1}{${losses.length}}\\left(${texSum(losses.map(tex), 5)}\\right) = ${tex(main(i).item())}`,
    sentence: `The ${losses.length} per-example losses of this mini-batch are averaged into one number, ${num(main(i).item())}. The update that follows lowers this average, not any single example's loss.`,
  };
}

function explainGradInit(i: Instruction, ctx: ExplainContext): Explanation {
  const kind = String(i.meta.loss);
  const g = main(i);
  const y = val(i, ctx, 'target');
  const k = focusIn(g, ctx);
  if (i.meta.wrt === 'logits') {
    const z = val(i, ctx, 'logits');
    const m = Math.max(...z.data);
    const sum = Array.from(z.data).reduce((s, v) => s + Math.exp(v - m), 0);
    const p = Math.exp(z.data[k] - m) / sum;
    return {
      general: '\\frac{\\partial \\ell}{\\partial z_k} = \\mathrm{softmax}(z)_k - y_k',
      substituted: `\\frac{\\partial \\ell}{\\partial z_{${k + 1}}} = ${tex(p)} - ${tex(y.data[k])} = ${tex(g.data[k])}`,
      sentence: `Back-propagation starts at the loss. For softmax with cross-entropy the chain rule collapses to "probability minus target": class ${k + 1}'s score should ${g.data[k] > 0 ? 'go down' : 'go up'} by an amount proportional to ${num(Math.abs(g.data[k]))}.`,
      detail:
        'This simplification is exact and is why the two are always paired: no separate softmax derivative is applied afterwards.',
    };
  }
  const p = val(i, ctx, 'prediction');
  const forms: Record<string, [string, string]> = {
    mse: [
      '\\frac{\\partial \\ell}{\\partial \\hat y_k} = \\frac{2}{K}(\\hat y_k - y_k)',
      `\\frac{2}{${p.size}}(${tex(p.data[k])} - ${tex(y.data[k])})`,
    ],
    bce: [
      '\\frac{\\partial \\ell}{\\partial \\hat y_k} = \\frac{1}{K}\\cdot\\frac{\\hat y_k - y_k}{\\hat y_k(1-\\hat y_k)}',
      `\\frac{${tex(p.data[k])} - ${tex(y.data[k])}}{${tex(p.data[k])}\\,(1-${tex(p.data[k])})}`,
    ],
  };
  const [gen, s] = forms[kind] ?? ['\\partial \\ell/\\partial \\hat y', ''];
  return {
    general: gen,
    substituted: `${s} = ${tex(g.data[k])}`,
    sentence: `Back-propagation starts at the loss: ${num(g.data[k])} says how fast the loss changes as the output rises. It is ${g.data[k] > 0 ? 'positive, so the output is too high and should fall' : g.data[k] < 0 ? 'negative, so the output is too low and should rise' : 'zero, so this output is already right'}.`,
  };
}

function explainGradActivate(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const fn = String(i.meta.fn);
  const up = val(i, ctx, 'upstream');
  const z = val(i, ctx, 'preactivation');
  const a = val(i, ctx, 'activation');
  const g = main(i);
  const k = focusIn(g, ctx);
  const d =
    fn === 'sigmoid'
      ? a.data[k] * (1 - a.data[k])
      : fn === 'tanh'
        ? 1 - a.data[k] ** 2
        : fn === 'relu'
          ? z.data[k] > 0
            ? 1
            : 0
          : 1;
  const t = ACT_TEX[fn] ?? { df: "f'(z)", name: fn };
  let sentence = `Chain rule through the ${t.name}: the gradient arriving at ${unitWord(g)} ${idxText(g, k)}'s output (${num(up.data[k])}) is multiplied by the activation's slope at z = ${num(z.data[k])}, which is ${num(d)}.`;
  if (fn !== 'relu' && fn !== 'linear' && fn !== 'softmax' && d < 0.05)
    sentence += ` Only ${num(d * 100)}% passes through — this is how gradients vanish in deep sigmoid/tanh networks.`;
  if (fn === 'relu')
    sentence +=
      d === 0
        ? ' The neuron was inactive, so the gradient is blocked completely.'
        : ' The neuron was active, so the gradient passes unchanged.';
  return {
    general: `\\frac{\\partial \\ell}{\\partial z${sup(l)}} = \\frac{\\partial \\ell}{\\partial a${sup(l)}} \\odot f'(z${sup(l)}),\\quad ${t.df}`,
    substituted:
      fn === 'softmax'
        ? `\\frac{\\partial \\ell}{\\partial z${sup(l)}} = ${texVec(g)}`
        : `${texp(up.data[k])} \\cdot ${texp(d)} = ${tex(g.data[k])}`,
    sentence,
  };
}

function explainGradBias(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const up = val(i, ctx, 'upstream');
  const g = main(i);
  const k = focusIn(g, ctx);
  const conv = up.rank === 4;
  return {
    general: conv
      ? `\\frac{\\partial \\ell}{\\partial b${sup(l)}_f} = \\sum_{i,j} \\frac{\\partial \\ell}{\\partial z${sup(l)}_{f,i,j}}`
      : `\\frac{\\partial \\ell}{\\partial b${sup(l)}_j} = \\frac{\\partial \\ell}{\\partial z${sup(l)}_j}`,
    substituted: `\\frac{\\partial \\ell}{\\partial b${sup(l)}_{${k + 1}}} = ${tex(g.data[k])}`,
    sentence: conv
      ? `A channel's bias is added at every position, so its gradient is the sum of the error signals over all ${up.shape[2] * up.shape[3]} positions of that feature map.`
      : `A bias adds directly to z, so its gradient is exactly the error signal of its neuron: ${num(g.data[k])}.`,
  };
}

function explainGradMatmulW(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const a = val(i, ctx, 'input');
  const up = val(i, ctx, 'upstream');
  const g = main(i);
  const k = focusIn(g, ctx);
  const [r, c] = unravel(k, g.shape);
  return {
    general: `\\frac{\\partial \\ell}{\\partial W${sup(l)}_{ij}} = a${sup(l - 1)}_i \\, \\delta${sup(l)}_j,\\qquad \\delta${sup(l)} = \\frac{\\partial \\ell}{\\partial z${sup(l)}}`,
    substituted: `\\frac{\\partial \\ell}{\\partial W${sup(l)}_{${r + 1}${c + 1}}} = ${texp(a.data[r])} \\cdot ${texp(up.data[c])} = ${tex(g.data[k])}`,
    sentence: `A weight's gradient is (the activation it multiplies) × (the error signal of the neuron it feeds). W(${r + 1},${c + 1}) gets ${num(g.data[k])}${a.data[r] === 0 ? ' — zero, because its input was 0 for this example' : ''}.`,
    detail: `In matrix form ∂ℓ/∂W = aᵀ·δ: an outer product of shapes ${shapeText(a)}ᵀ and ${shapeText(up)}. Weights from strongly active inputs into strongly wrong neurons change most.`,
  };
}

function explainGradMatmulX(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const W = val(i, ctx, 'weight');
  const up = val(i, ctx, 'upstream');
  const g = main(i);
  const k = focusIn(g, ctx) % g.shape[1];
  const m = W.shape[1];
  const terms = Array.from({ length: m }, (_, j) => `${texp(W.data[k * m + j])} \\cdot ${texp(up.data[j])}`);
  return {
    general: `\\frac{\\partial \\ell}{\\partial a${sup(l - 1)}_i} = \\sum_j W${sup(l)}_{ij}\\, \\delta${sup(l)}_j`,
    substituted: `\\frac{\\partial \\ell}{\\partial a${sup(l - 1)}_{${k + 1}}} = ${texSum(terms)} = ${tex(g.data[k])}`,
    sentence: `The error signal travels back to layer ${l - 1} along the same weights it came forward on: neuron ${k + 1} of layer ${l - 1} collects ${num(g.data[k])}, a weighted sum of the errors it contributed to. This is what lets earlier layers learn.`,
  };
}

function explainGradConv(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const dW = i.results.dW;
  const k = focusIn(dW, ctx);
  const [f, c, u, v] = unravel(k, dW.shape);
  return {
    general: `\\frac{\\partial \\ell}{\\partial K${sup(l)}_{f,c,u,v}} = \\sum_{i,j} \\delta${sup(l)}_{f,i,j}\\; a${sup(l - 1)}_{c,\\,is+u-p,\\,js+v-p}`,
    substituted: `\\frac{\\partial \\ell}{\\partial K${sup(l)}_{${f + 1},${c + 1},${u + 1},${v + 1}}} = ${tex(dW.data[k])},\\quad \\lVert \\nabla K${sup(l)} \\rVert = ${tex(norm(dW))}`,
    sentence: `Because one kernel is used at every position, its gradient adds up the evidence from all positions: each kernel weight collects (error at an output cell) × (the input pixel it touched there).${i.results.dX ? ' The input gradient is sent back by "spreading" each output error over the patch it came from, weighted by the kernel.' : ' This is the first layer, so no gradient is needed for the input image.'}`,
  };
}

function explainGradPool(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const up = val(i, ctx, 'upstream');
  const g = main(i);
  const isMax = i.meta.mode === 'max';
  const nonzero = Array.from(g.data).filter((v) => v !== 0).length;
  return {
    general: isMax
      ? `\\frac{\\partial \\ell}{\\partial a${sup(l - 1)}_{p}} = \\begin{cases}\\delta_{w} & p = \\arg\\max(w)\\\\ 0 & \\text{otherwise}\\end{cases}`
      : `\\frac{\\partial \\ell}{\\partial a${sup(l - 1)}_{p}} = \\frac{\\delta_{w}}{k^2}`,
    substituted: `${up.size}\\text{ gradients} \\to ${nonzero}\\text{ non-zero of } ${g.size}`,
    sentence: isMax
      ? `Only the winner of each pooling window influenced the output, so each window's gradient goes back to that single position; the other ${Number(i.meta.size) ** 2 - 1} positions get zero.`
      : `Every position of a window contributed equally to its mean, so each receives an equal 1/${Number(i.meta.size) ** 2} share of the window's gradient.`,
  };
}

function explainGradFlatten(i: Instruction): Explanation {
  return {
    general: `\\frac{\\partial \\ell}{\\partial a${sup(L(i) - 1)}} = \\operatorname{reshape}\\left(\\frac{\\partial \\ell}{\\partial a${sup(L(i))}}\\right)`,
    substituted: `\\to ${shapeText(main(i))}`,
    sentence:
      'The gradient vector is folded back into feature-map shape. Flattening did no arithmetic, so the gradient values are unchanged — only re-arranged.',
  };
}

function explainBackwardLayerEnd(i: Instruction, ctx: ExplainContext): Explanation {
  const l = L(i);
  const g = val(i, ctx, 'gradient');
  return {
    general: `\\lVert \\nabla \\rVert = \\sqrt{\\textstyle\\sum g^2}`,
    substituted: `\\lVert \\nabla \\rVert = ${tex(norm(g))}`,
    sentence:
      l > 1
        ? `The error signal has passed back through layer ${l}; layer ${l - 1} is next. Watch how its size (${num(norm(g))}) changes from layer to layer.`
        : 'The error signal has reached the first layer: every parameter now has its gradient for this example.',
  };
}

function explainAccumulate(i: Instruction, ctx: ExplainContext): Explanation {
  const g = main(i);
  const k = focusIn(g, ctx);
  const parts = i.operands.map((o) => ctx.value(o).data[k]);
  const p = paramTex(i.meta.param);
  return {
    general: `\\bar g(${p}) = \\frac{1}{B}\\sum_{s=1}^{B} \\frac{\\partial \\ell_s}{\\partial ${p}}`,
    substituted: `\\bar g(${p})_{${idxText(g, k)}} = \\frac{1}{${parts.length}}\\left(${texSum(parts.map(tex), 5)}\\right) = ${tex(g.data[k])}`,
    sentence: `The gradients of the ${paramWords(i.meta.param)} from the ${parts.length} example${parts.length > 1 ? 's' : ''} in this mini-batch are averaged. Examples that disagree partly cancel out; agreement makes a strong, reliable step.`,
  };
}

function explainOptState(i: Instruction, ctx: ExplainContext): Explanation {
  const v = main(i);
  const k = focusIn(v, ctx);
  const g = val(i, ctx, 'mean gradient');
  const prev = maybe(i, ctx, 'previous velocity');
  const mu = Number(i.meta.momentum);
  return {
    general: 'v \\leftarrow \\mu\\, v + \\bar g',
    substituted: `v = ${tex(mu)} \\cdot ${texp(prev ? prev.data[k] : 0)} + ${texp(g.data[k])} = ${tex(v.data[k])}`,
    sentence: `Momentum keeps a running memory of past gradients (decaying by ${num(mu)} each step). Consistent directions build up speed; oscillating ones cancel.`,
  };
}

function explainComputeUpdate(i: Instruction, ctx: ExplainContext): Explanation {
  const d = main(i);
  const k = focusIn(d, ctx);
  const src = ctx.value(i.operands[0]);
  const lr = Number(i.meta.lr);
  const p = paramTex(i.meta.param);
  const usesV = i.meta.optimizer === 'momentum';
  return {
    general: `\\Delta ${p} = -\\eta\\, ${usesV ? 'v' : '\\bar g'}`,
    substituted: `\\Delta ${p}_{${idxText(d, k)}} = -${tex(lr)} \\cdot ${texp(src.data[k])} = ${tex(d.data[k])}`,
    sentence: `The step points opposite the gradient — downhill on the loss — and its length is scaled by the learning rate η = ${num(lr)}. Too large a rate overshoots; too small crawls.`,
  };
}

function explainApplyUpdate(i: Instruction, ctx: ExplainContext): Explanation {
  const before = val(i, ctx, 'parameter');
  const delta = val(i, ctx, 'step');
  const after = main(i);
  const k = focusIn(after, ctx);
  const p = paramTex(i.meta.param);
  const dir = delta.data[k] < 0 ? 'decreased' : delta.data[k] > 0 ? 'increased' : 'did not change';
  return {
    general: `${p} \\leftarrow ${p} + \\Delta ${p}`,
    substituted: `${p}_{${idxText(after, k)}} = ${tex(before.data[k])} + ${texp(delta.data[k])} = ${tex(after.data[k])}`,
    sentence: `This value ${dir} because ${delta.data[k] < 0 ? 'its gradient was positive: making it smaller lowers the loss' : delta.data[k] > 0 ? 'its gradient was negative: making it larger lowers the loss' : 'its gradient was zero'}. Training is nothing more than many of these small corrections.`,
  };
}

const control =
  (text: (i: Instruction) => string, general = '\\text{control}'): ((i: Instruction) => Explanation) =>
  (i) => ({ general, substituted: `\\text{${i.symbolic.replace(/[{}\\]/g, '')}}`, sentence: text(i) });

registerExplainer('INIT_PARAM', explainInitParam);
registerExplainer('LOAD_INPUT', explainLoadInput);
registerExplainer('MATMUL', explainMatmul);
registerExplainer('CONV2D', explainConv);
registerExplainer('ADD_BIAS', explainAddBias);
registerExplainer('ACTIVATE', explainActivate);
registerExplainer('POOL', explainPool);
registerExplainer('FLATTEN', explainFlatten);
registerExplainer('FORWARD_LAYER_END', explainForwardLayerEnd);
registerExplainer('COMPUTE_LOSS', explainLoss);
registerExplainer('LOSS_REDUCE', explainLossReduce);
registerExplainer('GRAD_INIT', explainGradInit);
registerExplainer('GRAD_ACTIVATE', explainGradActivate);
registerExplainer('GRAD_BIAS', explainGradBias);
registerExplainer('GRAD_MATMUL_W', explainGradMatmulW);
registerExplainer('GRAD_MATMUL_X', explainGradMatmulX);
registerExplainer('GRAD_CONV2D', explainGradConv);
registerExplainer('GRAD_POOL', explainGradPool);
registerExplainer('GRAD_FLATTEN', explainGradFlatten);
registerExplainer('BACKWARD_LAYER_END', explainBackwardLayerEnd);
registerExplainer('GRAD_ACCUMULATE', explainAccumulate);
registerExplainer('OPTIMIZER_STATE', explainOptState);
registerExplainer('COMPUTE_UPDATE', explainComputeUpdate);
registerExplainer('APPLY_UPDATE', explainApplyUpdate);
registerExplainer(
  'EPOCH_BEGIN',
  control(
    (i) =>
      `Epoch ${String((i.path.epoch ?? 0) + 1)} begins: one full pass over all ${i.results.order.size} training examples${i.meta.shuffled ? ', in a freshly shuffled order so the network cannot learn the order itself' : ''}.`,
  ),
);
registerExplainer(
  'EPOCH_END',
  control(
    (i) =>
      `Epoch ${String((i.path.epoch ?? 0) + 1)} is over. The mean training loss during the epoch was ${num(i.results.meanLoss.item())}.`,
    '\\bar L = \\frac{1}{N}\\sum_i \\ell_i',
  ),
);
registerExplainer(
  'BATCH_BEGIN',
  control(
    (i) =>
      `Mini-batch ${String((i.path.batch ?? 0) + 1)} begins with ${String(i.meta.size)} examples. Each gets its own forward and backward pass; the parameters change only once, at the end of the batch.`,
  ),
);
registerExplainer(
  'BATCH_END',
  control(
    (i) =>
      `Mini-batch ${String((i.path.batch ?? 0) + 1)} is finished and every parameter has taken one step. Its average loss was ${num(Number(i.meta.loss))}.`,
  ),
);
registerExplainer(
  'EVAL_BEGIN',
  control(
    () =>
      'Evaluation: the current model is run on the whole training set without learning, to measure progress fairly with fixed parameters.',
  ),
);
registerExplainer(
  'EVAL_END',
  control(
    (i) =>
      `With the parameters as they stand, the loss over all ${String(i.meta.n)} examples is ${num(i.results.loss.item())}${i.results.accuracy ? ` and ${num(i.results.accuracy.item() * 100)}% are classified correctly` : ''}.`,
  ),
);

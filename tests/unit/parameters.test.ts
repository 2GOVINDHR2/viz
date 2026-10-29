/**
 * Fix Round 3 invariants F–H on the learner parameters, driving the real store with the engine in-process
 * (tests/support/lab.ts):
 *  F. parameter necessity: every parameter of the brief's table (A4) is declared by its experiment and renders as
 *     a typed field (a text box; a select for a named choice) in both modes;
 *  G. a typed value round-trips: the regenerated trace records exactly the typed value. The check reads the
 *     trace (its header, dataset and INIT_PARAM instructions), never the field that displays the value;
 *  H. rejection: an entry the engine cannot run is refused with a message naming what is valid, and the run is
 *     unchanged; a value that makes training diverge is accepted and reaches the pathology path (the NaN/∞
 *     breakpoint, or the instability detector).
 */
import { describe, expect, it } from 'vitest';
import type { TrainConfig } from '../../src/core/engine/session';
import type { TraceHeader } from '../../src/core/npm/ir';
import { runToBreakpoint } from '../../src/core/npm';
import { loadMnist } from '../../src/experiments/data/mnist';
import {
  applyParam,
  isNumeric,
  paramValue,
  regenerates,
  validateParam,
  type Setting,
} from '../../src/experiments/params';
import { EXPERIMENTS, experimentById } from '../../src/experiments/registry';
import type { EditableParam, Experiment } from '../../src/experiments/types';
import { NOVICE_SCREENS } from '../../src/ui/App';
import { activeBreakpoints, useLab } from '../../src/ui/store';
import { checkD } from '../support/invariants';
import { currentSource, freshSource, lab, open, renderApp, traceHash } from '../support/lab';
import { alternative, divergent, extreme, invalid } from '../support/params';
import type { TraceSource } from '../../src/core/npm';
import type { BreakpointToggles } from '../../src/ui/store';

const NONE: BreakpointToggles = {
  nonFinite: false,
  exploding: false,
  lossIncrease: false,
  vanishing: false,
  deadRelu: false,
  lossPlateau: false,
  gradInit: false,
};
const PATHOLOGIES: BreakpointToggles = {
  ...NONE,
  nonFinite: true,
  exploding: true,
  lossIncrease: true,
  vanishing: true,
  deadRelu: true,
};

/** True if any result anywhere in the run is NaN or ±∞ (an independent scan, not the breakpoint). */
function hasNonFinite(src: TraceSource): boolean {
  for (let id = 0; id < src.length;) {
    const [, end] = src.segmentBounds(id);
    for (const ins of src.range(id, end))
      for (const t of Object.values(ins.results))
        for (const x of t.data) if (!Number.isFinite(x)) return true;
    id = end;
  }
  return false;
}

type Need = { what: string; is(p: EditableParam): boolean };
const kind =
  (k: EditableParam['kind'], extra: (p: EditableParam) => boolean = () => true): Need['is'] =>
  (p) =>
    p.kind === k && extra(p);
const need = (what: string, is: Need['is']): Need => ({ what, is });
const SEED = need('seed', kind('seed'));
const LR = need('learning rate', kind('learningRate'));
const EPOCHS = need('epochs', kind('epochs'));

/**
 * The brief's table A4: what each experiment's objective needs the learner to change. "Every weight and bias" is
 * the starting-value editor (`parameterEditor`), whose fields invariant B already checks after every
 * architecture change; it is checked here as declared and present.
 */
export const A4: Record<string, { needs: Need[]; everyWeight?: boolean; noSeed?: string }> = {
  'single-neuron': {
    needs: [
      need(
        'weight w₁',
        kind('initialValue', (p) => p.kind === 'initialValue' && p.param === 'L1.W' && p.index === 0),
      ),
      need(
        'weight w₂',
        kind('initialValue', (p) => p.kind === 'initialValue' && p.param === 'L1.W' && p.index === 1),
      ),
      need(
        'bias b',
        kind('initialValue', (p) => p.kind === 'initialValue' && p.param === 'L1.b'),
      ),
      ...[0, 1, 2, 3].flatMap((ex) =>
        [0, 1].map((f) =>
          need(
            `input ${f + 1} of example ${ex + 1}`,
            kind('input', (p) => p.kind === 'input' && p.example === ex && p.feature === f),
          ),
        ),
      ),
      SEED,
    ],
  },
  activations: {
    needs: [need('the input value', kind('input')), need('the activation', kind('activation'))],
    noSeed: 'every parameter is given and nothing is shuffled',
  },
  'forward-propagation': {
    everyWeight: true,
    needs: [
      need(
        'input feature 1',
        kind('input', (p) => p.kind === 'input' && p.feature === 0),
      ),
      need(
        'input feature 2',
        kind('input', (p) => p.kind === 'input' && p.feature === 1),
      ),
      SEED,
    ],
  },
  loss: {
    needs: [
      need(
        'prediction ŷ',
        kind('probe', (p) => p.kind === 'probe' && p.id === 'loss:prediction'),
      ),
      need(
        'target y',
        kind('probe', (p) => p.kind === 'probe' && p.id === 'loss:target'),
      ),
      need('the loss', kind('loss')),
      SEED,
    ],
  },
  'gradient-descent': {
    needs: [
      LR,
      need('starting parameter value', kind('initialValue')),
      need('batch size', kind('batchSize')),
      need('number of steps (passes)', kind('epochs')),
    ],
    noSeed: 'both starting values are given and the full-batch default does not shuffle',
  },
  backpropagation: {
    everyWeight: true,
    needs: [need('input', kind('input')), need('target', kind('target')), LR, SEED],
  },
  'xor-mlp': {
    needs: [need('width', kind('hiddenUnits')), need('activation', kind('activation')), LR, EPOCHS, SEED],
  },
  'cnn-mnist': {
    needs: [
      ...(['filters', 'kernel', 'stride', 'padding'] as const).map((f) =>
        need(
          `conv ${f}`,
          kind('conv', (p) => p.kind === 'conv' && p.field === f),
        ),
      ),
      LR,
      need('batch size', kind('batchSize')),
      EPOCHS,
      SEED,
    ],
  },
  'vanishing-gradients': {
    needs: [
      need('depth', kind('depth')),
      need('activation', kind('activation')),
      need('initialisation scale', kind('initScale')),
      SEED,
    ],
  },
  'lr-pathology': {
    needs: [0, 1, 2, 3].map((k) =>
      need(
        `compared learning rate ${k + 1}`,
        kind('probe', (p) => p.kind === 'probe' && p.id === `lr:compare:${k}`),
      ),
    ),
    noSeed: 'the starting point is given and the full-batch run does not shuffle',
  },
};

const settingOf = (): Setting => ({ config: lab().config, dataset: lab().dataset, probes: lab().probes });
const perEpoch = (): number => lab().length / lab().config.epochs;

/** Novice purpose-built screens: the field that carries a parameter where it is not `tryit:<k>`. */
const NOVICE_ALIAS: Record<string, Partial<Record<EditableParam['kind'], string>>> = {
  // The learning rate goes through the predict-then-reveal staging; the batch size opens after it (ADR-056).
  'gradient-descent': { learningRate: 'lr-typed', batchSize: 'batch-typed' },
};

/** The field element carrying `data-control="<control>"`: a typed text box, or a select for a named choice. */
function fieldTag(html: string, control: string): string | null {
  const m = new RegExp(`<(input|select)[^>]*data-control="${control}"[^>]*>`).exec(html);
  if (!m) return null;
  return m[1] === 'select' ? 'select' : /type="text"/.test(m[0]) ? 'text' : m[0];
}

describe('F. every parameter the objective needs is declared, and typed-editable in both modes', () => {
  for (const e of EXPERIMENTS)
    it(`${e.number} ${e.title}`, async () => {
      const row = A4[e.id];
      expect(row, `${e.id} is in the A4 table`).toBeDefined();
      const v: string[] = [];
      const index = new Map<Need, number>();
      for (const n of row.needs) {
        const k = e.editable.findIndex(n.is);
        if (k < 0) v.push(`${n.what}: not declared`);
        else index.set(n, k);
      }
      if (row.everyWeight && !e.surface.parameterEditor)
        v.push('every weight and bias: no starting-value editor');
      const seeded = e.editable.some((p) => p.kind === 'seed');
      if (!seeded && !row.noSeed) v.push('seed: not declared');
      for (const mode of ['novice', 'expert'] as const) {
        await open(e.id, mode);
        const purpose = mode === 'novice' && !!NOVICE_SCREENS[e.id];
        // Open every progressive-disclosure section the screen offers: a parameter behind one still counts.
        if (purpose)
          for (const m of renderApp().matchAll(/data-control="deeper:([^"]+)"/g)) lab().setDeeper(m[1], true);
        const html = renderApp();
        for (const [n, k] of index) {
          const p = e.editable[k];
          const control = (purpose && NOVICE_ALIAS[e.id]?.[p.kind]) || `tryit:${k}`;
          // The batch-size field opens after the learning-rate prediction; tests/e2e/controls.spec.ts types it.
          if (purpose && control === 'batch-typed') continue;
          const tag = fieldTag(html, control);
          const want = isNumeric(p) ? 'text' : 'select';
          if (tag !== want)
            v.push(`${mode}: ${n.what} (${control}) renders as ${tag ?? 'nothing'}, not ${want}`);
        }
        if (row.everyWeight && !html.includes('data-control="params"'))
          v.push(`${mode}: the starting-value editor does not render`);
      }
      expect(v).toEqual([]);
    }, 240_000);
});

describe('F. experiments without a seed field are the ones a seed cannot affect', () => {
  for (const e of EXPERIMENTS.filter((x) => A4[x.id]?.noSeed))
    it(`${e.number} ${e.title}: ${A4[e.id].noSeed}`, () => {
      const a = freshSource(e.id, e.config);
      const b = freshSource(e.id, { ...e.config, seed: e.config.seed + 1 });
      // The header records the seed; everything after it must be identical.
      const body = (s: typeof a): string =>
        traceHash({ ...s, header: { ...s.header, seed: 0, config: null } });
      expect(body(b)).toBe(body(a));
    });
});

it('the bundled dataset sizes behind the batch-size range are the real ones', () => {
  expect(loadMnist().xs.shape[0]).toBe(1500);
});

/** The value the regenerated trace records for a parameter, read from the trace itself. */
async function inTrace(e: Experiment, p: EditableParam): Promise<number | string> {
  const src = currentSource();
  const h: TraceHeader = src.header;
  const config = h.config as TrainConfig;
  const init = (name: string): number[] => {
    const k = h.model.params.findIndex((x) => x.name === name);
    return Array.from(src.get(k).results.value.data);
  };
  switch (p.kind) {
    case 'learningRate':
      return config.optimizer.lr;
    case 'batchSize':
      return config.batchSize;
    case 'epochs':
      return h.epochStarts.length - 1;
    case 'seed':
      return h.seed;
    case 'loss':
      return config.loss;
    case 'activation':
      return h.model.layers[p.layer === -1 ? 0 : p.layer].activation ?? '';
    case 'hiddenUnits':
      return h.model.layers[p.layer].outShape[0];
    case 'depth':
      return h.model.layers.length - 1;
    case 'conv': {
      const l = h.model.layers[p.layer];
      if (p.field === 'filters') return l.outShape[0];
      if (p.field === 'kernel')
        return h.model.params.find((x) => x.layer === l.name && x.role !== 'bias')!.shape[3];
      const c = config.model.layers[p.layer] as { stride?: number; padding?: number };
      return p.field === 'stride' ? (c.stride ?? 1) : (c.padding ?? 0);
    }
    case 'input': {
      const f = h.dataset.inputShape.reduce((a, b) => a * b, 1);
      return h.dataset.xs!.data[p.example * f + p.feature];
    }
    case 'target':
      return h.dataset.ys!.data[p.example];
    case 'initialValue':
      return init(p.param)[p.index];
    case 'initScale': {
      // Against an independently generated run at the usual scale: the ratio of the first starting weight.
      const base = freshSource(e.id, { ...config, initialParams: undefined });
      const name = h.model.params[0].name;
      const k = base.header.model.params.findIndex((x) => x.name === name);
      const b = Array.from(base.get(k).results.value.data);
      const i = b.findIndex((x) => x !== 0);
      return init(name)[i] / b[i];
    }
    case 'probe':
      throw new Error('a probe is not in the trace');
  }
}

describe('G. a typed value round-trips into the trace', () => {
  for (const e of EXPERIMENTS)
    it(`${e.number} ${e.title}`, async () => {
      await open(e.id, 'expert');
      const initial = traceHash(currentSource());
      const v: string[] = [];
      for (const p of e.editable.filter(regenerates)) {
        const typed = String(alternative(settingOf(), p, perEpoch()));
        const r = validateParam(settingOf(), p, typed, perEpoch());
        if (!r.ok) {
          v.push(`${p.kind}: ${typed} rejected: ${r.message}`);
          continue;
        }
        await lab().applySetting(p, r.value);
        if (lab().error) v.push(`${p.kind}: ${lab().error}`);
        const got = await inTrace(e, p);
        const ok =
          typeof got === 'number'
            ? Math.abs(got - Number(typed)) <= 1e-6 * Math.max(1, Math.abs(got))
            : got === typed;
        // float32 storage of starting values and examples: exact to single precision, never clamped.
        if (!ok) v.push(`${p.kind}: typed ${typed}, the trace records ${got}`);
        // And the run is the run of exactly that setting.
        const want = applyParam({ config: e.config, dataset: e.dataset, probes: {} }, p, r.value);
        if (JSON.stringify(lab().config) !== JSON.stringify(want.config) && p.kind !== 'seed')
          v.push(`${p.kind}: the configuration is not the typed one`);
        await lab().resetExperiment();
      }
      // A probe changes the panel, not the trace: the loss calculator shows the formula's value for the typed ŷ, y.
      if (e.id === 'loss') {
        const [pred, target] = [
          e.editable.find((p) => p.kind === 'probe' && p.id === 'loss:prediction')!,
          e.editable.find((p) => p.kind === 'probe' && p.id === 'loss:target')!,
        ];
        await lab().applySetting(pred, 0.2);
        await lab().applySetting(target, 0.9);
        const html = renderApp();
        const shown = (k: string): number =>
          Number(new RegExp(`data-calc="${k}">([^<]+)<`).exec(html)![1].replace('−', '-'));
        expect(shown('mse')).toBeCloseTo((0.2 - 0.9) ** 2, 3);
        expect(shown('bce')).toBeCloseTo(-(0.9 * Math.log(0.2) + 0.1 * Math.log(0.8)), 3);
      }
      // Every typed change undone by reset (invariant D, extended to the examples and the panel values).
      if (e.editable.some((p) => !regenerates(p))) {
        await lab().applySetting(
          e.editable.find((p) => !regenerates(p))!,
          0.4,
        );
        lab().setDeeper('settings', true);
      }
      v.push(...(await checkD(initial)));
      expect(v).toEqual([]);
    }, 600_000);
});

describe('H. invalid entries are refused with a message; divergent ones are accepted and reach the pathology path', () => {
  for (const e of EXPERIMENTS)
    it(`${e.number} ${e.title}`, async () => {
      await open(e.id, 'expert');
      const v: string[] = [];
      for (const p of e.editable) {
        const before = JSON.stringify(settingOf());
        for (const raw of invalid(settingOf(), p)) {
          const r = validateParam(settingOf(), p, raw, perEpoch());
          if (r.ok) v.push(`${p.kind}: "${raw}" accepted as ${r.value}`);
          else if (!/\d|one of/.test(r.message))
            v.push(`${p.kind}: "${raw}": message names no valid range: ${r.message}`);
        }
        // Rejected entries leave the run as it was.
        if (JSON.stringify(settingOf()) !== before) v.push(`${p.kind}: a rejected entry changed the setting`);
        for (const [d, must] of [
          [divergent(p), true],
          [extreme(p), false],
        ] as const) {
          if (d === null) continue;
          const r = validateParam(settingOf(), p, d, perEpoch());
          if (!r.ok) {
            v.push(`${p.kind}: ${d} rejected: ${r.message}`);
            continue;
          }
          if (p.kind === 'probe') continue; // the compared rates: tests/e2e/controls.spec.ts shows the diverging curve
          await lab().applySetting(p, r.value);
          if (lab().error) {
            v.push(`${p.kind}: ${d} failed to run: ${lab().error}`);
            continue;
          }
          if (must) {
            // Reaches the pathology path: a non-finite value, exploding or vanishing gradients, or a rising loss.
            const hit = runToBreakpoint(currentSource(), -1, activeBreakpoints({ ...PATHOLOGIES }));
            if (!hit.hit) v.push(`${p.kind}: divergent ${d} ran without reaching a pathology breakpoint`);
          } else if (hasNonFinite(currentSource())) {
            const hit = runToBreakpoint(currentSource(), -1, activeBreakpoints({ ...NONE, nonFinite: true }));
            if (!hit.hit) v.push(`${p.kind}: ${d} produced a non-finite value the NaN/∞ breakpoint misses`);
          }
          await lab().resetExperiment();
        }
      }
      expect(v).toEqual([]);
    }, 600_000);
});

it('a typed entry through the store matches the field the learner sees', async () => {
  await open('gradient-descent', 'expert');
  const p = experimentById('gradient-descent').editable[0];
  await useLab.getState().applySetting(p, 1.37);
  expect(paramValue(settingOf(), p)).toBe(1.37);
  expect(renderApp()).toMatch(
    /data-control="tryit:0"[^>]*value="1.37"|value="1.37"[^>]*data-control="tryit:0"/,
  );
});

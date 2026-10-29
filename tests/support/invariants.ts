/**
 * Invariants A–D of Fix Round 2b, as checks over the live store state. Each
 * returns the list of violations (empty when the invariant holds), so the
 * property tests and the fuzzer report every failure with its context.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { TraceHeader } from '../../src/core/npm/ir';
import type { ExecState } from '../../src/core/npm/state';
import type { Tensor } from '../../src/core/tensor/tensor';
import { setStartingValue, trainableParams } from '../../src/experiments/architecture';
import {
  declaredControls,
  REQUIRED_CONTROLS,
  renderedControls,
  surfaceViolations,
} from '../../src/experiments/controls';
import { experimentById } from '../../src/experiments/registry';
import { startingGranularity } from '../../src/experiments/surface';
import { num } from '../../src/explain/format';
import { NOVICE_SCREENS } from '../../src/ui/App';
import { usePredictions } from '../../src/ui/novice/state';
import { provenanceWindow } from '../../src/ui/useProvenance';
import { Inspector } from '../../src/views/execution/Inspector';
import type { Focus } from '../../src/views/focus';
import { elementId, provenance } from '../../src/views/provenance';
import { startingValues } from '../../src/views/structure/ParamEditor';
import { currentSource, freshSource, lab, renderApp, traceHash } from './lab';

const noviceScreen = (): boolean => lab().mode === 'novice' && !!NOVICE_SCREENS[lab().experimentId];

// ---------------------------------------------------------------- A. declared surface

export function checkA(html = renderApp()): string[] {
  const s = lab();
  if (!s.header || s.generating) return [];
  const exp = experimentById(s.experimentId);
  const declared = declaredControls(exp, s.mode, s.config, noviceScreen());
  const out = surfaceViolations(declared, renderedControls(html));
  for (const r of REQUIRED_CONTROLS)
    if (!declared.always.includes(r)) out.push(`required control ${r} not declared`);
  return out.map((v) => `A ${s.experimentId}/${s.mode}: ${v}`);
}

// ---------------------------------------------------------------- B. parameter editability

/**
 * For every trainable parameter of the current model (or the `only` ones): the editor lists it, and editing
 * a starting value changes the trace's INIT_PARAM for exactly that parameter and element.
 */
export function checkB(only?: (names: string[]) => string[], html = renderApp()): string[] {
  const s = lab();
  const exp = experimentById(s.experimentId);
  if (!s.header || s.generating || !exp.surface.parameterEditor || noviceScreen()) return [];
  const out: string[] = [];
  const params = trainableParams(s.config).map((p) => p.name);
  const inTrace = s.header.model.params.map((p) => p.name);
  if (JSON.stringify(params) !== JSON.stringify(inTrace))
    out.push(`trace parameters ${inTrace.join(',')} differ from the configuration's ${params.join(',')}`);
  const src = currentSource();
  const starting = startingValues(src.range(0, inTrace.length) as never);
  for (const name of only ? only(params) : params) {
    if (!html.includes(`data-control="param:${name}"`))
      out.push(`${name} is not reachable in the parameter editor`);
    const values = starting[name];
    if (!values) {
      out.push(`${name} has no INIT_PARAM in the trace`);
      continue;
    }
    const idx = values.length - 1;
    const target = values[idx] + 0.25;
    const edited = setStartingValue(s.config, name, values, idx, target);
    const after = startingValues(
      freshSource(s.experimentId, { ...edited, epochs: 1 }).range(0, inTrace.length) as never,
    );
    if (after[name]?.[idx] !== target) out.push(`editing ${name}[${idx}] did not reach the trace`);
    for (const other of params)
      if (other !== name && JSON.stringify(after[other]) !== JSON.stringify(starting[other]))
        out.push(`editing ${name} changed ${other}`);
  }
  return out.map((v) => `B ${s.experimentId}: ${v}`);
}

// ---------------------------------------------------------------- C. selection binding

export function allFocuses(header: TraceHeader): Focus[] {
  const out: Focus[] = [];
  const layers = header.model.layers;
  const conv = layers.findIndex((l) => l.type === 'conv2d');
  if (conv >= 0) {
    const [F, H, W] = layers[conv].outShape;
    for (let k = 0; k < F * H * W; k++) out.push({ kind: 'unit', layer: layers[conv].name, index: k });
    return out;
  }
  for (let i = 0; i < header.model.inputShape[0]; i++) out.push({ kind: 'unit', layer: 'input', index: i });
  layers.forEach((l, k) => {
    const n = l.outShape[0];
    const nIn = k === 0 ? header.model.inputShape[0] : layers[k - 1].outShape[0];
    for (let j = 0; j < n; j++) {
      out.push({ kind: 'unit', layer: l.name, index: j });
      for (let i = 0; i < nIn; i++) out.push({ kind: 'edge', layer: l.name, i, j });
    }
  });
  return out;
}

const at = (t: Tensor | undefined, i: number): number | null =>
  t && i >= 0 && i < t.size ? t.data[i] : null;
const shown = (v: number | null): string => (v === null ? '—' : num(v));
const close = (a: number, b: number): boolean =>
  Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

/** The values the panel must show for an element, computed here from the state independently of the inspector. */
function expected(
  header: TraceHeader,
  exec: ExecState,
  f: Focus,
): { own: Record<string, number | null>; related: Record<string, Record<string, number | null>> } {
  const layers = header.model.layers;
  const s = exec.sample;
  if (f.kind === 'unit' && f.layer === 'input') return { own: { x: at(s?.x, f.index) }, related: {} };
  const li = layers.findIndex((l) => l.name === f.layer);
  const L = layers[li];
  const ls = s?.layers[f.layer] ?? {};
  if (f.kind === 'unit' && L.outShape.length === 3) {
    const [, H, W] = L.outShape;
    const c = Math.floor(f.index / (H * W));
    const K = exec.params[`${f.layer}.W`]?.value;
    const per = K ? K.size / K.shape[0] : 0;
    const kernel: Record<string, number | null> = {};
    for (let q = 0; q < per; q++) kernel[`k${q}`] = K!.data[c * per + q];
    return {
      own: { u: at(ls.u, f.index), z: at(ls.z, f.index), a: at(ls.a, f.index), gradZ: at(ls.gradZ, f.index) },
      related: {
        [`${f.layer}.b[${c + 1}]`]: { b: at(exec.params[`${f.layer}.b`]?.value, c) },
        [`${f.layer}.K[${c + 1}]`]: kernel,
      },
    };
  }
  const units = L.outShape[0];
  if (f.kind === 'unit') {
    const j = f.index;
    return {
      own: {
        u: at(ls.u, j),
        b: at(exec.params[`${f.layer}.b`]?.value, j),
        z: at(ls.z, j),
        a: at(ls.a, j),
        gradA: at(ls.gradA, j),
        gradZ: at(ls.gradZ, j),
        gradB: at(ls.gradB, j),
        batchGradB: at(exec.lastGrads[`${f.layer}.b`], j),
      },
      related: {},
    };
  }
  const k = f.i * units + f.j;
  const prev = li > 0 ? layers[li - 1].name : null;
  const a = at(prev ? s?.layers[prev]?.a : s?.x, f.i);
  const W = exec.params[`${f.layer}.W`]?.value;
  const u = exec.updates[`${f.layer}.W`];
  return {
    own: {
      w: at(W, k),
      contribution: a !== null && W ? a * W.data[k] : null,
      gradW: at(ls.gradW, k),
      batchGrad: at(exec.lastGrads[`${f.layer}.W`], k),
      velocity: at(u?.velocity, k),
      delta: at(u?.delta, k),
      before: at(u?.before, k),
      after: at(u?.after, k),
    },
    related: {
      [prev ? `${prev}.unit[${f.i + 1}]` : `x[${f.i + 1}]`]: { a },
      [`${f.layer}.unit[${f.j + 1}]`]: { gradZ: at(ls.gradZ, f.j) },
    },
  };
}

/** `render` replaces the inspector render (fault injection in tests); it receives the focus and its provenance. */
export function checkC(
  focuses?: Focus[],
  render?: (f: Focus, prov: ReturnType<typeof provenance>) => string,
): string[] {
  const s = lab();
  if (!s.header || !s.exec || s.generating) return [];
  const header = s.header;
  const exec = s.exec;
  const src = currentSource();
  const out: string[] = [];
  const layers = header.model.layers;
  for (const f of focuses ?? allFocuses(header)) {
    const id = elementId(header, f);
    const [from, to] = provenanceWindow(exec, f);
    const window = src.range(from, to);
    const prov = exec.cursor >= 0 ? provenance(header, exec, f, window) : { produced: [], consumed: [] };
    const html = render
      ? render(f, prov)
      : renderToStaticMarkup(
          createElement(Inspector, { header, exec, focus: f, onClear: () => undefined, provenance: prov }),
        );
    const where = `C ${s.experimentId} @${exec.cursor} ${id}`;
    if (
      !html.includes(`data-element="${id}"`) ||
      !/<h2>[^<]*<\/h2>/.test(html) ||
      !html.match(/<h2>([^<]*)<\/h2>/)![1].includes(id)
    )
      out.push(`${where}: panel does not identify the element`);
    const exp = expected(header, exec, f);
    const allowed = new Set([id, ...Object.keys(exp.related)]);
    const spans = [...html.matchAll(/data-of="([^"]+)" data-key="([^"]+)">([^<]*)</g)].map((m) => ({
      of: m[1],
      key: m[2],
      text: m[3],
    }));
    for (const sp of spans) {
      if (!allowed.has(sp.of)) {
        out.push(`${where}: shows a value of an unrelated element ${sp.of}`);
        continue;
      }
      const want = sp.of === id ? exp.own[sp.key] : exp.related[sp.of]?.[sp.key];
      if (want === undefined) out.push(`${where}: unexpected value ${sp.of}/${sp.key}`);
      else if (sp.text !== shown(want))
        out.push(`${where}: ${sp.of}/${sp.key} shows ${sp.text}, the trace has ${shown(want)}`);
    }
    for (const key of Object.keys(exp.own))
      if (!spans.some((sp) => sp.of === id && sp.key === key))
        out.push(`${where}: missing its own value ${key}`);
    // Cross-checks against the trace's data flow: the shown values are this element's, not a neighbour's.
    const li = layers.findIndex((l) => l.name === f.layer);
    if (f.kind === 'unit' && li >= 0 && layers[li].type === 'dense') {
      const u = exp.own.u;
      const W = exec.params[`${f.layer}.W`]?.value;
      const prev = li > 0 ? exec.sample?.layers[layers[li - 1].name]?.a : exec.sample?.x;
      // u is the weighted sum of the inputs with the weights that were current when it was computed.
      if (
        u !== null &&
        W &&
        prev &&
        exec.current?.path.sample !== null &&
        exec.current?.path.phase !== 'update'
      ) {
        let sum = 0;
        const n = layers[li].outShape[0];
        for (let i = 0; i < prev.size; i++) sum += prev.data[i] * W.data[i * n + f.index];
        if (!close(sum, u)) out.push(`${where}: u = ${u} is not Σ a·W = ${sum} for this neuron`);
      }
    }
    if (f.kind === 'edge') {
      const g = exp.own.gradW;
      const a = Object.values(exp.related)[0]?.a ?? null;
      const dz = Object.values(exp.related)[1]?.gradZ ?? null;
      if (g !== null && a !== null && dz !== null && !close(g, a * dz))
        out.push(`${where}: ∂ℓ/∂w = ${g} is not source a × target ∂ℓ/∂z = ${a * dz}`);
    }
    // Provenance: what the panel lists produced or consumed this element, according to the trace.
    const produced = new Set(prov.produced.map((r) => r.id));
    const listed = [...html.matchAll(/data-instruction="(\d+)"/g)].map((m) => Number(m[1]));
    for (const lid of listed)
      if (!produced.has(lid) && !prov.consumed.some((r) => r.id === lid))
        out.push(`${where}: lists instruction ${lid} not in its data flow`);
    for (const r of [...prov.produced, ...prov.consumed])
      if (r.id > exec.cursor) out.push(`${where}: lists a future instruction ${r.id}`);
    for (const r of prov.consumed) {
      const ins = window.find((x) => x.id === r.id)!;
      if (!ins.operands.some((o) => produced.has(o.ref)))
        out.push(`${where}: #${r.id} is listed as a consumer but reads none of its producers`);
    }
    if (f.kind === 'edge') {
      const version = exec.params[`${f.layer}.W`]?.producedBy;
      if (version !== undefined && exec.cursor >= 0 && !produced.has(version))
        out.push(`${where}: the weight's current version #${version} is not listed`);
    } else if (exec.cursor >= 0) {
      const values = Object.entries(exp.own).filter(
        ([k, v]) => v !== null && ['x', 'u', 'z', 'a'].includes(k),
      );
      for (const [k, v] of values) {
        const flat = f.index;
        const found = prov.produced.some((r) => {
          const ins = window.find((x) => x.id === r.id);
          return (
            ins && Object.values(ins.results).some((t) => flat < t.size && close(t.data[flat], v as number))
          );
        });
        if (!found) out.push(`${where}: no listed producer holds its value ${k} = ${v}`);
      }
    }
  }
  return out;
}

/** Cursor positions for C: early forward, mid backward, the update, and later in the run. */
export function interestingCursors(): number[] {
  const src = currentSource();
  const pick: number[] = [];
  const firstOf = (kind: string, from = 0): number => {
    for (let c = from; c < src.length; c++) if (src.get(c).kind === kind) return c;
    return -1;
  };
  const load = firstOf('LOAD_INPUT');
  pick.push(load + 2);
  const back = firstOf('GRAD_ACTIVATE', load);
  if (back >= 0) pick.push(back, back + 2);
  const upd = firstOf('APPLY_UPDATE', load);
  if (upd >= 0) pick.push(upd);
  pick.push(Math.floor(src.length / 2), src.length - 1);
  return [...new Set(pick.filter((c) => c >= 0 && c < src.length))];
}

// ---------------------------------------------------------------- D. reset

export async function checkD(initialHash: string): Promise<string[]> {
  await lab().resetExperiment();
  const s = lab();
  const exp = experimentById(s.experimentId);
  const out: string[] = [];
  if (s.error) out.push(`error after reset: ${s.error}`);
  if (JSON.stringify(s.config) !== JSON.stringify(exp.config))
    out.push('configuration is not the experiment’s own');
  if (s.config.seed !== exp.config.seed) out.push('seed differs');
  // Fix Round 3: typed example values, panel probes and open settings sections are part of the state.
  if (JSON.stringify(s.dataset) !== JSON.stringify(exp.dataset))
    out.push('the examples are not the experiment’s own');
  if (Object.keys(s.probes).length) out.push(`panel values survived the reset: ${Object.keys(s.probes)}`);
  if (Object.values(s.deeper).some(Boolean)) out.push('a Going-deeper section stayed open');
  if (s.cursor !== -1) out.push(`cursor is ${s.cursor}, not before the first instruction`);
  if (s.focus !== null) out.push('a selection survived the reset');
  if (s.granularity !== startingGranularity(exp, s.mode)) out.push(`step size is ${s.granularity}`);
  if (Object.keys(usePredictions.getState().records).some((k) => k.startsWith(`${exp.id}/`)))
    out.push('predictions survived the reset');
  if (traceHash(currentSource()) !== initialHash)
    out.push('the re-run trace hash differs from the initial run');
  return out.map((v) => `D ${s.experimentId}/${s.mode}: ${v}`);
}

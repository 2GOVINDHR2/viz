/**
 * View C — Network Structure View.
 *
 * Layer-level overview (type, shapes, parameter counts) from the trace header;
 * each layer expands to its internal computation, with the step the cursor is
 * on highlighted. Architectural edits produce a new configuration, which
 * regenerates the run and resets the cursor.
 */
import { useEffect, useState } from 'react';
import { MAX_INSTRUCTIONS, parseNumber } from '../../experiments/params';
import { ParamField } from '../../ui/components/ParamField';
import type { TrainConfig } from '../../core/engine/session';
import type { TraceHeader } from '../../core/npm/ir';
import type { Activation, LayerConfig } from '../../core/layers/model';
import {
  MAX_HIDDEN,
  MAX_WIDTH,
  addHiddenLayer,
  removeHiddenLayer,
  setHiddenActivation,
  setHiddenWidth,
} from '../../experiments/architecture';
import type { ExecState } from '../../core/npm/state';
import { KernelGrid } from '../execution/ConvView';

const shape = (s: number[]): string => s.join('×');
const ACTS: Activation[] = ['relu', 'tanh', 'sigmoid', 'linear'];

/** The internal steps of a layer, keyed by the instruction kinds that perform them. */
function steps(
  type: string,
  activation: string | null,
  inShape: number[],
  outShape: number[],
  params: { name: string; shape: number[] }[],
): { kind: string[]; text: string }[] {
  const W = params.find((p) => p.name.endsWith('.W'));
  switch (type) {
    case 'dense':
      return [
        {
          kind: ['MATMUL', 'GRAD_MATMUL_W', 'GRAD_MATMUL_X'],
          text: `u = a·W   [${shape(inShape)}] · [${shape(W?.shape ?? [])}] → [${shape(outShape)}]`,
        },
        { kind: ['ADD_BIAS', 'GRAD_BIAS'], text: `z = u + b   b: [${outShape[0]}]` },
        { kind: ['ACTIVATE', 'GRAD_ACTIVATE'], text: `a = ${activation}(z)   → [${shape(outShape)}]` },
      ];
    case 'conv2d':
      return [
        {
          kind: ['CONV2D', 'GRAD_CONV2D'],
          text: `u = a ⋆ K   [${shape(inShape)}] ⋆ [${shape(W?.shape ?? [])}] → [${shape(outShape)}]`,
        },
        { kind: ['ADD_BIAS', 'GRAD_BIAS'], text: `z = u + b   one bias per channel` },
        { kind: ['ACTIVATE', 'GRAD_ACTIVATE'], text: `a = ${activation}(z)` },
      ];
    case 'pool':
      return [
        {
          kind: ['POOL', 'GRAD_POOL'],
          text: `pool each channel   [${shape(inShape)}] → [${shape(outShape)}]`,
        },
      ];
    case 'flatten':
      return [
        { kind: ['FLATTEN', 'GRAD_FLATTEN'], text: `vec   [${shape(inShape)}] → [${shape(outShape)}]` },
      ];
    default:
      return [{ kind: [], text: `${type}   [${shape(inShape)}] → [${shape(outShape)}]` }];
  }
}

export interface StructureViewProps {
  header: TraceHeader;
  exec: ExecState | null;
  config: TrainConfig;
  defaults: TrainConfig;
  busy: boolean;
  onReconfigure(c: TrainConfig): void;
  /** The layer editor renders only where the experiment declares it (Fix Round 2, §3.3). */
  allowEdit?: boolean;
}

export function StructureView({
  header,
  exec,
  config,
  defaults,
  busy,
  onReconfigure,
  allowEdit = true,
}: StructureViewProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<TrainConfig | null>(null);
  const cfg = draft ?? config;
  const activeLayer = exec?.current?.path.layer ?? null;
  const activeKind = exec?.current?.kind ?? '';
  const total = header.model.params.reduce((a, p) => a + p.shape.reduce((x, y) => x * y, 1), 0);
  const editable = allowEdit && cfg.model.layers.every((l) => l.type === 'dense');
  const hidden = cfg.model.layers.slice(0, -1) as Extract<LayerConfig, { type: 'dense' }>[];
  // Every mutation goes through src/experiments/architecture.ts, which keeps starting values consistent.
  const edit = (next: TrainConfig): void => setDraft(next);
  const changed = draft !== null && JSON.stringify(draft) !== JSON.stringify(config);

  return (
    <section className="panel structure" aria-label="Network structure view">
      <h2>Network structure</h2>
      <p className="small muted">
        {header.model.layers.length} layers · {total.toLocaleString('en')} parameters · input [
        {shape(header.model.inputShape)}]
      </p>
      <ol className="layers">
        {header.model.layers.map((l) => {
          const isOpen = open[l.name] ?? false;
          const params = header.model.params.filter((p) => p.layer === l.name);
          const count = params.reduce((a, p) => a + p.shape.reduce((x, y) => x * y, 1), 0);
          const active = l.name === activeLayer;
          return (
            <li key={l.name} className={`layer-card${active ? ' active' : ''}`}>
              <button
                data-control="structure:expand"
                className="layer-head"
                aria-expanded={isOpen}
                aria-controls={`steps-${l.name}`}
                onClick={() => setOpen({ ...open, [l.name]: !isOpen })}
              >
                <span className="layer-name">{l.name}</span>
                <span className="layer-type">
                  {l.type}
                  {l.activation ? ` · ${l.activation}` : ''}
                </span>
                <span className="layer-shape">→ [{shape(l.outShape)}]</span>
                <span className="layer-params">{count ? `${count} params` : 'no params'}</span>
                <span aria-hidden="true" className="chev">
                  {isOpen ? '▾' : '▸'}
                </span>
              </button>
              <div id={`steps-${l.name}`} className={`layer-steps${isOpen ? ' open' : ''}`} hidden={!isOpen}>
                <ol>
                  {steps(l.type, l.activation, l.inShape, l.outShape, params).map((st) => (
                    <li key={st.text} className={active && st.kind.includes(activeKind) ? 'now' : undefined}>
                      <code>{st.text}</code>
                      {active && st.kind.includes(activeKind) && <span className="now-tag"> ← now</span>}
                    </li>
                  ))}
                </ol>
                {params.length > 0 && (
                  <p className="small muted">
                    {params.map((p) => `${p.name} [${shape(p.shape)}]`).join(' · ')}
                  </p>
                )}
                {l.type === 'conv2d' && exec?.params[`${l.name}.W`] && (
                  <div className="kernels" aria-label={`Current kernels of ${l.name}`}>
                    {Array.from({ length: l.outShape[0] }, (_, q) => (
                      <KernelGrid key={q} k={exec.params[`${l.name}.W`].value} f={q} />
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {editable && (
        <fieldset className="edit" disabled={busy}>
          <legend>Change the network (restarts training)</legend>
          {hidden.map((l, k) => (
            <div key={k} className="edit-row">
              <span>Hidden {k + 1}</span>
              <WidthField layer={k} units={l.units} onValid={(u) => edit(setHiddenWidth(cfg, k, u))} />
              <label>
                <span className="sr-only">Activation of hidden layer {k + 1}</span>
                <select
                  value={l.activation}
                  data-control="arch:activation"
                  onChange={(e) => edit(setHiddenActivation(cfg, k, e.target.value as Activation))}
                >
                  {ACTS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <button
                className="link"
                data-control="arch:remove"
                onClick={() => edit(removeHiddenLayer(cfg, k))}
                aria-label={`Remove hidden layer ${k + 1}`}
              >
                remove
              </button>
            </div>
          ))}
          <button
            className="link"
            disabled={hidden.length >= MAX_HIDDEN}
            data-control="arch:add"
            onClick={() => edit(addHiddenLayer(cfg))}
          >
            + add hidden layer
          </button>
          <div className="edit-row">
            {/* Typed exact entry (Fix Round 3, A3); the former choices remain as suggestions. */}
            <ParamField
              param={{ kind: 'learningRate', options: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 20] }}
              control="arch:lr"
              label="Learning rate"
              value={cfg.optimizer.lr}
              validate={(raw) => {
                const v = parseNumber(raw);
                return v === null
                  ? { ok: false, message: 'Enter a number, such as 0.3 or 1e-3 (any size is allowed).' }
                  : { ok: true, value: v };
              }}
              onApply={(v) => setDraft({ ...cfg, optimizer: { ...cfg.optimizer, lr: Number(v) } })}
            />
            <ParamField
              param={{ kind: 'epochs', options: [10, 30, 60, 150, 300] }}
              control="arch:epochs"
              label="Epochs"
              value={cfg.epochs}
              validate={(raw) => {
                const v = parseNumber(raw);
                // The same instruction budget as the "Try it" field (ADR-057), from the current run's epoch size.
                const max = Math.max(
                  1,
                  Math.floor(MAX_INSTRUCTIONS / Math.max(1, header.length / config.epochs)),
                );
                return v === null || !Number.isInteger(v) || v < 1 || v > max
                  ? {
                      ok: false,
                      message: `Enter a whole number from 1 to ${max} (longer runs would not fit in a browser session).`,
                    }
                  : { ok: true, value: v };
              }}
              onApply={(v) => setDraft({ ...cfg, epochs: Number(v) })}
            />
          </div>
          <div className="edit-row">
            <button
              className="primary-sm"
              data-control="arch:apply"
              disabled={!changed}
              onClick={() => draft && (onReconfigure(draft), setDraft(null))}
            >
              Apply and restart
            </button>
            <button
              className="link"
              data-control="arch:restore"
              disabled={JSON.stringify(config) === JSON.stringify(defaults) && !draft}
              onClick={() => (setDraft(null), onReconfigure(defaults))}
            >
              restore defaults
            </button>
          </div>
          <p className="small muted">Output layer and loss stay fixed so they remain correctly paired.</p>
        </fieldset>
      )}
    </section>
  );
}

/**
 * A hidden layer's width, typed. An entry outside 1–MAX_WIDTH is shown with a message and not applied: it is
 * never silently clamped (Fix Round 3, A3).
 */
function WidthField({ layer, units, onValid }: { layer: number; units: number; onValid(u: number): void }) {
  const [text, setText] = useState(String(units));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setText(String(units)), [units]);
  const errId = `width-error-${layer}`;
  const commit = (raw: string): void => {
    setText(raw);
    const v = parseNumber(raw);
    if (v === null || !Number.isInteger(v) || v < 1 || v > MAX_WIDTH) {
      setError(`Enter a whole number of units from 1 to ${MAX_WIDTH}.`);
      return;
    }
    setError(null);
    onValid(v);
  };
  return (
    <label>
      <span className="sr-only">Width of hidden layer {layer + 1}</span>
      <input
        type="text"
        inputMode="numeric"
        className="param-number"
        value={text}
        data-control="arch:width"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errId : undefined}
        onChange={(e) => commit(e.target.value)}
      />
      {error && (
        <span className="param-error" id={errId} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

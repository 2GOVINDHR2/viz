/**
 * Starting weights and biases (Fix Round 2b, defect 1). Lists every trainable
 * parameter of the *current* model — including the parameters of a layer the
 * learner has just added — with its starting values as the trace recorded
 * them (INIT_PARAM). Editing a value regenerates the run with it; the other
 * parameters keep their seeded values. Values are shown and edited only for
 * the parameter the learner opens, so large layers cost nothing until asked for.
 */
import { useEffect, useState } from 'react';
import type { TrainConfig } from '../../core/engine/session';
import type { TraceHeader } from '../../core/npm/ir';
import { setStartingValue } from '../../experiments/architecture';
import { num } from '../../explain/format';

/** Starting values of every parameter, from the trace's INIT_PARAM instructions (ids 0 … P−1). */
export function startingValues(
  instructions: {
    kind: string;
    meta: Record<string, unknown>;
    results: Record<string, { data: ArrayLike<number> }>;
  }[],
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const ins of instructions)
    if (ins.kind === 'INIT_PARAM') out[String(ins.meta.param)] = Array.from(ins.results.value.data);
  return out;
}

const describe = (header: TraceHeader, name: string): string => {
  const p = header.model.params.find((x) => x.name === name)!;
  const k = header.model.layers.findIndex((l) => l.name === p.layer);
  const last = k === header.model.layers.length - 1;
  const where = last ? 'the output layer' : `hidden layer ${k + 1}`;
  return `${p.role === 'bias' || name.endsWith('.b') ? 'biases of' : 'weights into'} ${where}`;
};

export function ParamEditor({
  header,
  config,
  starting,
  busy,
  onApply,
}: {
  header: TraceHeader;
  config: TrainConfig;
  /** Starting values per parameter, from the current trace; null while loading. */
  starting: Record<string, number[]> | null;
  busy: boolean;
  onApply(c: TrainConfig): void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  return (
    <section className="panel params" aria-label="Starting weights and biases" data-control="params">
      <h2>Starting weights and biases</h2>
      <p className="small muted">
        Every parameter of the current network. Change a starting value and the run restarts from it; the
        others keep their values.
      </p>
      {header.model.params.map((p) => {
        const values = starting?.[p.name];
        const cols = p.shape.length > 1 ? p.shape[p.shape.length - 1] : p.shape[0];
        const isOpen = open[p.name] ?? false;
        return (
          <div key={p.name} className="param-block">
            <button
              className="layer-head"
              aria-expanded={isOpen}
              data-control={`param:${p.name}`}
              onClick={() => setOpen({ ...open, [p.name]: !isOpen })}
            >
              <span className="layer-name">{p.name}</span>
              <span className="layer-type">{describe(header, p.name)}</span>
              <span className="layer-shape">[{p.shape.join('×')}]</span>
              <span aria-hidden="true" className="chev">
                {isOpen ? '▾' : '▸'}
              </span>
            </button>
            {isOpen && (
              <div
                className="param-grid"
                style={{ gridTemplateColumns: `repeat(${Math.min(cols, 8)}, minmax(56px, 1fr))` }}
              >
                {values ? (
                  values.map((v, k) => (
                    <StartingValue
                      key={`${p.name}-${k}-${v}`}
                      label={`${p.name}${p.shape.length > 1 ? `[${Math.floor(k / cols) + 1},${(k % cols) + 1}]` : `[${k + 1}]`}`}
                      value={v}
                      disabled={busy}
                      onCommit={(x) => onApply(setStartingValue(config, p.name, values, k, x))}
                    />
                  ))
                ) : (
                  <p className="small muted" aria-busy="true">
                    Reading the starting values…
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function StartingValue({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit(v: number): void;
}) {
  const [text, setText] = useState(num(value));
  useEffect(() => setText(num(value)), [value]);
  const commit = (): void => {
    // Only a value the learner actually changed is committed (the shown text is rounded).
    if (text === num(value)) return;
    const x = Number(text.replace('−', '-'));
    if (Number.isFinite(x)) onCommit(x);
    else setText(num(value));
  };
  return (
    <label className="param-cell">
      <span className="sr-only">{label} starting value</span>
      <input
        type="text"
        inputMode="decimal"
        value={text}
        disabled={disabled}
        aria-label={`${label} starting value`}
        data-control="param-value"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    </label>
  );
}

/**
 * Detail panel for the selected neuron or weight: every number the trace holds
 * about it at the cursor, plus the computation it contributes to.
 */
import type { ReactNode } from 'react';
import type { TraceHeader } from '../../core/npm/ir';
import type { ExecState } from '../../core/npm/state';
import type { Tensor } from '../../core/tensor/tensor';
import { num } from '../../explain/format';
import type { Focus } from '../focus';

const v = (t: Tensor | undefined, i: number): string => (t && i < t.size ? num(t.data[i]) : '—');

function Row({ k, val, hint }: { k: string; val: string; hint?: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd>
        <span className="num">{val}</span>
        {hint && <span className="hint"> {hint}</span>}
      </dd>
    </>
  );
}

export function Inspector({
  header,
  exec,
  focus,
  onClear,
}: {
  header: TraceHeader;
  exec: ExecState | null;
  focus: Focus | null;
  onClear(): void;
}) {
  if (!focus) {
    return (
      <section className="panel inspector" aria-label="Inspector">
        <h2>Inspector</h2>
        <p className="muted">Click a neuron or a weight in the network to see every number behind it.</p>
      </section>
    );
  }
  const layers = header.model.layers;
  const li = layers.findIndex((l) => l.name === focus.layer);
  const prevName = li > 0 ? layers[li - 1].name : null;
  const s = exec?.sample;
  const prevA = (): Tensor | undefined => (prevName ? s?.layers[prevName]?.a : s?.x);
  let title: string;
  let body: ReactNode;

  if (focus.kind === 'unit' && focus.layer === 'input') {
    title = `Input ${focus.index + 1}`;
    body = (
      <dl>
        <Row k="x" val={v(s?.x, focus.index)} hint="feature of the current example" />
      </dl>
    );
  } else if (focus.kind === 'unit') {
    const j = focus.index;
    const ls = s?.layers[focus.layer] ?? {};
    const W = exec?.params[`${focus.layer}.W`]?.value;
    const b = exec?.params[`${focus.layer}.b`]?.value;
    const a = prevA();
    const units = layers[li].outShape[0];
    const terms =
      a && W
        ? Array.from({ length: a.size }, (_, i) => `${num(a.data[i])}·${num(W.data[i * units + j])}`)
        : [];
    title = `Layer ${focus.layer.slice(1)}, neuron ${j + 1} (${layers[li].activation})`;
    body = (
      <>
        <dl>
          <Row k="u = Σ a·W" val={v(ls.u, j)} />
          <Row k="bias b" val={v(b, j)} />
          <Row k="z = u + b" val={v(ls.z, j)} />
          <Row k="a = f(z)" val={v(ls.a, j)} />
          <Row k="∂ℓ/∂a" val={v(ls.gradA, j)} />
          <Row k="∂ℓ/∂z" val={v(ls.gradZ, j)} hint="error signal" />
          <Row k="∂ℓ/∂b" val={v(ls.gradB, j)} />
          <Row k="batch ḡ(b)" val={v(exec?.lastGrads[`${focus.layer}.b`], j)} />
        </dl>
        {terms.length > 0 && (
          <p className="computation">
            <strong>Computation:</strong> z = {terms.join(' + ')} + {v(b, j)} = {v(ls.z, j)}
          </p>
        )}
      </>
    );
  } else {
    const { i, j } = focus;
    const units = layers[li].outShape[0];
    const k = i * units + j;
    const name = `${focus.layer}.W`;
    const W = exec?.params[name]?.value;
    const ls = s?.layers[focus.layer] ?? {};
    const a = prevA();
    const u = exec?.updates[name];
    title = `Weight W${focus.layer.slice(1)}[${i + 1},${j + 1}]`;
    body = (
      <>
        <dl>
          <Row k="value" val={v(W, k)} />
          <Row
            k="input aᵢ"
            val={v(a, i)}
            hint={`from ${prevName ? `layer ${prevName.slice(1)}` : 'the input'}, unit ${i + 1}`}
          />
          <Row
            k="contribution aᵢ·W"
            val={a && W ? num(a.data[i] * W.data[k]) : '—'}
            hint={`to u of neuron ${j + 1}`}
          />
          <Row k="∂ℓ/∂W (this example)" val={v(ls.gradW, k)} hint="= aᵢ · ∂ℓ/∂zⱼ" />
          <Row k="batch ḡ" val={v(exec?.lastGrads[name], k)} />
          <Row k="velocity v" val={v(u?.velocity, k)} />
          <Row k="step Δ" val={v(u?.delta, k)} />
          <Row k="before → after" val={u?.before && u.after ? `${v(u.before, k)} → ${v(u.after, k)}` : '—'} />
        </dl>
      </>
    );
  }
  return (
    <section className="panel inspector" aria-label="Inspector">
      <div className="panel-head">
        <h2>{title}</h2>
        <button className="link" onClick={onClear}>
          Clear
        </button>
      </div>
      {body}
      <p className="muted small">
        Values are for the example and batch at the current position; “—” means not computed yet at this
        point.
      </p>
    </section>
  );
}

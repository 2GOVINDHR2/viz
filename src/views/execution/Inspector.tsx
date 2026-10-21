/**
 * Detail panel for the selected neuron, weight or feature-map cell (Fix Round
 * 2b, defect 2). Everything in it is bound to the selection:
 *  - the element's identifier;
 *  - its own values at the cursor, read from the trace state, each marked
 *    `data-of="<identifier>"`;
 *  - the elements it is connected to, listed separately under their own
 *    identifiers (a weight's source and target neuron, a cell's kernel and bias);
 *  - the instructions that produced and consumed it, from the trace's data flow
 *    (src/views/provenance.ts), and whether the current instruction is one of them.
 */
import type { TraceHeader } from '../../core/npm/ir';
import type { ExecState } from '../../core/npm/state';
import type { Tensor } from '../../core/tensor/tensor';
import { num } from '../../explain/format';
import type { Focus } from '../focus';
import { elementId, type Provenance } from '../provenance';

export interface InspectorValue {
  /** Identifier of the element the value belongs to. */
  of: string;
  key: string;
  label: string;
  value: number | null;
  hint?: string;
}

const at = (t: Tensor | undefined, i: number): number | null =>
  t && i >= 0 && i < t.size ? t.data[i] : null;

/** The selected element's values and its neighbours' values, from the state alone. Exported for tests. */
export function inspectorValues(
  header: TraceHeader,
  exec: ExecState | null,
  focus: Focus,
): { title: string; id: string; own: InspectorValue[]; related: InspectorValue[] } {
  const id = elementId(header, focus);
  const layers = header.model.layers;
  const li = layers.findIndex((l) => l.name === focus.layer);
  const s = exec?.sample;
  const prevName = li > 0 ? layers[li - 1].name : null;
  const prevA = prevName ? s?.layers[prevName]?.a : s?.x;
  const own = (key: string, label: string, value: number | null, hint?: string): InspectorValue => ({
    of: id,
    key,
    label,
    value,
    hint,
  });

  if (focus.kind === 'unit' && focus.layer === 'input')
    return {
      title: `Input ${focus.index + 1} (${id})`,
      id,
      own: [own('x', 'value x', at(s?.x, focus.index), 'feature of the current example')],
      related: [],
    };

  const L = layers[li];
  const ls = s?.layers[focus.layer] ?? {};
  if (focus.kind === 'unit' && L.outShape.length === 3) {
    // A feature-map cell of a convolution (or pooling) layer.
    const [, H, W] = L.outShape;
    const c = Math.floor(focus.index / (H * W));
    const kId = `${focus.layer}.K[${c + 1}]`;
    const bId = `${focus.layer}.b[${c + 1}]`;
    const K = exec?.params[`${focus.layer}.W`]?.value;
    const per = K ? K.size / K.shape[0] : 0;
    return {
      title: `${L.type === 'conv2d' ? 'Feature map' : 'Map'} ${c + 1} of layer ${focus.layer.slice(1)}, cell (${Math.floor((focus.index % (H * W)) / W) + 1}, ${(focus.index % W) + 1}) — ${id}`,
      id,
      own: [
        own('u', 'u = window · kernel', at(ls.u, focus.index)),
        own('z', 'z = u + b', at(ls.z, focus.index)),
        own('a', `a = ${L.activation ?? 'output'}(z)`, at(ls.a, focus.index)),
        own('gradZ', '∂ℓ/∂z (error signal)', at(ls.gradZ, focus.index)),
      ],
      related: [
        {
          of: bId,
          key: 'b',
          label: `bias of map ${c + 1}`,
          value: at(exec?.params[`${focus.layer}.b`]?.value, c),
        },
        ...(K
          ? Array.from({ length: per }, (_, q) => ({
              of: kId,
              key: `k${q}`,
              label: `kernel ${c + 1}, weight ${q + 1}`,
              value: K.data[c * per + q],
            }))
          : []),
      ],
    };
  }

  const units = L.outShape[0];
  if (focus.kind === 'unit') {
    const j = focus.index;
    return {
      title: `Layer ${focus.layer.slice(1)}, neuron ${j + 1} (${L.activation}) — ${id}`,
      id,
      own: [
        own('u', 'u = Σ a·W', at(ls.u, j)),
        own('b', 'its bias b', at(exec?.params[`${focus.layer}.b`]?.value, j)),
        own('z', 'z = u + b', at(ls.z, j)),
        own('a', 'a = f(z)', at(ls.a, j)),
        own('gradA', '∂ℓ/∂a', at(ls.gradA, j)),
        own('gradZ', '∂ℓ/∂z (error signal)', at(ls.gradZ, j)),
        own('gradB', '∂ℓ/∂b (this example)', at(ls.gradB, j)),
        own('batchGradB', 'batch-mean ∂ℓ/∂b', at(exec?.lastGrads[`${focus.layer}.b`], j)),
      ],
      related: [],
    };
  }

  const { i, j } = focus;
  const k = i * units + j;
  const name = `${focus.layer}.W`;
  const u = exec?.updates[name];
  const src = prevName ? `${prevName}.unit[${i + 1}]` : `x[${i + 1}]`;
  const dst = `${focus.layer}.unit[${j + 1}]`;
  const W = exec?.params[name]?.value;
  const a = at(prevA, i);
  return {
    title: `Weight W${focus.layer.slice(1)}[${i + 1},${j + 1}] — ${id}, from ${prevName ? `layer ${prevName.slice(1)} neuron` : 'input'} ${i + 1} to layer ${focus.layer.slice(1)} neuron ${j + 1}`,
    id,
    own: [
      own('w', 'value', at(W, k)),
      own('contribution', 'contribution a·w to its target', a !== null && W ? a * W.data[k] : null),
      own('gradW', '∂ℓ/∂w (this example)', at(ls.gradW, k), '= source a × target ∂ℓ/∂z'),
      own('batchGrad', 'batch-mean ∂ℓ/∂w', at(exec?.lastGrads[name], k)),
      own('velocity', 'velocity', at(u?.velocity, k)),
      own('delta', 'step Δ', at(u?.delta, k)),
      own('before', 'before the update', at(u?.before, k)),
      own('after', 'after the update', at(u?.after, k)),
    ],
    related: [
      { of: src, key: 'a', label: `source ${src}: a`, value: a },
      { of: dst, key: 'gradZ', label: `target ${dst}: ∂ℓ/∂z`, value: at(ls.gradZ, j) },
    ],
  };
}

function Value({ v }: { v: InspectorValue }) {
  return (
    <>
      <dt>{v.label}</dt>
      <dd>
        <span className="num" data-of={v.of} data-key={v.key}>
          {v.value === null ? '—' : num(v.value)}
        </span>
        {v.hint && <span className="hint"> {v.hint}</span>}
      </dd>
    </>
  );
}

const MAX_LISTED = 8;

function Refs({ label, refs }: { label: string; refs: { id: number; kind: string }[] }) {
  return (
    <p className="small">
      <strong>{label}:</strong>{' '}
      {refs.length === 0
        ? 'none so far'
        : refs.slice(0, MAX_LISTED).map((r, n) => (
            <span key={r.id}>
              {n > 0 && ', '}
              <code data-instruction={r.id}>
                #{r.id + 1} {r.kind}
              </code>
            </span>
          ))}
      {refs.length > MAX_LISTED && ` and ${refs.length - MAX_LISTED} more`}
    </p>
  );
}

export function Inspector({
  header,
  exec,
  focus,
  onClear,
  provenance,
}: {
  header: TraceHeader;
  exec: ExecState | null;
  focus: Focus | null;
  onClear(): void;
  /** Producing and consuming instructions of the selection; undefined while they are being read. */
  provenance?: Provenance | null;
}) {
  if (!focus) {
    return (
      <section className="panel inspector" aria-label="Inspector">
        <h2>Inspector</h2>
        <p className="muted">Click a neuron or a weight in the network to see every number behind it.</p>
      </section>
    );
  }
  const d = inspectorValues(header, exec, focus);
  const cur = exec?.current ?? null;
  const role =
    !cur || !provenance
      ? null
      : provenance.produced.some((r) => r.id === cur.id)
        ? 'computes'
        : provenance.consumed.some((r) => r.id === cur.id)
          ? 'uses'
          : 'does not involve';
  return (
    <section className="panel inspector" aria-label="Inspector" data-element={d.id}>
      <div className="panel-head">
        <h2>{d.title}</h2>
        <button className="link" onClick={onClear} data-control="inspector:clear">
          Clear
        </button>
      </div>
      {cur && role && (
        <p className="small" role="status">
          The current instruction (#{cur.id + 1} {cur.kind}) <strong>{role}</strong> {d.id}.
        </p>
      )}
      <dl>
        {d.own.map((v) => (
          <Value key={v.key} v={v} />
        ))}
      </dl>
      {d.related.length > 0 && (
        <>
          <h3>Connected elements</h3>
          <dl className="related">
            {d.related.map((v) => (
              <Value key={`${v.of}-${v.key}`} v={v} />
            ))}
          </dl>
        </>
      )}
      <h3>In the trace</h3>
      {provenance ? (
        <>
          <Refs label="Produced by" refs={provenance.produced} />
          <Refs label="Used by" refs={provenance.consumed} />
        </>
      ) : (
        <p className="small muted">Reading the instructions…</p>
      )}
      <p className="muted small">
        Values are for the example and batch at the current position; “—” means not computed yet at this
        point.
      </p>
    </section>
  );
}

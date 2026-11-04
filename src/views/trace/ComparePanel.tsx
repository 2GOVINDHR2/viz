/**
 * Pin a point and compare against it (Fix Round 4, D4; ADR-066). The learner pins instruction A, moves to B, and
 * the panel states what differs: every parameter's changed elements and largest change, and every layer's
 * activations. Expert mode, where the experiment declares the trace view.
 */
import type { TraceHeader } from '../../core/npm/ir';
import type { ExecState } from '../../core/npm/state';
import { num } from '../../explain/format';
import { kindMeaning, layerTitle, paramTitle } from '../../explain/names';
import { compareStates } from './compare';

const capital = (t: string): string => t.charAt(0).toUpperCase() + t.slice(1);
const MAX_LISTED = 8;

export function ComparePanel({
  header,
  exec,
  pinned,
  onPin,
  onUnpin,
  onJump,
}: {
  header: TraceHeader;
  exec: ExecState | null;
  pinned: ExecState | null;
  onPin(): void;
  onUnpin(): void;
  onJump(id: number): void;
}) {
  const where = (e: ExecState | null): string =>
    e?.current
      ? `#${e.cursor + 1}, ${kindMeaning(e.current.kind).replace(/\.$/, '').toLowerCase()}`
      : 'before the first instruction';
  const c = pinned && exec && pinned.cursor !== exec.cursor ? compareStates(header, pinned, exec) : null;
  return (
    <section className="panel compare" aria-label="Compare two points">
      <div className="panel-head">
        <h2>Compare two points of the run</h2>
        <span className="compare-actions">
          <button type="button" data-control="compare:pin" disabled={!exec} onClick={onPin}>
            {pinned ? 'Pin this point instead' : 'Pin this point as A'}
          </button>
          {pinned && (
            <>
              <button
                type="button"
                className="link"
                data-control="compare:jump"
                onClick={() => onJump(pinned.cursor)}
              >
                Go back to A
              </button>
              <button type="button" className="link" data-control="compare:clear" onClick={onUnpin}>
                Unpin
              </button>
            </>
          )}
        </span>
      </div>
      {!pinned ? (
        <p className="small muted">
          Pin an instruction, move anywhere else in the run, and see what is different between the two points.
        </p>
      ) : !c ? (
        <p className="small muted" data-compare="same">
          A is instruction {where(pinned)}. Move to another instruction to compare.
        </p>
      ) : (
        <div data-compare={`${c.from}:${c.to}`}>
          <p className="small">
            <strong>A</strong> = instruction {where(pinned)}; <strong>B</strong> = the current instruction,{' '}
            {where(exec)}.{' '}
            {c.to > c.from
              ? `B is ${c.to - c.from} instructions later.`
              : `B is ${c.from - c.to} instructions earlier.`}
          </p>
          <h3>Parameters</h3>
          <table className="outputs compare-params">
            <thead>
              <tr>
                <th scope="col">Parameter</th>
                <th scope="col">Elements changed</th>
                <th scope="col">Largest change (element: A → B)</th>
              </tr>
            </thead>
            <tbody>
              {c.params.map((p) => (
                <tr key={p.name} data-param={p.name} data-changed={p.changed}>
                  <th scope="row">
                    {capital(paramTitle(header, p.name))} <code className="ident">{p.name}</code>
                  </th>
                  <td>
                    {p.changed} of {p.elements}
                  </td>
                  <td>
                    {p.largest
                      ? `${p.largest.index + 1}: ${num(p.largest.a)} → ${num(p.largest.b)} (${p.largest.b - p.largest.a >= 0 ? '+' : ''}${num(p.largest.b - p.largest.a)})`
                      : 'unchanged'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Activations</h3>
          <p className="small">
            {c.exampleA === null && c.exampleB === null
              ? 'Neither point is inside an example, so there are no activations to compare.'
              : c.exampleA === c.exampleB
                ? `Both points are on training example ${(c.exampleA ?? 0) + 1}.`
                : `A is on ${c.exampleA === null ? 'no example' : `training example ${c.exampleA + 1}`}; B is on ${c.exampleB === null ? 'no example' : `training example ${c.exampleB + 1}`}.`}
          </p>
          <ul className="compare-layers">
            {c.layers.map((l) => (
              <li key={l.layer} data-layer={l.layer} data-changed={l.changed}>
                <strong>{capital(layerTitle(header, l.layer))}</strong>{' '}
                <code className="ident">{l.layer}</code>:{' '}
                {!l.a || !l.b
                  ? `not computed at ${!l.a && !l.b ? 'either point' : !l.a ? 'A' : 'B'}`
                  : l.changed === 0
                    ? 'the same at both points'
                    : `${l.changed} of ${l.b.length} differ${l.b.length <= MAX_LISTED ? `: ${l.a.map((v, k) => `${num(v)} → ${num(l.b![k])}`).join(', ')}` : ''}`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

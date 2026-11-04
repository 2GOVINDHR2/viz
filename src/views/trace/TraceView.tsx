/**
 * The trace itself (Fix Round 4, D1–D2; ADR-065): every instruction of the run, in order, one row each.
 *  - **Row:** identifier, plain-language meaning (NPM-SPEC §4.1, ADR-062), layer and phase. The cursor's row is
 *    marked (`aria-current`) and kept in view. A click jumps there.
 *  - **Filter:** by instruction kind, layer, phase or epoch; the numeric search finds the first gradient below
 *    (or above) a magnitude (src/views/trace/query.ts).
 *
 * The list is virtual: a row's position is known from its id alone, so it renders at once, and only the rows in
 * view are drawn. Their content is read from the trace in the engine worker with `range` requests (no engine
 * change).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Instruction, Phase, TraceHeader } from '../../core/npm/ir';
import { kindMeaning, layerTitle } from '../../explain/names';
import { engineRequest } from '../../ui/store';
import { filterTrace, firstGradient, type TraceFilter } from './query';

const ROW = 24;
const VISIBLE = 12;
const CHUNK = 1000;

/** Every instruction of the run, read in chunks; null while loading. Kept per header, so a revisit is instant. */
const cache = new WeakMap<TraceHeader, Instruction[]>();
export function useWholeTrace(header: TraceHeader | null): Instruction[] | null {
  const [v, setV] = useState<Instruction[] | null>(header ? (cache.get(header) ?? null) : null);
  useEffect(() => {
    if (!header) return setV(null);
    const hit = cache.get(header);
    if (hit) return setV(hit);
    setV(null);
    let live = true;
    void (async () => {
      const out: Instruction[] = [];
      for (let from = 0; from < header.length && live; from += CHUNK)
        out.push(
          ...(await engineRequest<'range'>({ op: 'range', from, to: Math.min(header.length, from + CHUNK) }))
            .instructions,
        );
      if (!live) return;
      cache.set(header, out);
      setV(out);
    })();
    return () => {
      live = false;
    };
  }, [header]);
  return v;
}

const PHASES: Phase[] = ['init', 'forward', 'loss', 'backward', 'update', 'eval', 'control'];

export function TraceView({
  header,
  cursor,
  onJump,
}: {
  header: TraceHeader;
  cursor: number;
  onJump(id: number): void;
}) {
  const all = useWholeTrace(header);
  const [filter, setFilter] = useState<TraceFilter>({});
  const [threshold, setThreshold] = useState('1e-3');
  const [when, setWhen] = useState<'below' | 'above'>('below');
  const [notFound, setNotFound] = useState<string | null>(null);
  const filtering = Object.values(filter).some((v) => v !== undefined);
  // The rows shown: every id, or the ids that match the filter (known once the trace is read).
  const ids = useMemo(() => (filtering && all ? filterTrace(all, filter) : null), [all, filter, filtering]);
  const count = ids ? ids.length : header.length;
  const indexOf = (id: number): number => (ids ? ids.indexOf(id) : id);
  const at = (k: number): number => (ids ? ids[k] : k);
  const cursorRow = cursor < 0 ? -1 : indexOf(cursor);

  // Keep the cursor's row in view: scroll it to the middle whenever it leaves the window.
  const box = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState(() => Math.max(0, (cursorRow - VISIBLE / 2) * ROW));
  useEffect(() => {
    if (cursorRow < 0) return;
    const el = box.current;
    const y = cursorRow * ROW;
    const t = el ? el.scrollTop : top;
    if (y < t || y > t + (VISIBLE - 1) * ROW) {
      const next = Math.max(0, y - (VISIBLE / 2) * ROW);
      if (el) el.scrollTop = next;
      setTop(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursorRow]);
  const first = Math.max(0, Math.floor(top / ROW) - 4);
  const last = Math.min(count, first + VISIBLE + 8);
  const byId = (id: number): Instruction | undefined => all?.[id];

  const kinds = useMemo(() => (all ? [...new Set(all.map((i) => i.kind))] : []), [all]);
  const epochs = header.epochStarts.length - 1;
  const set = (k: keyof TraceFilter, v: string): void =>
    setFilter({ ...filter, [k]: v === '' ? undefined : k === 'epoch' ? Number(v) : v });

  const find = (): void => {
    if (!all) return;
    const t = Number(threshold);
    if (!Number.isFinite(t) || t < 0) return setNotFound('Enter a threshold such as 1e-3.');
    const hit = firstGradient(all, {
      when,
      threshold: t,
      from: cursor + 1,
      filter: filtering ? filter : undefined,
    });
    if (!hit) return setNotFound(`No gradient ${when} ${threshold} after the cursor.`);
    setNotFound(null);
    onJump(hit.id);
  };

  return (
    <section className="panel trace" aria-label="The trace">
      <div className="panel-head">
        <h2>The trace: every instruction of this run</h2>
        <span className="small muted" data-count={count}>
          {filtering
            ? `${count.toLocaleString('en')} of ${header.length.toLocaleString('en')} match`
            : `${header.length.toLocaleString('en')} instructions`}
        </span>
      </div>
      <div className="trace-filter" role="group" aria-label="Filter the trace">
        <label>
          Kind{' '}
          <select
            data-control="trace:kind"
            value={filter.kind ?? ''}
            disabled={!all}
            onChange={(e) => set('kind', e.target.value)}
          >
            <option value="">any</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label>
          Layer{' '}
          <select
            data-control="trace:layer"
            value={filter.layer ?? ''}
            disabled={!all}
            onChange={(e) => set('layer', e.target.value)}
          >
            <option value="">any</option>
            {header.model.layers.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name} ({layerTitle(header, l.name)})
              </option>
            ))}
          </select>
        </label>
        <label>
          Phase{' '}
          <select
            data-control="trace:phase"
            value={filter.phase ?? ''}
            disabled={!all}
            onChange={(e) => set('phase', e.target.value)}
          >
            <option value="">any</option>
            {PHASES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Epoch{' '}
          <select
            data-control="trace:epoch"
            value={filter.epoch === undefined ? '' : String(filter.epoch)}
            disabled={!all}
            onChange={(e) => set('epoch', e.target.value)}
          >
            <option value="">any</option>
            {Array.from({ length: epochs }, (_, e) => (
              <option key={e} value={e}>
                {e + 1}
              </option>
            ))}
          </select>
        </label>
        {filtering && (
          <button type="button" className="link" data-control="trace:clear" onClick={() => setFilter({})}>
            Clear the filter
          </button>
        )}
      </div>
      <div className="trace-search" role="group" aria-label="Find a gradient">
        <span>First gradient after the cursor whose largest element is</span>
        <select
          data-control="trace:when"
          aria-label="Below or above"
          value={when}
          onChange={(e) => setWhen(e.target.value as 'below' | 'above')}
        >
          <option value="below">below</option>
          <option value="above">above</option>
        </select>
        <input
          className="param-number"
          data-control="trace:threshold"
          aria-label="Gradient magnitude threshold"
          inputMode="decimal"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && find()}
        />
        <button type="button" data-control="trace:find" disabled={!all} onClick={find}>
          Find
        </button>
        {notFound && (
          <span className="small" role="status">
            {notFound}
          </span>
        )}
      </div>
      <div
        ref={box}
        className="trace-list"
        style={{ height: VISIBLE * ROW }}
        onScroll={(e) => setTop(e.currentTarget.scrollTop)}
        role="list"
        aria-label="Instructions"
      >
        <div style={{ height: count * ROW, position: 'relative' }}>
          {Array.from({ length: Math.max(0, last - first) }, (_, n) => {
            const k = first + n;
            const id = at(k);
            const ins = byId(id);
            const current = id === cursor;
            return (
              <div
                key={id}
                role="listitem"
                className={`trace-row${current ? ' current' : ''}`}
                style={{ top: k * ROW, height: ROW }}
                aria-current={current ? 'step' : undefined}
                data-id={id}
              >
                <button type="button" data-control="trace:row" onClick={() => onJump(id)}>
                  <code className="ident">#{id + 1}</code>
                  <span className="trace-meaning" title={ins ? kindMeaning(ins.kind) : undefined}>
                    {ins ? kindMeaning(ins.kind) : '…'}
                  </span>
                  <code className="ident">{ins?.kind ?? ''}</code>
                  <span className="trace-where">
                    {ins
                      ? `${ins.path.layer ?? '—'} · ${ins.path.phase}${ins.path.epoch !== null ? ` · epoch ${ins.path.epoch + 1}` : ''}`
                      : ''}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {filtering && cursor >= 0 && cursorRow < 0 && (
        <p className="small muted">The current instruction does not match the filter.</p>
      )}
    </section>
  );
}

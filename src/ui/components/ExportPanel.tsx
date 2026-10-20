/**
 * Figure export from the views: the standard figure set at the cursor, as
 * vector SVG, PDF (through the browser's print-to-PDF, which embeds the
 * fonts) and the CSV of the plotted numbers, in colour, greyscale or high
 * contrast, with editable captions. "All figures" downloads one ZIP.
 */
import { useState } from 'react';
import type { Reply } from '../../core/engine/protocol';
import { PRINT_MODES, type PrintMode } from '../../export/ink';
import { zip } from '../../export/zip';
import { engineRequest, useLab } from '../store';

type Fig = Extract<Reply, { op: 'figures' }>['figures'][number];

function save(name: string, data: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function printPdf(f: Fig): void {
  const [, w, h] = f.svg.match(/width="([\d.]+)" height="([\d.]+)"/)!.map(Number);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(
    `<!doctype html><title>${f.id}</title><style>@page{size:${w}px ${h}px;margin:0}html,body{margin:0}</style>${f.svg}<script>onload=()=>{print()}</` +
      'script>',
  );
  win.document.close();
}

export function ExportPanel() {
  const s = useLab();
  const [mode, setMode] = useState<PrintMode>('colour');
  const [figs, setFigs] = useState<Fig[] | null>(null);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const build = async (m = mode, c = captions): Promise<void> => {
    setBusy(true);
    setErr(null);
    try {
      const r = await engineRequest<'figures'>({
        op: 'figures',
        cursor: useLab.getState().cursor,
        mode: m,
        captions: c,
      });
      setFigs(r.figures);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const base = (f: Fig) => `dlvizlab-${s.experimentId}-${f.id}${mode === 'colour' ? '' : `-${mode}`}`;
  return (
    <details
      className="panel export"
      onToggle={(e) => (e.currentTarget.open && !figs ? void build() : undefined)}
    >
      <summary data-control="export:open">
        <h2>Export figures</h2>
      </summary>
      <p className="small muted">
        Figures show the state at the current position. Every figure comes with a CSV of the numbers it draws.
      </p>
      <div className="seg" role="radiogroup" aria-label="Print mode">
        {PRINT_MODES.map((m) => (
          <button
            data-control="export:mode"
            key={m.id}
            role="radio"
            aria-checked={mode === m.id}
            className={mode === m.id ? 'on' : ''}
            onClick={() => {
              setMode(m.id);
              void build(m.id);
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="row-buttons">
        <button data-control="export:refresh" onClick={() => void build()} disabled={busy || !s.header}>
          {busy ? 'Preparing…' : 'Refresh at current position'}
        </button>
        <button
          data-control="export:zip"
          disabled={!figs?.length}
          onClick={() =>
            save(
              `dlvizlab-${s.experimentId}-figures${mode === 'colour' ? '' : `-${mode}`}.zip`,
              zip(
                figs!.flatMap((f) => [
                  { name: `${base(f)}.svg`, text: f.svg + '\n' },
                  { name: `${f.id}.csv`, text: f.csv },
                ]),
              ) as BlobPart,
              'application/zip',
            )
          }
        >
          All figures (.zip)
        </button>
      </div>
      {err && (
        <p className="error" role="alert">
          {err}
        </p>
      )}
      {figs?.map((f) => (
        <div key={f.id} className="export-fig">
          <div className="export-head">
            <strong>{f.title}</strong>
            <span className="export-buttons">
              <button
                data-control="export:svg"
                onClick={() => save(`${base(f)}.svg`, f.svg, 'image/svg+xml')}
                aria-label={`${f.title}: download SVG`}
              >
                SVG
              </button>
              <button
                data-control="export:pdf"
                onClick={() => printPdf(f)}
                aria-label={`${f.title}: save as PDF via the print dialog`}
              >
                PDF
              </button>
              <button
                data-control="export:csv"
                onClick={() => save(`${f.id}.csv`, f.csv, 'text/csv')}
                aria-label={`${f.title}: download CSV data`}
              >
                CSV
              </button>
            </span>
          </div>
          <label className="small" htmlFor={`cap-${f.id}`}>
            Caption
          </label>
          <textarea
            data-control="export:caption"
            id={`cap-${f.id}`}
            rows={2}
            defaultValue={captions[f.id] ?? f.caption}
            onBlur={(e) => {
              if (e.target.value === f.caption) return;
              const c = { ...captions, [f.id]: e.target.value };
              setCaptions(c);
              void build(mode, c);
            }}
          />
        </div>
      ))}
    </details>
  );
}

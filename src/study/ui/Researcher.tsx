/**
 * The researcher's screen: session configuration, the consent file, starting
 * a participant, the participant flow so far, and the one-click export.
 * No participant data are shown beyond counts.
 */
import { useState } from 'react';
import { placeholders, validateConsent, type ConsentDoc } from '../consent';
import { exportFiles } from '../export';
import { consentDoc, useStudy } from '../store';
import { zip } from '../zip';
import type { Condition, Design } from '../types';
import { conditionsFor } from '../types';

function download(name: string, bytes: Uint8Array): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function storageWorks(): boolean {
  try {
    localStorage.setItem('dl-vizlab.study.probe', '1');
    localStorage.removeItem('dl-vizlab.study.probe');
    return true;
  } catch {
    return false;
  }
}

export function Researcher() {
  const s = useStudy();
  const [consentError, setConsentError] = useState<string | null>(null);
  const doc = consentDoc(s);
  const missing = placeholders(doc);
  const conds = conditionsFor(s.config.design);
  const ps = s.participants;
  const count = (f: (p: (typeof ps)[number]) => boolean) => ps.filter(f).length;
  const minutes = (k: keyof typeof s.config.limits) => (
    <input
      id={`limit-${k}`}
      type="number"
      min={0.1}
      step="any"
      value={+(s.config.limits[k] / 60).toFixed(2)}
      onChange={(e) => {
        const v = Number(e.target.value);
        if (v > 0) s.setConfig({ limits: { ...s.config.limits, [k]: Math.round(v * 60) } });
      }}
    />
  );

  return (
    <div className="study researcher">
      <header className="study-bar">
        <strong>DL-VizLab · Study Mode (researcher)</strong>
        <a href="#" className="small">
          Back to the tool
        </a>
      </header>
      <main className="study-main">
        {!storageWorks() && (
          <p className="error" role="alert">
            This browser blocks local storage. Responses would be lost on reload — use a normal (not private)
            window.
          </p>
        )}
        <section className="panel">
          <h2>Session configuration</h2>
          <div className="form-grid">
            <label htmlFor="study-id">Study identifier</label>
            <input
              id="study-id"
              value={s.config.studyId}
              onChange={(e) => s.setConfig({ studyId: e.target.value.replace(/[^\w.-]/g, '') })}
            />
            <label htmlFor="design">Design</label>
            <select
              id="design"
              value={s.config.design}
              onChange={(e) => s.setConfig({ design: e.target.value as Design, override: null })}
            >
              <option value="three_condition">Three conditions (C1, C2, C3)</option>
              <option value="two_condition">Two conditions (C1, C3)</option>
            </select>
            <label htmlFor="limit-pre">Pre-test limit (minutes)</label>
            {minutes('pre')}
            <label htmlFor="limit-intervention">Intervention duration (minutes)</label>
            {minutes('intervention')}
            <label htmlFor="limit-post">Post-test limit (minutes)</label>
            {minutes('post')}
            <label htmlFor="override">Condition for the next participant</label>
            <select
              id="override"
              value={s.config.override ?? ''}
              onChange={(e) => s.setConfig({ override: (e.target.value || null) as Condition | null })}
            >
              <option value="">Stratified randomisation (normal)</option>
              {conds.map((c) => (
                <option key={c} value={c}>
                  Override: {c} (technical recovery only; recorded)
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="panel">
          <h2>Consent text</h2>
          <p className="small">
            Using:{' '}
            <strong>
              {s.consent
                ? `loaded file (${s.consent.id ?? 'no id'}, version ${s.consent.version ?? '?'})`
                : 'bundled draft'}
            </strong>
          </p>
          <label className="small" htmlFor="consent-file">
            Load the ethics-approved consent file (JSON, same structure as{' '}
            <code>src/study/config/consent.json</code>):
          </label>{' '}
          <input
            id="consent-file"
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const d = JSON.parse(await f.text()) as unknown;
                const errs = validateConsent(d);
                if (errs.length) setConsentError(errs.join('; '));
                else {
                  setConsentError(null);
                  s.setConsent(d as ConsentDoc);
                }
              } catch {
                setConsentError('not valid JSON');
              }
            }}
          />
          {s.consent && (
            <button className="link" onClick={() => s.setConsent(null)}>
              Revert to the bundled draft
            </button>
          )}
          {consentError && (
            <p className="error" role="alert">
              File rejected: {consentError}
            </p>
          )}
          {missing.length > 0 && (
            <p className="warn" role="status">
              The consent text still contains placeholders ({missing.join(', ')}). Study Mode will not start
              until they are filled.
            </p>
          )}
        </section>

        <section className="panel">
          <h2>Run</h2>
          <button className="primary" disabled={missing.length > 0} onClick={() => s.start()}>
            Start a participant session
          </button>
          <p className="small muted">
            Hand the computer to the participant after pressing. A new anonymous code is generated for every
            session.
          </p>
        </section>

        <section className="panel">
          <h2>Participant flow</h2>
          <table className="table small">
            <thead>
              <tr>
                <th>Opened</th>
                <th>Declined</th>
                <th>Allocated</th>
                {conds.map((c) => (
                  <th key={c}>{c} completed</th>
                ))}
                <th>Withdrawn</th>
                <th>Incomplete</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{ps.length}</td>
                <td>{count((p) => p.stage === 'declined')}</td>
                <td>{count((p) => p.condition !== null)}</td>
                {conds.map((c) => (
                  <td key={c}>{count((p) => p.condition === c && p.completed === 1)}</td>
                ))}
                <td>{count((p) => p.withdrawn === 1)}</td>
                <td>{count((p) => p.consented === 1 && p.completed === 0 && p.withdrawn === 0)}</td>
              </tr>
            </tbody>
          </table>
          <div className="row-buttons">
            <button
              className="primary"
              disabled={ps.length === 0}
              onClick={() =>
                download(
                  `dlvizlab-${s.config.studyId}-${new Date().toISOString().slice(0, 10)}.zip`,
                  zip(exportFiles(ps)),
                )
              }
            >
              Export data (.zip of CSV files)
            </button>
            <button
              className="danger"
              disabled={ps.length === 0}
              onClick={() => {
                if (
                  window.confirm(
                    'Delete every participant record on this computer? Export first. This cannot be undone.',
                  )
                )
                  s.clearAll();
              }}
            >
              Delete all study data on this computer
            </button>
          </div>
          <p className="small muted">
            The export follows docs/DATA-DICTIONARY.md and is read directly by analysis/analysis.py.
          </p>
        </section>
      </main>
    </div>
  );
}

import { useEffect } from 'react';
import { GRANULARITIES } from '../core/npm/stats';
import { ExplanationPanel } from '../explain/ExplanationPanel';
import { EXPERIMENTS, experimentById } from '../experiments/registry';
import { NetworkView } from '../views/execution/NetworkView';
import { Controls } from './components/Controls';
import { describeState } from './describe';
import { useLab } from './store';

function usePlayback(): void {
  const { playing, speedMs, cursor, step } = useLab();
  useEffect(() => {
    if (!playing) return;
    const t = window.setTimeout(() => void step(1), speedMs);
    return () => window.clearTimeout(t);
  }, [playing, speedMs, cursor, step]);
}

function useKeyboard(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || e.altKey || e.ctrlKey || e.metaKey)
        return;
      const s = useLab.getState();
      if (e.key === 'ArrowRight') void s.step(1);
      else if (e.key === 'ArrowLeft') void s.step(-1);
      else if (e.key === ' ' && (e.target as HTMLElement | null)?.tagName !== 'BUTTON')
        s.setPlaying(!s.playing);
      else if (e.key === 'Home') void s.reset();
      else if (/^[1-6]$/.test(e.key)) s.setGranularity(GRANULARITIES[Number(e.key) - 1]);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

export function App() {
  const s = useLab();
  usePlayback();
  useKeyboard();
  useEffect(() => {
    void useLab.getState().load(useLab.getState().experimentId);
  }, []);
  const exp = experimentById(s.experimentId);
  const focusIndex = s.focus && s.exec?.current?.path.layer === s.focus.layer ? s.focus.index : 0;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>DL-VizLab</h1>
          <span className="tag">see every step of neural-network training</span>
        </div>
        <label className="exp-select">
          <span>Experiment</span>
          <select value={s.experimentId} onChange={(e) => void s.load(e.target.value)}>
            {EXPERIMENTS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
        </label>
      </header>
      <p className="intro">
        <strong>Goal:</strong> {exp.objective} <span className="muted">{exp.intro}</span>
      </p>
      {s.error && (
        <p className="error" role="alert">
          {s.error}
        </p>
      )}
      <main className="grid">
        <Controls />
        <div className="center">
          {s.header ? (
            <NetworkView header={s.header} exec={s.exec} focus={s.focus} onFocus={s.setFocus} />
          ) : (
            <section className="panel" aria-busy="true">
              <p>Generating the training trace…</p>
            </section>
          )}
          <p className="summary" aria-live="polite">
            {s.header ? describeState(s.header, s.exec, s.length) : ''}
          </p>
        </div>
        {s.header && (
          <ExplanationPanel
            header={s.header}
            exec={s.exec}
            operands={s.operands}
            focusIndex={focusIndex}
            verbosity={s.verbosity}
            onVerbosity={s.setVerbosity}
          />
        )}
      </main>
      <footer className="foot">
        Every number on this page is computed by DL-VizLab’s own engine (gradient-checked and verified against
        TensorFlow.js) and recorded in a replayable trace.
      </footer>
    </div>
  );
}

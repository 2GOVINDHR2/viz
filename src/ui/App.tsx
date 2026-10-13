import { useEffect } from 'react';
import { GRANULARITIES } from '../core/npm/stats';
import { ExplanationPanel } from '../explain/ExplanationPanel';
import { describeChanges } from '../explain/diff';
import { Inspector } from '../views/execution/Inspector';
import { StructureView } from '../views/structure/StructureView';
import { TrainingView } from '../views/training/TrainingView';
import { experimentById } from '../experiments/registry';
import { NetworkView } from '../views/execution/NetworkView';
import { focusIndexFor } from '../views/focus';
import { Controls } from './components/Controls';
import { Curriculum } from './components/Curriculum';
import { SelfCheck, TryIt, Walkthrough } from './components/Guide';
import { ActivationPanel, LossComparePanel, LrComparePanel, SurfacePanel } from '../views/panels/Panels';
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
  const focusIndex = s.header ? focusIndexFor(s.focus, s.exec?.current ?? null, s.header) : 0;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <h1>DL-VizLab</h1>
          <span className="tag">see every step of neural-network training</span>
        </div>
      </header>
      <Curriculum />
      <p className="intro">
        <strong>
          {exp.number}. {exp.title}.
        </strong>{' '}
        <strong>Goal:</strong> {exp.objective} <span className="muted">{exp.intro}</span>
      </p>
      {s.error && (
        <p className="error" role="alert">
          {s.error}
        </p>
      )}
      <main className="grid">
        <div className="left">
          <Controls />
          <TryIt />
          {s.header && (
            <StructureView
              header={s.header}
              exec={s.exec}
              config={s.config}
              defaults={exp.config}
              busy={s.generating}
              onReconfigure={(c) => void s.reconfigure(c)}
            />
          )}
        </div>
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
          {s.header && exp.panels.length > 0 && (
            <section className="panel panels" aria-label="Experiment panels">
              {exp.panels.includes('activation') && <ActivationPanel header={s.header} exec={s.exec} />}
              {exp.panels.includes('lossCompare') && <LossComparePanel header={s.header} exec={s.exec} />}
              {exp.panels.includes('surface') && <SurfacePanel header={s.header} exec={s.exec} />}
              {exp.panels.includes('lrCompare') && <LrComparePanel experiment={exp} config={s.config} />}
            </section>
          )}
          {s.header && (
            <TrainingView
              header={s.header}
              exec={s.exec}
              epochs={s.epochs}
              onJumpToEpochEnd={(e) => void s.jump(s.header!.epochStarts[e + 1] - 1)}
            />
          )}
        </div>
        {s.header && (
          <div className="right">
            <Walkthrough />
            <ExplanationPanel
              header={s.header}
              exec={s.exec}
              operands={s.operands}
              focusIndex={focusIndex}
              verbosity={s.verbosity}
              onVerbosity={s.setVerbosity}
              changes={describeChanges(s.header, s.prevExec, s.exec)}
            />
            <Inspector header={s.header} exec={s.exec} focus={s.focus} onClear={() => s.setFocus(null)} />
            <SelfCheck />
          </div>
        )}
      </main>
      <footer className="foot">
        Every number on this page is computed by DL-VizLab’s own engine (gradient-checked and verified against
        TensorFlow.js) and recorded in a replayable trace.
      </footer>
    </div>
  );
}

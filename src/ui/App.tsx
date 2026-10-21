import { useEffect, type ComponentType } from 'react';
import { GRANULARITIES } from '../core/npm/stats';
import { offeredGranularities } from '../experiments/surface';
import type { Experiment } from '../experiments/types';
import { ExplanationPanel } from '../explain/ExplanationPanel';
import { describeChanges } from '../explain/diff';
import { StructureView } from '../views/structure/StructureView';
import { TrainingView } from '../views/training/TrainingView';
import { experimentById } from '../experiments/registry';
import { ConvView } from '../views/execution/ConvView';
import { NetworkView } from '../views/execution/NetworkView';
import { focusIndexFor } from '../views/focus';
import { Controls } from './components/Controls';
import { Curriculum } from './components/Curriculum';
import { ExportPanel } from './components/ExportPanel';
import { SelfCheck, TryIt, Walkthrough } from './components/Guide';
import { ActivationPanel, LossComparePanel, LrComparePanel, SurfacePanel } from '../views/panels/Panels';
import { ParamEditor } from '../views/structure/ParamEditor';
import { BoundInspector } from './BoundInspector';
import { useStartingValues } from './useStartingValues';
import { PassedOnTheWay } from './novice/common';
import { describeState } from './describe';
import { BackpropScreen } from './novice/Backprop';
import { GradientDescentScreen } from './novice/GradientDescent';
import { SingleNeuronScreen } from './novice/SingleNeuron';
import { useLab } from './store';

/** Purpose-built novice screens (Fix Round 2, §2.6); the other experiments use the simplified workbench for now. */
export const NOVICE_SCREENS: Record<string, ComponentType<{ exp: Experiment }>> = {
  'single-neuron': SingleNeuronScreen,
  'gradient-descent': GradientDescentScreen,
  backpropagation: BackpropScreen,
};

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
      else if (/^[1-6]$/.test(e.key)) {
        // Only a step size the current screen offers.
        const g = GRANULARITIES[Number(e.key) - 1];
        if (!offeredGranularities(experimentById(s.experimentId), s.mode).includes(g)) return;
        s.setGranularity(g);
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

function ModeSwitch() {
  const mode = useLab((s) => s.mode);
  const setMode = useLab((s) => s.setMode);
  return (
    <div className="mode-switch" role="group" aria-label="Interface">
      <button
        aria-pressed={mode === 'novice'}
        className={mode === 'novice' ? 'on' : ''}
        onClick={() => setMode('novice')}
      >
        Guided path
      </button>
      <button
        aria-pressed={mode === 'expert'}
        className={mode === 'expert' ? 'on' : ''}
        onClick={() => setMode('expert')}
      >
        Expert mode
      </button>
    </div>
  );
}

/** The three-view workbench: the full cockpit in expert mode, filtered by the experiment's declared surface on the novice path. */
function Workbench({ exp }: { exp: Experiment }) {
  const s = useLab();
  const expert = s.mode === 'expert';
  const focusIndex = s.header ? focusIndexFor(s.focus, s.exec?.current ?? null, s.header) : 0;
  const starting = useStartingValues(exp.surface.parameterEditor ? s.header : null);
  return (
    <>
      <p className="intro">
        <strong>
          {exp.number}. {exp.title}.
        </strong>{' '}
        <strong>Goal:</strong> {exp.objective} <span className="muted">{exp.intro}</span>
      </p>
      {!expert && (
        <p className="note small" role="note">
          A purpose-built beginner screen for this experiment is still being built; this is the full workbench
          with only the controls this experiment needs.
        </p>
      )}
      <main className="grid" id="views" tabIndex={-1}>
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
              allowEdit={exp.surface.architectureEditor}
            />
          )}
          {s.header && exp.surface.parameterEditor && (
            <ParamEditor
              header={s.header}
              config={s.config}
              starting={starting}
              busy={s.generating}
              onApply={(c) => void s.reconfigure(c)}
            />
          )}
        </div>
        <div className="center">
          {s.header ? (
            s.header.model.layers.some((l) => l.type === 'conv2d') ? (
              <ConvView header={s.header} exec={s.exec} focus={s.focus} onFocus={s.setFocus} />
            ) : (
              <NetworkView header={s.header} exec={s.exec} focus={s.focus} onFocus={s.setFocus} />
            )
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
            {!expert && <PassedOnTheWay />}
            <ExplanationPanel
              header={s.header}
              exec={s.exec}
              operands={s.operands}
              focusIndex={focusIndex}
              verbosity={s.verbosity}
              onVerbosity={s.setVerbosity}
              changes={describeChanges(s.header, s.prevExec, s.exec)}
            />
            <BoundInspector
              header={s.header}
              exec={s.exec}
              focus={s.focus}
              onClear={() => s.setFocus(null)}
            />
            <SelfCheck />
            {expert && <ExportPanel />}
          </div>
        )}
      </main>
    </>
  );
}

export function App() {
  const s = useLab();
  usePlayback();
  useKeyboard();
  useEffect(() => {
    void useLab.getState().load(useLab.getState().experimentId);
  }, []);
  const exp = experimentById(s.experimentId);
  const Screen = s.mode === 'novice' ? NOVICE_SCREENS[exp.id] : undefined;

  return (
    <div className="app" data-mode={s.mode} data-runs={s.runs}>
      <a className="skip-link" href="#views">
        Skip to the experiment
      </a>
      <header className="top">
        <div className="brand">
          <h1>DL-VizLab</h1>
          <span className="tag">see every step of neural-network training</span>
        </div>
        <ModeSwitch />
      </header>
      <Curriculum />
      {s.error && (
        <p className="error" role="alert">
          {s.error}
        </p>
      )}
      {Screen ? (
        <main id="views" tabIndex={-1} className="novice-main">
          <Screen key={`${exp.id}:${s.resets}`} exp={exp} />
        </main>
      ) : (
        <Workbench key={`${exp.id}:${s.resets}`} exp={exp} />
      )}
      <footer className="foot">
        {s.mode === 'novice'
          ? 'Every number on this page comes from actually running the network, not from an illustration.'
          : 'Every number on this page is computed by DL-VizLab’s own engine (gradient-checked and verified against TensorFlow.js) and recorded in a replayable trace.'}
      </footer>
    </div>
  );
}

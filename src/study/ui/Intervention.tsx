/**
 * The intervention stage: identical duration for every condition, a visible
 * countdown, automatic hand-over to the post-test when time is up.
 *   C1 — static pages generated from the experiment definitions and screenshots of the tool (slides.json)
 *   C2 — exercise sheet for TensorFlow Playground (config/playground-sheet.json), CNN pages from C1
 *   C3 — the full DL-VizLab tool, with telemetry recorded
 */
import { useEffect, useRef, useState } from 'react';
import { emptyProgress, saveProgress } from '../../experiments/progress';
import { EXPERIMENTS } from '../../experiments/registry';
import { App } from '../../ui/App';
import { useLab } from '../../ui/store';
import sheet from '../config/playground-sheet.json';
import { instrumentLab, viewOf } from '../instrument';
import slides from '../slides.json';
import { useStudy } from '../store';
import { startRecording, stopRecording, track } from '../telemetry';
import type { Participant } from '../types';
import { StageShell, useRemaining } from './common';

type Slides = Record<string, { images: { src: string; alt: string }[] }[]>;
const SLIDES = slides as Slides;
const asset = (src: string): string => `${import.meta.env.BASE_URL}${src}`;

/** One experiment as static pages: objective, each walkthrough step with its screenshots, and the self-check with answers. */
export function ExperimentPages({ id }: { id: string }) {
  const e = EXPERIMENTS.find((x) => x.id === id)!;
  return (
    <article className="slides-exp" aria-label={`${e.number}. ${e.title}`}>
      <h2>
        {e.number}. {e.title}
      </h2>
      <p>
        <strong>Goal:</strong> {e.objective} {e.intro}
      </p>
      {e.walkthrough.map((w, k) => (
        <section key={k} className="slide">
          <p>
            <strong>Step {k + 1}.</strong> {w.text}
          </p>
          <div className="slide-images">
            {(SLIDES[id]?.[k]?.images ?? []).map((im) => (
              <img key={im.src} src={asset(im.src)} alt={im.alt} loading="lazy" />
            ))}
          </div>
        </section>
      ))}
      {e.selfCheck.length > 0 && (
        <section className="slide">
          <h3>Check yourself</h3>
          {e.selfCheck.map((q) => {
            const right = q.options.find((o) => o.correct)!;
            return (
              <details key={q.id}>
                <summary>{q.question}</summary>
                <p>
                  <strong>{right.text}</strong> — {right.feedback}
                </p>
              </details>
            );
          })}
        </section>
      )}
    </article>
  );
}

function C1() {
  const [k, setK] = useState(0);
  const e = EXPERIMENTS[k];
  return (
    <div className="c1">
      <nav className="slides-nav" aria-label="Topics">
        {EXPERIMENTS.map((x, j) => (
          <button
            key={x.id}
            className={j === k ? 'on' : ''}
            aria-current={j === k ? 'page' : undefined}
            onClick={() => setK(j)}
          >
            {x.number}. {x.title}
          </button>
        ))}
      </nav>
      <ExperimentPages id={e.id} />
      <div className="row-buttons">
        <button disabled={k === 0} onClick={() => setK(k - 1)}>
          ◀ Previous topic
        </button>
        <button disabled={k === EXPERIMENTS.length - 1} onClick={() => setK(k + 1)}>
          Next topic ▶
        </button>
      </div>
    </div>
  );
}

/** The Playground copy C2 uses: the pinned local build (default, offline) or the hosted site (config switch). */
const playgroundBase = (): string =>
  sheet.playground_source === 'hosted'
    ? sheet.playground_sources.hosted
    : `${import.meta.env.BASE_URL}${sheet.playground_sources.local}`;
export const playgroundUrl = (params: string): string => `${playgroundBase()}#${params}`;

function C2() {
  const [cnn, setCnn] = useState(false);
  return (
    <div className="c2 prose">
      <p>{sheet.intro}</p>
      <ol className="tasks">
        {sheet.tasks.map((t) => (
          <li key={t.id} className="panel">
            <h3>{t.title}</h3>
            {t.params ? (
              <p>
                <a href={playgroundUrl(t.params)} target="_blank" rel="noopener noreferrer">
                  Open this task in TensorFlow Playground ↗
                </a>
              </p>
            ) : (
              <button onClick={() => setCnn(!cnn)} aria-expanded={cnn}>
                {cnn ? 'Hide' : 'Show'} the CNN pages
              </button>
            )}
            <ol>
              {t.steps.map((x, k) => (
                <li key={k}>{x}</li>
              ))}
            </ol>
            <p className="small">
              <strong>Think about:</strong> {t.questions.join(' ')}
            </p>
            {!t.params && cnn && <ExperimentPages id={t.experiment} />}
          </li>
        ))}
      </ol>
      <p className="small muted">{sheet.playground_note}</p>
    </div>
  );
}

function C3({ startedAt }: { startedAt: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Every participant starts from the first experiment with no progress carried over from earlier sessions.
    instrumentLab();
    const fresh = emptyProgress();
    saveProgress(fresh);
    useLab.setState({ progress: fresh, experimentId: EXPERIMENTS[0].id, playing: false });
    startRecording((e) => useStudy.getState().addEvent(e), startedAt);
    // Every C3 participant starts on the same path (Fix Round 2, §2.1); not remembered on the device.
    useLab.getState().setMode(useStudy.getState().config.c3StartMode, false);
    setReady(true);
    let last: string | null = null;
    const onView = (ev: Event): void => {
      const v = viewOf(ev.target);
      if (!v || v === last) return;
      last = v;
      track('view', { view: v });
      if (v === 'Explanation') track('explain_open', { via: 'focus' });
    };
    const el = ref.current!;
    el.addEventListener('pointerdown', onView);
    el.addEventListener('focusin', onView);
    return () => {
      el.removeEventListener('pointerdown', onView);
      el.removeEventListener('focusin', onView);
      useLab.getState().setPlaying(false);
      stopRecording();
    };
  }, [startedAt]);
  return <div ref={ref}>{ready && <App />}</div>;
}

export function Intervention({ p }: { p: Participant }) {
  const s = useStudy();
  const remaining = useRemaining(p, s.config.limits.intervention);
  useEffect(() => {
    if (remaining === 0) s.finishIntervention();
  }, [remaining, s]);
  return (
    <StageShell p={p} remaining={remaining} wide>
      <p className="study-note small">
        Study the material until the time runs out; the questions then start automatically.
      </p>
      {p.condition === 'C1' && <C1 />}
      {p.condition === 'C2' && <C2 />}
      {p.condition === 'C3' && <C3 startedAt={p.stageStartedAt} />}
    </StageShell>
  );
}

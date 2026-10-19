/**
 * Building blocks of a novice experiment screen (Fix Round 2, §2.5): the
 * question, the prediction, the reveal, the step control, "going deeper" and
 * the handoff. Each experiment screen composes these around its own
 * observation; none of them knows which experiment it is in beyond its id.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Granularity } from '../../core/npm/stats';
import { LEVEL_LABEL } from '../../experiments/surface';
import type { Experiment } from '../../experiments/types';
import { track } from '../../study/telemetry';
import { SelfCheck } from '../components/Guide';
import { useLab } from '../store';
import { predictionOf, usePredictions } from './state';

export function NoviceShell({
  exp,
  question,
  children,
}: {
  exp: Experiment;
  question: string;
  children: ReactNode;
}) {
  // The position, for tests and assistive tooling; novice screens do not show instruction counts.
  const cursor = useLab((s) => s.cursor);
  return (
    <article className="novice" aria-labelledby={`nq-${exp.id}`} data-screen={exp.id} data-cursor={cursor}>
      <p className="novice-kicker">
        Experiment {exp.number} · {exp.title}
      </p>
      <h2 id={`nq-${exp.id}`} className="novice-question">
        {question}
      </h2>
      {children}
    </article>
  );
}

export interface PredictionSpec {
  id: string;
  question: string;
  options: string[];
}

/** One click commits a prediction; it can be changed until the outcome is shown. */
export function Prediction({ exp, spec, hint }: { exp: Experiment; spec: PredictionSpec; hint?: string }) {
  const records = usePredictions((p) => p.records);
  const choose = usePredictions((p) => p.choose);
  const rec = predictionOf(records, exp.id, spec.id);
  const locked = rec?.correct !== undefined;
  return (
    <fieldset className="predict" aria-describedby={hint ? `ph-${spec.id}` : undefined}>
      <legend>
        <span className="step-tag">Your prediction</span> {spec.question}
      </legend>
      <div className="predict-options">
        {spec.options.map((o, k) => (
          <button
            key={o}
            type="button"
            className={rec?.choice === k ? 'chosen' : ''}
            aria-pressed={rec?.choice === k}
            disabled={locked}
            onClick={() => choose(exp.id, spec.id, k)}
          >
            {rec?.choice === k ? '● ' : '○ '}
            {o}
          </button>
        ))}
      </div>
      {hint && (
        <p id={`ph-${spec.id}`} className="small muted">
          {hint}
        </p>
      )}
    </fieldset>
  );
}

/** The outcome, in words: whether the prediction held, and why. */
export function Reveal({
  exp,
  spec,
  outcome,
  why,
}: {
  exp: Experiment;
  spec: PredictionSpec;
  /** Index of the option that actually happened, or null while it is not yet observed. */
  outcome: number | null;
  why: string;
}) {
  const records = usePredictions((p) => p.records);
  const rec = predictionOf(records, exp.id, spec.id);
  // Once resolved, the outcome stays shown even after the run moves on.
  const shown = outcome ?? rec?.outcome ?? null;
  if (shown === null || !rec) return null;
  const held = rec.choice === shown;
  return (
    <div className={`reveal ${held ? 'right' : 'wrong'}`} role="status">
      <p>
        <strong>{held ? '✓ Your prediction held.' : '✗ Not this time.'}</strong> You predicted “
        {spec.options[rec.choice]}”; what happened: “{spec.options[shown]}”.
      </p>
      <p>{why}</p>
    </div>
  );
}

/** Records the outcome of a prediction once it is observed (idempotent). */
export function useResolve(exp: Experiment, spec: PredictionSpec, outcome: number | null): void {
  const records = usePredictions((p) => p.records);
  const resolve = usePredictions((p) => p.resolve);
  const rec = predictionOf(records, exp.id, spec.id);
  const pending = outcome !== null && rec !== undefined && rec.correct === undefined;
  useEffect(() => {
    if (pending && outcome !== null) resolve(exp.id, spec.id, outcome);
  }, [pending, rec, outcome, resolve, exp.id, spec.id]);
}

/** Step control in learner-facing words. One offered level → one button, never a selector. */
export function StepBar({ levels, note }: { levels: Granularity[]; note?: string }) {
  const s = useLab();
  const disabled = !s.header || s.generating;
  const g = levels.includes(s.granularity) ? s.granularity : levels[0];
  return (
    <div className="stepbar" role="group" aria-label="Step through the run">
      {levels.length > 1 && (
        <div className="seg" role="radiogroup" aria-label="Step size">
          {levels.map((l) => (
            <button
              key={l}
              role="radio"
              aria-checked={g === l}
              className={g === l ? 'on' : ''}
              onClick={() => s.setGranularity(l)}
            >
              {LEVEL_LABEL[l]}
            </button>
          ))}
        </div>
      )}
      <button
        disabled={disabled || s.cursor < 0}
        onClick={() => {
          if (g !== s.granularity) s.setGranularity(g);
          void s.step(-1);
        }}
        aria-keyshortcuts="ArrowLeft"
      >
        ◀ Back
      </button>
      <button
        className="primary"
        disabled={disabled || s.cursor >= s.length - 1}
        onClick={() => {
          if (g !== s.granularity) s.setGranularity(g);
          void s.step(1);
        }}
        aria-keyshortcuts="ArrowRight"
      >
        Next: {LEVEL_LABEL[g]} ▶
      </button>
      {note && <span className="small muted">{note}</span>}
    </div>
  );
}

export interface DeeperItem {
  id: string;
  label: string;
  /** Why this extra perspective is useful now (shown when it opens). */
  why?: string;
  render(): ReactNode;
}

/** "Going deeper": offered, never forced. Each item opens in place; the last always leads to expert mode. */
export function GoingDeeper({ exp, items }: { exp: Experiment; items: DeeperItem[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const setMode = useLab((s) => s.setMode);
  return (
    <section className="panel deeper" aria-label="Going deeper">
      <h3>Going deeper</h3>
      <div className="deeper-buttons">
        {items.map((it) => (
          <button
            key={it.id}
            className="link"
            aria-expanded={open[it.id] ?? false}
            aria-controls={`deeper-${exp.id}-${it.id}`}
            onClick={() => {
              const now = !(open[it.id] ?? false);
              track('deeper', { experiment: exp.id, affordance: it.id, open: now });
              setOpen({ ...open, [it.id]: now });
            }}
          >
            {open[it.id] ? '▾ ' : '▸ '}
            {it.label}
          </button>
        ))}
        <button
          className="link"
          onClick={() => {
            track('deeper', { experiment: exp.id, affordance: 'expert', open: true });
            setMode('expert');
          }}
        >
          ⧉ Open the full workbench (expert mode)
        </button>
      </div>
      {items.map(
        (it) =>
          open[it.id] && (
            <div key={it.id} id={`deeper-${exp.id}-${it.id}`} className="deeper-body">
              {it.why && <p className="small muted">{it.why}</p>}
              {it.render()}
            </div>
          ),
      )}
    </section>
  );
}

export function Handoff({ text }: { text: string }) {
  return (
    <>
      <SelfCheck />
      <p className="handoff">
        <strong>Next question.</strong> {text}
      </p>
    </>
  );
}

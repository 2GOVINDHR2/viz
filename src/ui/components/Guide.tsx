/**
 * The experiment guide: things to try (editable parameters), the guided
 * walkthrough (optional, dismissible, resumable) and the self-check that
 * completes the experiment and unlocks the next.
 */
import { useRef, useState } from 'react';
import { applyEdit, editValue } from '../../experiments/edits';
import { experimentById } from '../../experiments/registry';
import type { EditableParam, WalkAction } from '../../experiments/types';
import { isComplete } from '../../experiments/progress';
import { activeBreakpoints, engineRequest, useLab } from '../store';

function editLabel(e: EditableParam): string {
  switch (e.kind) {
    case 'learningRate':
      return 'Learning rate η';
    case 'loss':
      return 'Loss function';
    case 'activation':
      return e.layer === -1 ? 'Hidden activations' : `Activation of layer ${e.layer + 1}`;
    case 'hiddenUnits':
      return `Units in hidden layer ${e.layer + 1}`;
    case 'batchSize':
      return 'Batch size B';
    case 'initialValue':
      return e.label;
  }
}

const LOSS_NAME: Record<string, string> = {
  bce: 'cross-entropy',
  mse: 'squared error',
  cce: 'categorical cross-entropy',
};

export function TryIt() {
  const s = useLab();
  const exp = experimentById(s.experimentId);
  const [pending, setPending] = useState<Record<number, number | string>>({});
  const timer = useRef<number | undefined>(undefined);
  if (exp.editable.length === 0) return null;
  const apply = (k: number, v: number | string): void => {
    setPending({ ...pending, [k]: v });
    void s.reconfigure(applyEdit(useLab.getState().config, exp.editable[k], v));
  };
  // Sliders regenerate the run once the learner pauses, not on every intermediate value.
  const applySoon = (k: number, v: number): void => {
    setPending({ ...pending, [k]: v });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => apply(k, v), 350);
  };
  return (
    <section className="panel tryit" aria-label="Try it">
      <h2>Try it</h2>
      <p className="small muted">Each change restarts the run with the new setting.</p>
      {exp.editable.map((e, k) => {
        const value = editValue(s.config, e);
        const id = `edit-${exp.id}-${k}`;
        return (
          <div key={id} className="try-row">
            <label htmlFor={id}>{editLabel(e)}</label>
            {e.kind === 'initialValue' ? (
              <span className="slider">
                <input
                  id={id}
                  type="range"
                  min={e.min}
                  max={e.max}
                  step={e.step}
                  value={Number(pending[k] ?? value)}
                  onChange={(ev) => applySoon(k, Number(ev.target.value))}
                />
                <output htmlFor={id}>{Number(pending[k] ?? value).toFixed(2)}</output>
              </span>
            ) : (
              <select
                id={id}
                value={String(value)}
                disabled={s.generating}
                onChange={(ev) =>
                  apply(
                    k,
                    e.kind === 'activation' || e.kind === 'loss' ? ev.target.value : Number(ev.target.value),
                  )
                }
              >
                {(e.options as (string | number)[]).map((o) => (
                  <option key={String(o)} value={String(o)}>
                    {e.kind === 'loss' ? (LOSS_NAME[String(o)] ?? String(o)) : String(o)}
                  </option>
                ))}
              </select>
            )}
          </div>
        );
      })}
    </section>
  );
}

async function perform(a: WalkAction): Promise<void> {
  const s = useLab.getState();
  if (!s.header) return;
  switch (a.type) {
    case 'granularity':
      s.setGranularity(a.granularity);
      return;
    case 'jump':
      await s.jump(a.to === 'start' ? -1 : s.length - 1);
      return;
    case 'epochEnd':
      await s.jump(s.header.epochStarts[Math.min(a.epoch + 1, s.header.epochStarts.length - 1)] - 1);
      return;
    case 'step':
      for (let k = 0; k < a.count; k++) await useLab.getState().step(1);
      return;
    case 'runToBreakpoint':
      await s.runToBreakpoint();
      return;
    case 'edit': {
      const exp = experimentById(s.experimentId);
      const config = a.edits.reduce((c, e) => applyEdit(c, exp.editable[e.param], e.value), s.config);
      await s.reconfigure(config);
      return;
    }
    case 'runToKind': {
      const r = await engineRequest<'move'>({
        op: 'runToBreakpoint',
        cursor: s.cursor,
        breakpoints: [
          { type: 'kind', kinds: [a.kind] },
          ...activeBreakpoints({ ...s.breakpoints, gradInit: false }),
        ],
      });
      await s.jump(r.cursor);
      return;
    }
  }
}

export function Walkthrough() {
  const s = useLab();
  const exp = experimentById(s.experimentId);
  const saved = s.progress.walkthrough[exp.id] ?? { step: 0, dismissed: false };
  if (exp.walkthrough.length === 0) return null;
  if (saved.dismissed) {
    return (
      <p className="walk-resume">
        <button className="link" onClick={() => s.setWalkthrough(exp.id, saved.step, false)}>
          Show the guided walkthrough ({saved.step + 1} of {exp.walkthrough.length})
        </button>
      </p>
    );
  }
  const k = Math.min(saved.step, exp.walkthrough.length - 1);
  const step = exp.walkthrough[k];
  return (
    <section className="panel walkthrough" aria-label="Guided walkthrough" aria-live="polite">
      <div className="panel-head">
        <h2>
          Walkthrough · {k + 1} of {exp.walkthrough.length}
        </h2>
        <button className="link" onClick={() => s.setWalkthrough(exp.id, k, true)}>
          Hide
        </button>
      </div>
      <p className="walk-text">{step.text}</p>
      <div className="walk-buttons">
        <button disabled={k === 0} onClick={() => s.setWalkthrough(exp.id, k - 1, false)}>
          ◀ Previous
        </button>
        {step.action && (
          <button
            className="primary-sm"
            disabled={!s.header || s.generating}
            onClick={() => void perform(step.action!)}
          >
            {step.actionLabel ?? 'Show me'}
          </button>
        )}
        <button
          disabled={k === exp.walkthrough.length - 1}
          onClick={() => s.setWalkthrough(exp.id, k + 1, false)}
        >
          Next ▶
        </button>
      </div>
    </section>
  );
}

export function SelfCheck() {
  const s = useLab();
  const exp = experimentById(s.experimentId);
  if (exp.selfCheck.length === 0) return null;
  const answers = s.progress.answers[exp.id] ?? {};
  const done = isComplete(exp.id, s.progress);
  return (
    <section className="panel selfcheck" aria-label="Check your understanding">
      <h2>Check your understanding</h2>
      {exp.selfCheck.map((q, qi) => {
        const chosen = answers[q.id];
        const fb = chosen !== undefined ? q.options[chosen] : null;
        return (
          <fieldset key={q.id}>
            <legend>
              {qi + 1}. {q.question}
            </legend>
            {q.options.map((o, k) => (
              <label key={k} className="check">
                <input
                  type="radio"
                  name={`${exp.id}-${q.id}`}
                  checked={chosen === k}
                  onChange={() => s.answer(exp.id, q.id, k)}
                />{' '}
                {o.text}
              </label>
            ))}
            {fb && (
              <p className={`feedback ${fb.correct ? 'right' : 'wrong'}`} role="status">
                <strong>{fb.correct ? '✓ Correct.' : '✗ Not quite.'}</strong> {fb.feedback}
              </p>
            )}
          </fieldset>
        );
      })}
      {done && <p className="feedback right">Experiment complete — the next experiment is unlocked.</p>}
    </section>
  );
}

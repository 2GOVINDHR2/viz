/**
 * The experiment guide: things to try (editable parameters), the guided
 * walkthrough (optional, dismissible, resumable) and the self-check that
 * completes the experiment and unlocks the next.
 */
import { applyEdit } from '../../experiments/edits';
import { paramValue, validateParam } from '../../experiments/params';
import { ParamField } from './ParamField';
import { Marked } from './Marked';
import { experimentById } from '../../experiments/registry';
import type { EditableParam, WalkAction } from '../../experiments/types';
import { isComplete } from '../../experiments/progress';
import { activeBreakpoints, engineRequest, useLab } from '../store';

/**
 * The experiment's parameters (Fix Round 3, ADR-055): typed exact values, with the parameters marked `more`
 * behind a "More settings" disclosure so that a first view shows only what the experiment leads with.
 */
export function TryIt() {
  const s = useLab();
  const exp = experimentById(s.experimentId);
  if (exp.editable.length === 0) return null;
  const main = exp.editable.map((p, k) => [p, k] as const).filter(([p]) => !p.more);
  const more = exp.editable.map((p, k) => [p, k] as const).filter(([p]) => p.more);
  const row = ([p, k]: readonly [EditableParam, number]) => <TryItField key={k} param={p} k={k} />;
  return (
    <section className="panel tryit" aria-label="Try it">
      <h2>Try it</h2>
      <p className="small muted">
        Type a value and press Enter. Each change restarts the run with exactly that setting.
      </p>
      {main.map(row)}
      {more.length > 0 && (
        <details className="more-settings" open={s.mode === 'expert'}>
          <summary data-control="tryit:more">More settings</summary>
          {more.map(row)}
        </details>
      )}
    </section>
  );
}

/** One "Try it" parameter, bound to the store. */
export function TryItField({ param, k, label }: { param: EditableParam; k: number; label?: string }) {
  const s = useLab();
  const setting = { config: s.config, dataset: s.dataset, probes: s.probes };
  const perEpoch = s.header ? s.length / Math.max(1, s.config.epochs) : 0;
  return (
    <div className="try-row">
      <ParamField
        param={param}
        control={`tryit:${k}`}
        label={label}
        value={paramValue(setting, param)}
        disabled={s.generating}
        validate={(raw) => validateParam(setting, param, raw, perEpoch)}
        onApply={(v) => void s.applySetting(param, v)}
      />
    </div>
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
      for (let k = 0; k < a.count; k++) await useLab.getState().step(1, true);
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
        <button
          data-control="walkthrough:show"
          className="link"
          onClick={() => s.setWalkthrough(exp.id, saved.step, false)}
        >
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
        <button
          data-control="walkthrough:hide"
          className="link"
          onClick={() => s.setWalkthrough(exp.id, k, true)}
        >
          Hide
        </button>
      </div>
      <p className="walk-text">
        <Marked text={step.text} />
      </p>
      <div className="walk-buttons">
        <button
          data-control="walkthrough:prev"
          disabled={k === 0}
          onClick={() => s.setWalkthrough(exp.id, k - 1, false)}
        >
          ◀ Previous
        </button>
        {step.action && (
          <button
            data-control="walkthrough:show-me"
            className="primary-sm"
            disabled={!s.header || s.generating}
            onClick={() => void perform(step.action!)}
          >
            {step.actionLabel ?? 'Show me'}
          </button>
        )}
        <button
          data-control="walkthrough:next"
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
        // A question about the training's outcome opens once the learner has run it, with the experiment's own
        // settings, to the end (Fix Round 4, B2). An answer already given stays.
        // Once watched in this session, it stays open whatever the learner changes afterwards (Fix Round 5).
        const locked = !!q.afterRun && chosen === undefined && !s.ranOwn[exp.id];
        return (
          <fieldset key={q.id} aria-describedby={locked ? `lock-${q.id}` : undefined}>
            <legend>
              {qi + 1}. {q.question}
            </legend>
            {locked && (
              <p className="selfcheck-lock" id={`lock-${q.id}`}>
                This question is about what training does with the starting settings, so it opens once you
                have watched that run to the end.{' '}
                <button
                  type="button"
                  data-control="selfcheck:run-own"
                  disabled={s.generating}
                  onClick={() => void s.runOwn()}
                >
                  Run it with the starting settings
                </button>
              </p>
            )}
            {q.options.map((o, k) => (
              <label key={k} className="check">
                <input
                  data-control={`selfcheck:${q.id}`}
                  type="radio"
                  name={`${exp.id}-${q.id}`}
                  checked={chosen === k}
                  // The answers are disabled one by one, so the button that opens the question stays usable.
                  disabled={locked}
                  onChange={() => s.answer(exp.id, q.id, k)}
                />{' '}
                <Marked text={o.text} />
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

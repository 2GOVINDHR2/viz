/** Execution controls: granularity, step, run/pause, speed, reset, scrub, breakpoints. */
import { PATHOLOGIES, type Pathology } from '../../core/npm/pathologies';
import { GRANULARITIES } from '../../core/npm/stats';
import { experimentById } from '../../experiments/registry';
import { LEVEL_LABEL, LEVEL_TECHNICAL, offeredGranularities } from '../../experiments/surface';
import { useLab, type BreakpointToggles } from '../store';

const BP_LABEL: Record<keyof BreakpointToggles, string> = {
  ...(Object.fromEntries(PATHOLOGIES.map((p) => [p.id, p.label])) as Record<Pathology['id'], string>),
  lossPlateau: 'the epoch loss stops decreasing',
  gradInit: 'back-propagation starts (each example)',
};

/** Returns the experiment to its initial state (Fix Round 2b, defect 3); required on every experiment screen. */
export function ResetExperiment() {
  const s = useLab();
  return (
    <button
      className="link"
      data-control="reset-experiment"
      disabled={s.generating}
      onClick={() => void s.resetExperiment()}
      title="Back to this experiment's own settings, from the beginning"
    >
      ↺ Reset experiment
    </button>
  );
}

export function Controls() {
  const s = useLab();
  const disabled = !s.header || s.generating;
  const atEnd = s.cursor >= s.length - 1;
  const expert = s.mode === 'expert';
  // Only the step sizes this experiment declares (novice) or all six (expert); one level → no selector.
  const offered = offeredGranularities(experimentById(s.experimentId), s.mode);
  const breakpoints = (
    <fieldset className="breakpoints">
      <legend>Pause automatically when…</legend>
      {(Object.keys(BP_LABEL) as (keyof BreakpointToggles)[]).map((k) => (
        <label key={k} className="check">
          <input
            data-control={`breakpoint:${k}`}
            type="checkbox"
            checked={s.breakpoints[k]}
            onChange={() => s.toggleBreakpoint(k)}
          />{' '}
          {BP_LABEL[k]}
        </label>
      ))}
    </fieldset>
  );
  return (
    <section className="panel controls" aria-label="Execution controls">
      <div className="panel-head">
        <h2>Step through training</h2>
        <ResetExperiment />
      </div>
      {offered.length > 1 ? (
        <fieldset className="granularity">
          <legend>Step size</legend>
          <div className="seg wrap" role="radiogroup" aria-label="Step size (granularity)">
            {offered.map((g) => (
              <button
                data-control={`step-size:${g}`}
                key={g}
                role="radio"
                aria-checked={s.granularity === g}
                aria-keyshortcuts={String(GRANULARITIES.indexOf(g) + 1)}
                className={s.granularity === g ? 'on' : ''}
                onClick={() => s.setGranularity(g)}
                // Expert mode: technical name, with the learner-facing name as secondary text.
                aria-label={expert ? LEVEL_TECHNICAL[g] : undefined}
                title={expert ? LEVEL_LABEL[g] : undefined}
              >
                {expert ? (
                  <>
                    {LEVEL_TECHNICAL[g]}
                    <small className="level-sub">{LEVEL_LABEL[g]}</small>
                  </>
                ) : (
                  LEVEL_LABEL[g]
                )}
              </button>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="small">Each step is {LEVEL_LABEL[offered[0]]}.</p>
      )}

      <div className="buttons">
        <button
          data-control="rewind"
          onClick={() => s.reset()}
          disabled={disabled || s.cursor < 0}
          aria-keyshortcuts="Home"
          title="Back to the start (Home)"
        >
          ⏮ Start
        </button>
        <button
          data-control="back"
          onClick={() => s.step(-1)}
          disabled={disabled || s.cursor < 0}
          aria-keyshortcuts="ArrowLeft"
          title="Step back (←)"
        >
          ◀ Back
        </button>
        <button
          data-control="step"
          className="primary"
          onClick={() => s.step(1)}
          disabled={disabled || atEnd}
          aria-keyshortcuts="ArrowRight"
          title="Step forward (→)"
        >
          Step ▶
        </button>
        <button
          data-control="play"
          onClick={() => s.setPlaying(!s.playing)}
          disabled={disabled || atEnd}
          aria-pressed={s.playing}
          aria-keyshortcuts="Space"
          title="Run / pause (Space)"
        >
          {s.playing ? '❚❚ Pause' : '▶▶ Run'}
        </button>
        <button
          data-control="to-breakpoint"
          onClick={() => s.runToBreakpoint()}
          disabled={disabled || atEnd}
          title="Run until a breakpoint is hit"
        >
          ⇥ To breakpoint
        </button>
      </div>

      <label className="row">
        <span>Speed</span>
        <input
          data-control="speed"
          type="range"
          min={20}
          max={1000}
          step={10}
          value={1020 - s.speedMs}
          onChange={(e) => s.setSpeed(1020 - Number(e.target.value))}
          aria-valuetext={`${Math.round(1000 / s.speedMs)} steps per second`}
        />
      </label>

      <label className="row scrub">
        <span>Position</span>
        <input
          data-control="scrub"
          type="range"
          min={-1}
          max={Math.max(0, s.length - 1)}
          value={s.cursor}
          disabled={disabled}
          onChange={(e) => s.jump(Number(e.target.value))}
          aria-valuetext={`instruction ${s.cursor + 1} of ${s.length}`}
        />
      </label>
      <p className="position" aria-live="off">
        {s.header
          ? `Instruction ${(s.cursor + 1).toLocaleString('en')} / ${s.length.toLocaleString('en')}`
          : 'Generating trace…'}
      </p>

      {expert ? (
        breakpoints
      ) : (
        <details className="more-controls">
          <summary data-control="more-controls">More controls: pause automatically</summary>
          {breakpoints}
        </details>
      )}
      {s.hit && (
        <p className="hit" role="alert">
          ⏸ Paused: {s.hit.reason}.
        </p>
      )}
      <p className="keys">
        Keys: <kbd>←</kbd>/<kbd>→</kbd> step · <kbd>Space</kbd> run/pause · <kbd>1</kbd>–<kbd>6</kbd> step
        size · <kbd>Home</kbd> reset
      </p>
    </section>
  );
}

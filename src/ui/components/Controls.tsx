/** Execution controls: granularity, step, run/pause, speed, reset, scrub, breakpoints. */
import { GRANULARITIES, type Granularity } from '../../core/npm/stats';
import { useLab, type BreakpointToggles } from '../store';

const G_LABEL: Record<Granularity, string> = {
  operation: 'Operation',
  layer: 'Layer',
  phase: 'Phase',
  sample: 'Example',
  batch: 'Batch',
  epoch: 'Epoch',
};

const BP_LABEL: Record<keyof BreakpointToggles, string> = {
  nonFinite: 'NaN or infinity appears',
  vanishing: 'a layer’s gradient vanishes (all |g| < 10⁻⁴)',
  exploding: 'a gradient explodes (any |g| > 10)',
  lossPlateau: 'the epoch loss stops decreasing',
  gradInit: 'back-propagation starts (each example)',
};

export function Controls() {
  const s = useLab();
  const disabled = !s.header || s.generating;
  const atEnd = s.cursor >= s.length - 1;
  return (
    <section className="panel controls" aria-label="Execution controls">
      <h2>Step through training</h2>
      <fieldset className="granularity">
        <legend>Step size</legend>
        <div className="seg wrap" role="radiogroup" aria-label="Step size (granularity)">
          {GRANULARITIES.map((g, k) => (
            <button
              key={g}
              role="radio"
              aria-checked={s.granularity === g}
              aria-keyshortcuts={String(k + 1)}
              className={s.granularity === g ? 'on' : ''}
              onClick={() => s.setGranularity(g)}
            >
              {G_LABEL[g]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="buttons">
        <button
          onClick={() => s.reset()}
          disabled={disabled || s.cursor < 0}
          aria-keyshortcuts="Home"
          title="Reset (Home)"
        >
          ⏮ Reset
        </button>
        <button
          onClick={() => s.step(-1)}
          disabled={disabled || s.cursor < 0}
          aria-keyshortcuts="ArrowLeft"
          title="Step back (←)"
        >
          ◀ Back
        </button>
        <button
          className="primary"
          onClick={() => s.step(1)}
          disabled={disabled || atEnd}
          aria-keyshortcuts="ArrowRight"
          title="Step forward (→)"
        >
          Step ▶
        </button>
        <button
          onClick={() => s.setPlaying(!s.playing)}
          disabled={disabled || atEnd}
          aria-pressed={s.playing}
          aria-keyshortcuts="Space"
          title="Run / pause (Space)"
        >
          {s.playing ? '❚❚ Pause' : '▶▶ Run'}
        </button>
        <button
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

      <fieldset className="breakpoints">
        <legend>Pause automatically when…</legend>
        {(Object.keys(BP_LABEL) as (keyof BreakpointToggles)[]).map((k) => (
          <label key={k} className="check">
            <input type="checkbox" checked={s.breakpoints[k]} onChange={() => s.toggleBreakpoint(k)} />{' '}
            {BP_LABEL[k]}
          </label>
        ))}
      </fieldset>
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

/**
 * The guided screen, generalised from experiment 5's (Fix Round 5, Part 4; ADR-073). Experiment 5's screen is the
 * specification: this template renders its nine elements for any experiment that supplies the parts that differ.
 *
 *  1. the observation the experiment needs (a chart, a strip, a canvas), not a canvas by default;
 *  2. an opening question in large type (NoviceShell);
 *  3. the key parameter as labelled preset buttons, plus typed entry for any value;
 *  4. a prediction attached to the parameter: a new value waits for a prediction, then runs, then is revealed;
 *  5. a plain status line narrating the state;
 *  6. two named ways to run;
 *  7. Going deeper, collecting every advanced affordance;
 *  8. a bridge to the next experiment;
 *  9. clean: no instruction counter, identifiers, scientific notation or undeclared annotations (tests enforce it).
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Granularity } from '../../core/npm/stats';
import type { ExecState } from '../../core/npm/state';
import type { EpochSummary } from '../../core/npm/state';
import type { TraceHeader } from '../../core/npm/ir';
import { paramPresets, paramValue, validateParam } from '../../experiments/params';
import type { EditableParam, Experiment } from '../../experiments/types';
import { num } from '../../explain/format';
import { learnerGloss } from '../../explain/names';
import { TrainingView } from '../../views/training/TrainingView';
import { ParamField } from '../components/ParamField';
import { TryItField } from '../components/Guide';
import { useLab } from '../store';
import { useStartingValues } from '../useStartingValues';
import { ParamEditor } from '../../views/structure/ParamEditor';
import {
  GoingDeeper,
  Handoff,
  NoviceShell,
  PassedOnTheWay,
  Prediction,
  Reveal,
  StepBar,
  useResolve,
  type DeeperItem,
  type PredictionSpec,
} from './common';
import { predictionOf, usePredictions } from './state';

/** What a finished run is judged by, read from its epoch summaries (never from a position the learner has not reached). */
export interface RunSummary {
  value: number | string;
  firstLoss: number;
  finalLoss: number;
  finalAccuracy: number | null;
  /** First weight tensor's gradient size over the last weight tensor's, in the first pass (vanishing gradients). */
  gradRatio: number | null;
}

export function summarise(
  value: number | string,
  epochs: EpochSummary[],
  header: TraceHeader,
): RunSummary | null {
  const first = epochs[0];
  const last = epochs.at(-1);
  if (!first || !last) return null;
  const w = header.model.params.map((p, k) => ({ p, k })).filter(({ p }) => p.role === 'weight');
  const gradRatio =
    w.length > 1
      ? first.gradNorms[w[0].k] / Math.max(first.gradNorms[w[w.length - 1].k], Number.MIN_VALUE)
      : null;
  return {
    value,
    firstLoss: first.evalLoss,
    finalLoss: last.evalLoss,
    finalAccuracy: last.evalAccuracy,
    gradRatio,
  };
}

export interface GuidedSpec {
  question: string;
  /** Index of the key parameter in `exp.editable`. */
  primary: number;
  /** Heading over the preset buttons. */
  primaryTitle: string;
  /** A preset's label, and an optional one-phrase description (and picture) under it. */
  preset(v: number | string): { label: ReactNode; description?: string };
  /** The prediction for a change from one value to another, and how the two runs decide it. */
  predict: {
    question(from: number | string, to: number | string, epochs: number): string;
    options: string[];
    outcome(before: RunSummary, after: RunSummary): number;
    why(outcome: number, before: RunSummary, after: RunSummary): string;
  };
  /** What the learner watches. */
  observe(s: ReturnType<typeof useLab.getState>): ReactNode;
  observeLabel: string;
  /** The status line; the default says what the current step does, where the run is, and how far off it is. */
  narrate?(exec: ExecState | null, header: TraceHeader | null): string;
  /** Before the first step. */
  intro: string;
  levels: Granularity[];
  stepNote?: string;
  watchLabel?: string;
  deeper?: (s: ReturnType<typeof useLab.getState>) => DeeperItem[];
  /** Shown under the presets, before any change has been made. */
  invite?: string;
  /** Prose the observation needs, beside it (for example the slope lesson of experiment 2). */
  lesson?(s: ReturnType<typeof useLab.getState>): ReactNode;
  handoff: string;
}

/** The default status line: the step in a learner's words, the pass and example, and how far off the guess was. */
export function plainStatus(exec: ExecState | null, header: TraceHeader | null, intro: string): string {
  const ins = exec?.current;
  if (!ins || !header) return intro;
  const p = ins.path;
  const where =
    p.epoch === null
      ? ''
      : ` Pass ${p.epoch + 1} of ${header.epochStarts.length - 1}${exec?.sample ? `, training example ${exec.sample.datasetIndex + 1}` : ''}.`;
  const off =
    exec?.sample?.loss !== undefined ? ` How far off this guess was: ${num(exec.sample.loss)}.` : '';
  return `${learnerGloss(header, ins)}${where}${off}`;
}

export function GuidedScreen({ exp, spec }: { exp: Experiment; spec: GuidedSpec }) {
  const s = useLab();
  const records = usePredictions((p) => p.records);
  const param: EditableParam = exp.editable[spec.primary];
  const setting = { config: s.config, dataset: s.dataset, probes: s.probes };
  const now = paramValue(setting, param);
  const ready = !!s.header && !s.generating && s.epochs.length > 0;
  const current = ready ? summarise(now, s.epochs, s.header!) : null;

  // A new value waits for a prediction, then runs; its outcome is decided by the two finished runs.
  const [staged, setStaged] = useState<number | string | null>(null);
  const [trial, setTrial] = useState<{ before: RunSummary; to: number | string } | null>(null);
  const pair =
    staged !== null ? { from: now, to: staged } : trial ? { from: trial.before.value, to: trial.to } : null;
  const pSpec: PredictionSpec | null = pair
    ? {
        id: `choice-${pair.from}-${pair.to}`,
        question: spec.predict.question(pair.from, pair.to, s.config.epochs),
        options: spec.predict.options,
      }
    : null;
  const rec = pSpec ? predictionOf(records, exp.id, pSpec.id) : undefined;
  const stage = (v: number | string): void => {
    if (String(v) === String(now)) return setStaged(null);
    usePredictions.getState().clear(exp.id, `choice-${now}-${v}`);
    setTrial(null);
    setStaged(v);
  };
  useEffect(() => {
    if (staged === null || !rec || !current) return;
    setTrial({ before: current, to: staged });
    setStaged(null);
    void s.applySetting(param, staged);
  }, [staged, rec, current, s, param]);
  const outcome =
    trial && staged === null && current && String(now) === String(trial.to)
      ? spec.predict.outcome(trial.before, current)
      : null;
  useResolve(exp, pSpec ?? { id: 'choice-none', question: '', options: spec.predict.options }, outcome);

  const presets = paramPresets(param);
  const numeric = typeof now === 'number' && param.kind !== 'seed';
  const done = s.exec?.completedEpochs ?? 0;
  const lossSoFar = done > 0 ? (s.epochs[done - 1]?.evalLoss ?? null) : null;
  const accSoFar = done > 0 ? (s.epochs[done - 1]?.evalAccuracy ?? null) : null;
  const status = spec.narrate ? spec.narrate(s.exec, s.header) : plainStatus(s.exec, s.header, spec.intro);
  // Every other parameter; a named choice is offered here too, as a select beside its buttons above.
  const others = exp.editable.map((p, k) => ({ p, k })).filter(({ k }) => k !== spec.primary || !numeric);
  const starting = useStartingValues(s.header);

  return (
    <NoviceShell exp={exp} question={spec.question}>
      <div className="novice-grid">
        <section className="panel novice-controls" aria-label="Your settings">
          <h3>{spec.primaryTitle}</h3>
          <div className="seg choice-presets" role="radiogroup" aria-label={spec.primaryTitle}>
            {presets.map((v) => {
              const p = spec.preset(v);
              const on = String(staged ?? now) === String(v);
              return (
                <button
                  data-control="choice"
                  key={String(v)}
                  role="radio"
                  aria-checked={on}
                  className={`choice${on ? ' on' : ''}`}
                  disabled={s.generating}
                  onClick={() => stage(v)}
                >
                  <span className="choice-label">{p.label}</span>
                  {p.description && <span className="choice-desc small">{p.description}</span>}
                </button>
              );
            })}
          </div>
          {numeric && (
            <ParamField
              param={param}
              control="choice-typed"
              label="…or type any value"
              value={staged ?? now}
              disabled={s.generating}
              validate={(raw) => validateParam(setting, param, raw)}
              onApply={(v) => stage(v)}
            />
          )}
          {staged !== null && pSpec && (
            <Prediction exp={exp} spec={pSpec} hint="Choose one: the new run starts as soon as you do." />
          )}
          {pSpec && staged === null && trial && current && outcome !== null && (
            <Reveal
              exp={exp}
              spec={pSpec}
              outcome={outcome}
              why={spec.predict.why(outcome, trial.before, current)}
            />
          )}
          {staged === null && !trial && (
            <p className="small muted">
              {spec.invite ?? 'Pick a different setting: you will be asked to predict what it does first.'}
            </p>
          )}
        </section>
        <section className="panel novice-observe" aria-label={spec.observeLabel}>
          {s.header ? spec.observe(s) : <p aria-busy="true">Running…</p>}
          {spec.lesson && s.header && <div className="lesson">{spec.lesson(s)}</div>}
          <p className="narration" aria-live="polite">
            {status}
          </p>
          <PassedOnTheWay />
          <StepBar levels={spec.levels} note={spec.stepNote} />
          <div className="learn">
            <button
              data-control="play"
              disabled={!s.header || s.generating}
              onClick={() => s.setPlaying(!s.playing)}
            >
              {s.playing ? '❚❚ Pause' : (spec.watchLabel ?? '▶ Watch it train')}
            </button>
            <button
              data-control="jump-end"
              disabled={!s.header || s.generating}
              onClick={() => void s.jump(s.length - 1)}
            >
              Jump to the end
            </button>
            {/* What is known so far, never the run's final result before the learner gets there (Fix Round 4, A4). */}
            {s.header && (
              <span className="small">
                {lossSoFar === null ? (
                  <>
                    How far off it is overall: <strong>not measured yet</strong>; it is measured at the end of
                    each pass.
                  </>
                ) : (
                  <>
                    After {done} of {s.config.epochs} {s.config.epochs === 1 ? 'pass' : 'passes'}: how far off
                    overall{' '}
                    <strong>
                      {Number.isFinite(lossSoFar) ? num(lossSoFar) : 'not a number (it blew up)'}
                    </strong>
                    {accSoFar !== null && (
                      <>
                        , right on <strong>{num(accSoFar * 100)}%</strong> of the examples
                      </>
                    )}
                  </>
                )}
              </span>
            )}
          </div>
        </section>
      </div>
      <GoingDeeper
        exp={exp}
        items={[
          {
            id: 'numbers',
            label: 'Show the numbers',
            render: () => (
              <table className="outputs">
                <caption>How far off the network was after each pass</caption>
                <thead>
                  <tr>
                    <th scope="col">pass</th>
                    <th scope="col">how far off</th>
                    {done > 0 && s.epochs[0]?.evalAccuracy !== null && <th scope="col">right</th>}
                  </tr>
                </thead>
                <tbody>
                  {s.epochs.slice(Math.max(0, done - 12), done).map((e) => (
                    <tr key={e.epoch}>
                      <td>{e.epoch + 1}</td>
                      <td>{num(e.evalLoss)}</td>
                      {e.evalAccuracy !== null && <td>{num(e.evalAccuracy * 100)}%</td>}
                    </tr>
                  ))}
                  {done === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        Not computed yet: a pass has to finish first.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ),
          },
          ...(spec.deeper ? spec.deeper(s) : []),
          {
            id: 'settings',
            label: 'Change the other settings',
            why: 'Each change restarts the run with exactly that setting.',
            render: () => (
              <>
                {others.map(({ p, k }) => (
                  <TryItField key={k} param={p} k={k} />
                ))}
                {exp.surface.parameterEditor && s.header && (
                  <ParamEditor
                    guided
                    header={s.header}
                    config={s.config}
                    starting={starting}
                    busy={s.generating}
                    onApply={(c) => void s.reconfigure(c)}
                  />
                )}
              </>
            ),
          },
        ]}
      />
      <Handoff text={spec.handoff} />
    </NoviceShell>
  );
}

/** The loss-per-pass chart, as a Going-deeper item. */
export function chartItem(s: ReturnType<typeof useLab.getState>, why: string): DeeperItem {
  return {
    id: 'chart',
    label: 'Add the chart of every pass',
    why,
    render: () =>
      s.header ? (
        <TrainingView
          guided
          header={s.header}
          exec={s.exec}
          epochs={s.epochs}
          onJumpToEpochEnd={(e) => void s.jump(s.header!.epochStarts[e + 1] - 1)}
        />
      ) : null,
  };
}

/** Lower / about the same / higher, for a number where lower is better; 3 when it blew up (if offered). */
export function compareNumber(before: number, after: number, blowUp: boolean): number {
  if (blowUp && (!Number.isFinite(after) || after > 10 * Math.max(before, 1e-9))) return 3;
  if (!Number.isFinite(after)) return 2;
  if (Math.abs(after - before) <= 0.1 * Math.max(Math.abs(after), Math.abs(before)) + 0.005) return 1;
  return after < before ? 0 : 2;
}

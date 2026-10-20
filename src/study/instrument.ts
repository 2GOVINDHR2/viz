/**
 * Connects the tool's store to the telemetry recorder by wrapping its
 * actions. The wrappers call `track`, which does nothing unless a study
 * session is recording, so instrumenting is harmless outside Study Mode.
 */
import { isComplete } from '../experiments/progress';
import { experimentById } from '../experiments/registry';
import { offeredGranularities } from '../experiments/surface';
import { useLab, type LabState } from '../ui/store';
import { track } from './telemetry';

let done = false;

export function instrumentLab(): void {
  if (done) return;
  done = true;
  const o = useLab.getState();
  const s = (): LabState => useLab.getState();
  const wrapped: Partial<LabState> = {
    step: (direction) => {
      // Automatic steps while playing are summarised by the play event instead.
      if (!s().playing) track('step', { granularity: s().granularity, direction, verbosity: s().verbosity });
      return o.step(direction);
    },
    jump: (id) => {
      track('jump', { verbosity: s().verbosity });
      return o.jump(id);
    },
    reset: () => {
      track('reset');
      return o.reset();
    },
    runToBreakpoint: () => {
      track('run_to_breakpoint');
      return o.runToBreakpoint();
    },
    setPlaying: (p) => {
      if (p !== s().playing) track('play', { on: p });
      o.setPlaying(p);
    },
    setGranularity: (g) => {
      if (g !== s().granularity) track('granularity', { granularity: g });
      o.setGranularity(g);
    },
    setVerbosity: (v) => {
      if (v !== s().verbosity) track('explain_open', { verbosity: v, via: 'detail_level' });
      o.setVerbosity(v);
    },
    setMode: (m, remember) => {
      track('mode', { mode: m, from: s().mode });
      o.setMode(m, remember);
    },
    toggleBreakpoint: (k) => {
      track('breakpoint', { kind: k, on: !s().breakpoints[k] });
      o.toggleBreakpoint(k);
    },
    resetExperiment: () => {
      track('reset_experiment', { experiment: s().experimentId });
      return o.resetExperiment();
    },
    reconfigure: (config) => {
      track('param_edit', { experiment: s().experimentId });
      return o.reconfigure(config);
    },
    load: (id) => {
      const r = o.load(id);
      // Which step sizes this screen offers, so used-versus-offered can be summarised.
      track('experiment_start', {
        experiment: id,
        mode: s().mode,
        offered: offeredGranularities(experimentById(id), s().mode).join(' '),
      });
      return r;
    },
    answer: (experimentId, questionId, option) => {
      const before = isComplete(experimentId, s().progress);
      o.answer(experimentId, questionId, option);
      track('self_check', { experiment: experimentId, question: questionId, option });
      if (!before && isComplete(experimentId, s().progress))
        track('experiment_complete', { experiment: experimentId });
    },
    setWalkthrough: (experimentId, step, dismissed) => {
      const prev = s().progress.walkthrough[experimentId] ?? { step: 0, dismissed: false };
      o.setWalkthrough(experimentId, step, dismissed);
      if (dismissed !== prev.dismissed) track('walkthrough', { experiment: experimentId, shown: !dismissed });
      else if (step > prev.step) track('walkthrough_step', { experiment: experimentId, step: step + 1 });
    },
  };
  useLab.setState(wrapped);
}

/** Labels of the panels whose focus counts as a view switch (fixed UI strings, never participant text). */
export function viewOf(target: EventTarget | null): string | null {
  const el = target instanceof Element ? target.closest('section[aria-label], nav[aria-label]') : null;
  return el?.getAttribute('aria-label') ?? null;
}

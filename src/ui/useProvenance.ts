/** Producing and consuming instructions of the current selection, read from the trace in the worker. */
import { useEffect, useState } from 'react';
import type { TraceHeader } from '../core/npm/ir';
import type { ExecState } from '../core/npm/state';
import type { Focus } from '../views/focus';
import { provenance, type Provenance } from '../views/provenance';
import { engineRequest } from './store';

/** Enough instructions to contain the current example from its LOAD_INPUT (one example is far shorter). */
const SAMPLE_WINDOW = 1500;
/** Upper bound on the window for a weight's current version (one batch). */
const MAX_WINDOW = 4000;

export function provenanceWindow(exec: ExecState, focus: Focus): [number, number] {
  const end = exec.cursor + 1;
  let start = Math.max(0, exec.cursor - SAMPLE_WINDOW);
  if (focus.kind === 'edge') {
    const version = exec.params[`${focus.layer}.W`]?.producedBy;
    if (version !== undefined) start = Math.min(start, version);
  }
  return [Math.max(start, end - MAX_WINDOW), end];
}

export function useProvenance(
  header: TraceHeader | null,
  exec: ExecState | null,
  focus: Focus | null,
): Provenance | null | undefined {
  const [p, setP] = useState<Provenance | null | undefined>(undefined);
  useEffect(() => {
    setP(undefined);
    if (!header || !exec || !focus || exec.cursor < 0) {
      setP(null);
      return;
    }
    let live = true;
    const [from, to] = provenanceWindow(exec, focus);
    void engineRequest<'range'>({ op: 'range', from, to }).then((r) => {
      if (live) setP(provenance(header, exec, focus, r.instructions));
    });
    return () => {
      live = false;
    };
  }, [header, exec, focus]);
  return p;
}

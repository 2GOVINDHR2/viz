/** Starting value of every parameter, from the trace's INIT_PARAM instructions (the first P instructions). */
import { useEffect, useState } from 'react';
import type { TraceHeader } from '../core/npm/ir';
import { startingValues } from '../views/structure/ParamEditor';
import { engineRequest } from './store';

export function useStartingValues(header: TraceHeader | null): Record<string, number[]> | null {
  const [v, setV] = useState<Record<string, number[]> | null>(null);
  useEffect(() => {
    setV(null);
    if (!header) return;
    let live = true;
    void engineRequest<'range'>({ op: 'range', from: 0, to: header.model.params.length }).then(
      (r) => live && setV(startingValues(r.instructions)),
    );
    return () => {
      live = false;
    };
  }, [header]);
  return v;
}

/** The inspector with its selection's provenance read from the trace (both workbench and novice screens). */
import { useMemo } from 'react';
import type { TraceHeader } from '../core/npm/ir';
import type { ExecState } from '../core/npm/state';
import { Inspector } from '../views/execution/Inspector';
import type { Focus } from '../views/focus';
import { useProvenance } from './useProvenance';

export function BoundInspector({
  header,
  exec,
  focus,
  onClear,
}: {
  header: TraceHeader;
  exec: ExecState | null;
  focus: Focus | null;
  onClear(): void;
}) {
  // Keyed on the selection's content, so a new but equal focus object does not refetch.
  const key = focus ? JSON.stringify(focus) : '';
  const stable = useMemo(() => (key ? (JSON.parse(key) as Focus) : null), [key]);
  const provenance = useProvenance(header, exec, stable);
  return <Inspector header={header} exec={exec} focus={stable} onClear={onClear} provenance={provenance} />;
}

import type { Dataset } from '../../src/core/engine/data';
import type { TrainConfig } from '../../src/core/engine/session';
import { TraceStore } from '../../src/core/npm';
import { ARCHITECTURES } from '../parity/architectures';

/** A short run of every planned architecture (plus momentum/SGD variants) for trace-level tests. */
export function architectureTraces(
  epochs = 2,
): { id: string; config: TrainConfig; data: Dataset; store: TraceStore }[] {
  return ARCHITECTURES.map((a) => {
    const data = a.data();
    const config: TrainConfig = { ...a.config, epochs, boundaryGrid: 6 };
    return { id: a.id, config, data, store: TraceStore.generate(config, data).store };
  });
}

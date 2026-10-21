/**
 * Drives the real application store in Node with the engine in-process, for
 * the Fix Round 2b invariants and the fuzzer. The worker boundary is replaced
 * by a direct call into EngineHost (which the worker only forwards to).
 */
import { createHash } from 'node:crypto';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EngineHost, registerAsset, resolveDataset } from '../../src/core/engine/host';
import type { Reply, Request } from '../../src/core/engine/protocol';
import type { TrainConfig } from '../../src/core/engine/session';
import { TraceStore, storeSource, type TraceSource } from '../../src/core/npm';
import { loadMnist } from '../../src/experiments/data/mnist';
import { emptyProgress } from '../../src/experiments/progress';
import { experimentById } from '../../src/experiments/registry';
import type { Mode } from '../../src/experiments/surface';
import { App } from '../../src/ui/App';
import type { EngineClient } from '../../src/ui/engineClient';
import { usePredictions } from '../../src/ui/novice/state';
import { renderCurrentState, setEngineClient, useLab } from '../../src/ui/store';

registerAsset('mnist-012', loadMnist);

export const host = new EngineHost();
const client: EngineClient = {
  request: async <R extends Reply['op']>(req: Request) => host.handle(req) as Extract<Reply, { op: R }>,
  dispose: () => undefined,
};
setEngineClient(client);

export const lab = () => useLab.getState();

// Static renders show the screens as they are now, not as at store creation.
renderCurrentState();

/** Opens an experiment from scratch in the given mode, with no progress or predictions carried over. */
export async function open(id: string, mode: Mode): Promise<void> {
  usePredictions.setState({ records: {} });
  useLab.setState({ progress: emptyProgress(), focus: null, playing: false });
  lab().setMode(mode, false);
  await lab().load(id);
  if (lab().error) throw new Error(lab().error!);
}

export const renderApp = (): string => renderToStaticMarkup(createElement(App));

/** SHA-256 over the whole trace: header, and every instruction with its operands, metadata and result bytes. */
export function traceHash(src: TraceSource): string {
  const h = createHash('sha256');
  h.update(JSON.stringify(src.header));
  let id = 0;
  while (id < src.length) {
    const [, end] = src.segmentBounds(id);
    for (const ins of src.range(id, end)) {
      h.update(JSON.stringify([ins.id, ins.kind, ins.path, ins.meta, ins.operands, ins.symbolic]));
      for (const [slot, t] of Object.entries(ins.results)) {
        h.update(`${slot}:${t.shape.join('x')}`);
        h.update(new Uint8Array(t.data.buffer, t.data.byteOffset, t.data.byteLength));
      }
    }
    id = end;
  }
  return h.digest('hex');
}

/** The trace a fresh run of this configuration produces, independently of the store. */
export function freshSource(id: string, config: TrainConfig): TraceSource {
  return storeSource(TraceStore.generate(config, resolveDataset(experimentById(id).dataset)).store);
}

export function currentSource(): TraceSource {
  const s = host.source;
  if (!s) throw new Error('no trace in the engine');
  return s;
}

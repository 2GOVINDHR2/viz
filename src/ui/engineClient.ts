/** Promise-based client for the engine worker. Requests are answered in order; each carries an id. */
import {
  fromWire,
  toWire,
  type Envelope,
  type ErrorReply,
  type Reply,
  type Request,
} from '../core/engine/protocol';

export interface EngineClient {
  request<R extends Reply['op']>(req: Request): Promise<Extract<Reply, { op: R }>>;
  dispose(): void;
}

export function createEngineClient(): EngineClient {
  const worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
  let next = 1;
  const pending = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void }>();
  worker.onmessage = (e: MessageEvent<Envelope<unknown> | ErrorReply>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if ('error' in e.data) p.reject(new Error(e.data.error));
    else p.resolve(fromWire<Reply>(e.data.body));
  };
  worker.onerror = (e) => {
    for (const p of pending.values()) p.reject(new Error(e.message || 'engine worker failed'));
    pending.clear();
  };
  return {
    request: <R extends Reply['op']>(req: Request) =>
      new Promise<Extract<Reply, { op: R }>>((resolve, reject) => {
        const id = next++;
        pending.set(id, { resolve: resolve as (r: Reply) => void, reject });
        worker.postMessage({ id, body: toWire(req) } satisfies Envelope<unknown>);
      }),
    dispose: () => worker.terminate(),
  };
}

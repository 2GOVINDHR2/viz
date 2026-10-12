/// <reference lib="webworker" />
import { EngineHost } from '../core/engine/host';
import { toWire, type Envelope } from '../core/engine/protocol';
import type { Request } from '../core/engine/protocol';

const host = new EngineHost();

self.onmessage = (e: MessageEvent<Envelope<Request>>) => {
  const { id, body } = e.data;
  try {
    (self as unknown as Worker).postMessage({ id, body: toWire(host.handle(body)) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};

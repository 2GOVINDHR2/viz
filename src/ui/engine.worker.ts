/// <reference lib="webworker" />
import { EngineHost, registerAsset } from '../core/engine/host';
import { toWire, type Envelope } from '../core/engine/protocol';
import type { Request } from '../core/engine/protocol';

const host = new EngineHost();

/** Large datasets are code-split and loaded on first use, so other experiments never download them. */
async function ensureAssets(req: Request): Promise<void> {
  const spec = req.op === 'generate' ? req.dataset : req.op === 'compareRuns' ? req.dataset : null;
  if (spec?.kind === 'asset' && spec.name === 'mnist-012') {
    const { loadMnist } = await import('../experiments/data/mnist');
    registerAsset('mnist-012', loadMnist);
  }
}

self.onmessage = async (e: MessageEvent<Envelope<Request>>) => {
  const { id, body } = e.data;
  try {
    await ensureAssets(body);
    (self as unknown as Worker).postMessage({ id, body: toWire(host.handle(body)) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};

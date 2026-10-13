/// <reference lib="webworker" />
import { EngineHost, registerAsset } from '../core/engine/host';
import { toWire, type Envelope } from '../core/engine/protocol';
import type { Reply, Request } from '../core/engine/protocol';

const host = new EngineHost();

/** Large datasets are code-split and loaded on first use, so other experiments never download them. */
async function ensureAssets(req: Request): Promise<void> {
  const spec = req.op === 'generate' ? req.dataset : req.op === 'compareRuns' ? req.dataset : null;
  if (spec?.kind === 'asset' && spec.name === 'mnist-012') {
    const { loadMnist } = await import('../experiments/data/mnist');
    registerAsset('mnist-012', loadMnist);
  }
}

/** Figure export runs here, next to the full trace; its code (and the React server renderer) loads on first use. */
async function figures(req: Extract<Request, { op: 'figures' }>): Promise<Reply> {
  const src = host.source;
  if (!src) throw new Error('no trace generated yet');
  const { figureSet } = await import('../export/figures');
  return { op: 'figures', figures: figureSet(src, { mode: req.mode, captions: req.captions }, req.cursor) };
}

self.onmessage = async (e: MessageEvent<Envelope<Request>>) => {
  const { id, body } = e.data;
  try {
    await ensureAssets(body);
    const reply = body.op === 'figures' ? await figures(body) : host.handle(body);
    (self as unknown as Worker).postMessage({ id, body: toWire(reply) });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};

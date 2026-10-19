/** Applies one learner edit to a configuration, producing a new configuration (never mutating). */
import type { TrainConfig } from '../core/engine/session';
import type { Activation, LayerConfig } from '../core/layers/model';
import type { LossName } from '../core/losses/losses';
import type { EditableParam } from './types';

/** BCE needs a sigmoid output and MSE pairs with any; switching loss keeps the output valid. */
function withLoss(c: TrainConfig, loss: LossName): TrainConfig {
  return { ...c, loss };
}

export function applyEdit(config: TrainConfig, edit: EditableParam, value: number | string): TrainConfig {
  const layers = config.model.layers.map((l) => ({ ...l })) as LayerConfig[];
  const hidden = layers.length - 1;
  switch (edit.kind) {
    case 'learningRate':
      return { ...config, optimizer: { ...config.optimizer, lr: Number(value) } };
    case 'loss':
      return withLoss(config, value as LossName);
    case 'activation': {
      const targets = edit.layer === -1 ? layers.slice(0, hidden).map((_, k) => k) : [edit.layer];
      for (const k of targets) {
        const l = layers[k];
        // Re-derive the initialiser from the new activation (He for ReLU, Glorot otherwise).
        if (l.type === 'dense' || l.type === 'conv2d')
          layers[k] = { ...l, activation: value as Activation, init: undefined };
      }
      return { ...config, model: { ...config.model, layers } };
    }
    case 'hiddenUnits': {
      const l = layers[edit.layer];
      if (l.type === 'dense') layers[edit.layer] = { ...l, units: Number(value) };
      // Chosen starting values no longer fit a resized layer.
      return { ...config, initialParams: undefined, model: { ...config.model, layers } };
    }
    case 'batchSize':
      return { ...config, batchSize: Number(value) };
    case 'initialValue': {
      const current = config.initialParams?.[edit.param];
      if (!current) throw new Error(`experiment has no starting values for ${edit.param}`);
      const next = [...current];
      next[edit.index] = Number(value);
      return { ...config, initialParams: { ...config.initialParams, [edit.param]: next } };
    }
  }
}

/** Current value of an editable parameter in a configuration. */
export function editValue(config: TrainConfig, edit: EditableParam): number | string {
  switch (edit.kind) {
    case 'learningRate':
      return config.optimizer.lr;
    case 'loss':
      return config.loss;
    case 'activation': {
      const l = config.model.layers[edit.layer === -1 ? 0 : edit.layer];
      return l.type === 'dense' || l.type === 'conv2d' ? l.activation : '';
    }
    case 'hiddenUnits': {
      const l = config.model.layers[edit.layer];
      return l.type === 'dense' ? l.units : 0;
    }
    case 'batchSize':
      return config.batchSize;
    case 'initialValue':
      return config.initialParams?.[edit.param]?.[edit.index] ?? 0;
  }
}

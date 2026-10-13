/**
 * P5 exit criterion: every view renders from a trace file alone. The trace is
 * read from disk and navigated with an in-memory source; no TrainingSession,
 * TraceStore or engine object is constructed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { TrainConfig } from '../../src/core/engine/session';
import { deserializeTrace, epochSummaries, memorySource, reconstructState } from '../../src/core/npm';
import { Inspector } from '../../src/views/execution/Inspector';
import { NetworkView } from '../../src/views/execution/NetworkView';
import { StructureView } from '../../src/views/structure/StructureView';
import { TrainingView } from '../../src/views/training/TrainingView';

const trace = deserializeTrace(
  readFileSync(resolve(import.meta.dirname, '../../samples/xor-mlp.trace.json'), 'utf8'),
);
const src = memorySource(trace);

describe('views render from the trace alone', () => {
  for (const cursor of [-1, 10, 25, 60, src.length - 1]) {
    it(`cursor ${cursor}`, () => {
      const exec = reconstructState(src, cursor);
      const header = src.header;
      const html = [
        renderToStaticMarkup(
          createElement(NetworkView, {
            header,
            exec,
            focus: { kind: 'unit', layer: 'L1', index: 1 },
            onFocus: () => undefined,
          }),
        ),
        renderToStaticMarkup(
          createElement(TrainingView, {
            header,
            exec,
            epochs: epochSummaries(src),
            onJumpToEpochEnd: () => undefined,
          }),
        ),
        renderToStaticMarkup(
          createElement(StructureView, {
            header,
            exec,
            config: header.config as TrainConfig,
            defaults: header.config as TrainConfig,
            busy: false,
            onReconfigure: () => undefined,
          }),
        ),
        renderToStaticMarkup(
          createElement(Inspector, {
            header,
            exec,
            focus: { kind: 'edge', layer: 'L2', i: 0, j: 0 },
            onClear: () => undefined,
          }),
        ),
      ].join('');
      expect(html).toContain('Network diagram');
      expect(html).toContain('Training so far');
      expect(html).toContain('Network structure');
      expect(html).not.toMatch(/NaN|undefined/);
      if (cursor === src.length - 1) expect(html).toContain('2 of 2 epochs complete');
    });
  }
});

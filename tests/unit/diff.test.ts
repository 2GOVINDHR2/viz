import { describe, expect, it } from 'vitest';
import { reconstructState, stepForward, storeSource } from '../../src/core/npm';
import { describeChanges } from '../../src/explain';
import { architectureTraces } from '../support/traces';

describe('what changed since the previous step', () => {
  const t = architectureTraces(1).find((x) => x.id === 'mlp-xor')!;
  const src = storeSource(t.store);

  it('names a parameter update with its largest element change', () => {
    const upd = src.range(0, src.length).find((i) => i.kind === 'APPLY_UPDATE')!;
    const lines = describeChanges(
      src.header,
      reconstructState(src, upd.id - 1),
      reconstructState(src, upd.id),
    );
    expect(lines.join(' ')).toMatch(
      new RegExp(`${String(upd.meta.param).replace('.', '\\.')} changed: the largest change is`),
    );
  });

  it('reports newly computed layer quantities and the loss', () => {
    const loss = src.range(0, src.length).find((i) => i.kind === 'COMPUTE_LOSS')!;
    const lines = describeChanges(
      src.header,
      reconstructState(src, loss.id - 1),
      reconstructState(src, loss.id),
    );
    expect(lines.some((l) => l.startsWith('Example loss'))).toBe(true);
    const fwd = stepForward(src, loss.id, 'operation');
    expect(
      describeChanges(src.header, reconstructState(src, loss.id), reconstructState(src, fwd)).join(' '),
    ).toMatch(/now known/);
  });

  it('says the state is restored when stepping back', () => {
    const lines = describeChanges(src.header, reconstructState(src, 30), reconstructState(src, 20));
    expect(lines[0]).toMatch(/restored exactly/);
  });

  it('summarises an image input by size and range instead of listing every pixel', () => {
    const cnn = architectureTraces(1).find((x) => x.id === 'cnn')!;
    const c = storeSource(cnn.store);
    const load = c.range(0, c.length).find((i) => i.kind === 'LOAD_INPUT')!;
    const line = describeChanges(
      c.header,
      reconstructState(c, load.id - 1),
      reconstructState(c, load.id),
    ).find((l) => l.startsWith('A new example'))!;
    expect(line).toMatch(/x has \d+ values between/);
    expect(line.length).toBeLessThan(120);
  });
});

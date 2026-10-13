import Ajv2020 from 'ajv/dist/2020';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as D from '../../src/core/engine/datasets';
import {
  BUILTIN_KINDS,
  TraceStore,
  conformsToGrammar,
  kindSequence,
  deserializeTrace,
  registeredKinds,
  serializeTrace,
  type Trace,
} from '../../src/core/npm';
import { buildTraceSchema } from '../../src/core/npm/schema';
import { Tensor } from '../../src/core/tensor/tensor';
// @ts-expect-error — plain-JS tool with no type declarations, by design (it must not share code with src/).
import { verifyTrace } from '../../tools/npm-verify.mjs';
import { architectureTraces } from '../support/traces';

const ROOT = resolve(import.meta.dirname, '../..');
const traces = architectureTraces(2);
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validate = ajv.compile(JSON.parse(readFileSync(resolve(ROOT, 'src/core/npm/schema.json'), 'utf8')));

describe('Neural Program Model', () => {
  it('committed schema.json is generated from the current kind registry', () => {
    const committed = JSON.parse(readFileSync(resolve(ROOT, 'src/core/npm/schema.json'), 'utf8'));
    expect(committed).toEqual(JSON.parse(JSON.stringify(buildTraceSchema())));
  });

  it('every built-in instruction kind is registered and emitted by at least one planned architecture', () => {
    const registered = new Set(registeredKinds().map((k) => k.kind));
    const all = Object.values(BUILTIN_KINDS).flat();
    for (const k of all) expect(registered.has(k), k).toBe(true);
    const emitted = new Set(traces.flatMap((t) => t.store.toTrace().instructions.map((i) => i.kind)));
    expect(all.filter((k) => !emitted.has(k))).toEqual([]);
  });

  for (const t of traces) {
    describe(t.id, () => {
      const trace = t.store.toTrace();
      const json = serializeTrace(trace);

      it('conforms to the trace grammar (NPM-SPEC §3)', () => {
        expect(conformsToGrammar(trace.instructions), kindSequence(trace.instructions).slice(0, 200)).toBe(
          true,
        );
      });

      it('validates against the JSON schema', () => {
        const ok = validate(JSON.parse(json));
        expect(validate.errors?.slice(0, 3) ?? []).toEqual([]);
        expect(ok).toBe(true);
      });

      it('round-trips losslessly (bytes and every float64 value)', () => {
        const back = deserializeTrace(json);
        expect(serializeTrace(back)).toBe(json);
        back.instructions.forEach((ins, k) => {
          for (const [slot, v] of Object.entries(ins.results)) {
            const orig = trace.instructions[k].results[slot];
            expect(v.shape).toEqual(orig.shape);
            expect(v.data.every((x, i) => Object.is(x, orig.data[i]))).toBe(true);
          }
        });
      });

      it('is re-derived instruction by instruction by the independent verifier', () => {
        expect(verifyTrace(JSON.parse(json))).toEqual([]);
      });

      it('regenerates every segment byte-identically from its checkpoint', () => {
        for (const seg of t.store.segments) {
          const again = t.store.regenerate(seg.index);
          const cached = trace.instructions.slice(seg.start, seg.end);
          expect(serializeTrace({ header: trace.header, instructions: again })).toBe(
            serializeTrace({ header: trace.header, instructions: cached }),
          );
        }
      });

      it('has a dense id sequence, backward-pointing operands and a consistent epoch index', () => {
        trace.instructions.forEach((ins, k) => {
          expect(ins.id).toBe(k);
          for (const o of ins.operands) {
            expect(o.ref).toBeLessThan(ins.id);
            expect(
              trace.instructions[o.ref].results[o.slot],
              `${ins.kind}#${ins.id} → ${o.ref}.${o.slot}`,
            ).toBeDefined();
          }
        });
        for (const s of trace.header.epochStarts.slice(0, -1))
          expect(trace.instructions[s].kind).toBe('EPOCH_BEGIN');
        expect(trace.header.epochStarts.at(-1)).toBe(trace.instructions.length);
      });
    });
  }

  it('the verifier rejects a tampered trace (it is not vacuous)', () => {
    const raw = JSON.parse(serializeTrace(traces[2].store.toTrace()));
    const matmul = raw.instructions.find((i: { kind: string }) => i.kind === 'GRAD_MATMUL_W');
    matmul.results.grad.data[0] += 1e-3;
    expect(verifyTrace(raw).length).toBeGreaterThan(0);
  });

  it('the grammar rejects malformed sequences', () => {
    const ins = traces[2].store.toTrace().instructions;
    const withoutLossReduce = ins.filter((i) => i.kind !== 'LOSS_REDUCE');
    const swapped = [...ins];
    const k = swapped.findIndex((i) => i.kind === 'COMPUTE_LOSS');
    [swapped[k], swapped[k + 1]] = [swapped[k + 1], swapped[k]];
    expect(conformsToGrammar(withoutLossReduce)).toBe(false);
    expect(conformsToGrammar(swapped)).toBe(false);
  });

  it('encodes NaN, ±Infinity and −0 losslessly', () => {
    const trace = traces[0].store.toTrace();
    const special = Tensor.from([5], [NaN, Infinity, -Infinity, -0, 0]);
    const tampered: Trace = {
      ...trace,
      instructions: [{ ...trace.instructions[0], results: { value: special } }],
    };
    const back = deserializeTrace(serializeTrace(tampered)).instructions[0].results.value;
    expect(Array.from(back.data).map((v) => (Object.is(v, -0) ? '-0' : String(v)))).toEqual([
      'NaN',
      'Infinity',
      '-Infinity',
      '-0',
      '0',
    ]);
  });

  it('stays within a small memory budget by evicting and regenerating segments', () => {
    const config = traces[2].config;
    const budget = 40_000;
    const { store } = TraceStore.generate({ ...config, epochs: 30 }, D.xor(), { budgetBytes: budget });
    const largest = Math.max(...store.segments.map((s) => s.bytes));
    expect(store.stats().cachedBytes).toBeLessThanOrEqual(budget + largest);
    const { store: full } = TraceStore.generate({ ...config, epochs: 30 }, D.xor(), {
      budgetBytes: Infinity,
    });
    for (const id of [0, 5, store.length - 1, Math.floor(store.length / 2), 17, store.length - 40]) {
      expect(serializeTrace({ header: store.header, instructions: [store.get(id)] })).toBe(
        serializeTrace({ header: full.header, instructions: [full.get(id)] }),
      );
    }
    const s = store.stats();
    expect(s.regenerations).toBeGreaterThan(0);
    expect(s.cachedBytes).toBeLessThanOrEqual(budget + largest);
  });
});

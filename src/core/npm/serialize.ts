/**
 * Lossless JSON encoding of traces.
 *
 * Tensors become { shape, data }. Finite numbers are written with
 * ECMAScript's shortest round-trip formatting, which is exact for float64 and
 * identical across conforming engines. Values JSON cannot represent are
 * written as strings: "NaN", "Infinity", "-Infinity" and "-0" (plain JSON
 * would silently turn −0 into 0, which is not lossless).
 */
import { Tensor } from '../tensor/tensor';
import type { Instruction, Trace, TraceHeader } from './ir';

export type EncodedNumber = number | 'NaN' | 'Infinity' | '-Infinity' | '-0';
export interface EncodedTensor {
  shape: number[];
  data: EncodedNumber[];
}

export function encodeNumber(v: number): EncodedNumber {
  if (Number.isNaN(v)) return 'NaN';
  if (v === Infinity) return 'Infinity';
  if (v === -Infinity) return '-Infinity';
  if (Object.is(v, -0)) return '-0';
  return v;
}

export function decodeNumber(v: EncodedNumber): number {
  switch (v) {
    case 'NaN':
      return NaN;
    case 'Infinity':
      return Infinity;
    case '-Infinity':
      return -Infinity;
    case '-0':
      return -0;
    default:
      return v;
  }
}

export const encodeTensor = (t: Tensor): EncodedTensor => ({
  shape: [...t.shape],
  data: Array.from(t.data, encodeNumber),
});
export const decodeTensor = (e: EncodedTensor): Tensor => Tensor.from(e.shape, e.data.map(decodeNumber));

function encodeInstruction(i: Instruction): unknown {
  const results: Record<string, EncodedTensor> = {};
  for (const [k, t] of Object.entries(i.results)) results[k] = encodeTensor(t);
  return {
    id: i.id,
    kind: i.kind,
    path: i.path,
    operands: i.operands,
    results,
    meta: i.meta,
    symbolic: i.symbolic,
  };
}

function encodeHeader(h: TraceHeader): unknown {
  return {
    ...h,
    dataset: {
      ...h.dataset,
      xs: h.dataset.xs && encodeTensor(h.dataset.xs),
      ys: h.dataset.ys && encodeTensor(h.dataset.ys),
    },
  };
}

/** Key order is fixed by construction, so equal traces serialise to equal bytes. */
export function serializeTrace(t: Trace, indent?: number): string {
  return JSON.stringify(
    { header: encodeHeader(t.header), instructions: t.instructions.map(encodeInstruction) },
    null,
    indent,
  );
}

interface RawInstruction extends Omit<Instruction, 'results'> {
  results: Record<string, EncodedTensor>;
}
interface RawTrace {
  header: Omit<TraceHeader, 'dataset'> & {
    dataset: Omit<TraceHeader['dataset'], 'xs' | 'ys'> & {
      xs: EncodedTensor | null;
      ys: EncodedTensor | null;
    };
  };
  instructions: RawInstruction[];
}

export function deserializeTrace(json: string): Trace {
  const raw = JSON.parse(json) as RawTrace;
  if (raw.header?.format !== 'npm-trace') throw new Error('not an NPM trace');
  const header: TraceHeader = {
    ...raw.header,
    dataset: {
      ...raw.header.dataset,
      xs: raw.header.dataset.xs && decodeTensor(raw.header.dataset.xs),
      ys: raw.header.dataset.ys && decodeTensor(raw.header.dataset.ys),
    },
  };
  const instructions = raw.instructions.map((r): Instruction => {
    const results: Record<string, Tensor> = {};
    for (const [k, e] of Object.entries(r.results)) results[k] = decodeTensor(e);
    return {
      id: r.id,
      kind: r.kind,
      path: r.path,
      operands: r.operands,
      results,
      meta: r.meta,
      symbolic: r.symbolic,
    };
  });
  return { header, instructions };
}

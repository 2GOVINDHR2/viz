/**
 * Builds the JSON Schema for the trace format from the instruction-kind
 * registry, so registering a kind automatically extends the schema.
 * `schema.json` is the committed output; a test asserts it is up to date.
 */
import { PHASES } from './ir';
import { registeredKinds } from './kinds';

export function buildTraceSchema(): Record<string, unknown> {
  const kinds = registeredKinds();
  const num = { oneOf: [{ type: 'number' }, { enum: ['NaN', 'Infinity', '-Infinity', '-0'] }] };
  const tensor = {
    type: 'object',
    required: ['shape', 'data'],
    additionalProperties: false,
    properties: {
      shape: { type: 'array', items: { type: 'integer', minimum: 0 } },
      data: { type: 'array', items: { $ref: '#/$defs/number' } },
    },
  };
  const level = { type: ['integer', 'null'], minimum: 0 };
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://dl-vizlab.example/npm-trace.schema.json',
    title: 'Neural Program Model trace',
    description: 'A complete, replayable record of one neural-network training run. See docs/NPM-SPEC.md.',
    type: 'object',
    required: ['header', 'instructions'],
    additionalProperties: false,
    $defs: {
      number: num,
      tensor,
      path: {
        type: 'object',
        required: ['epoch', 'batch', 'sample', 'phase', 'layer'],
        additionalProperties: false,
        properties: {
          epoch: level,
          batch: level,
          sample: level,
          phase: { enum: [...PHASES] },
          layer: { type: ['string', 'null'], pattern: '^L[1-9][0-9]*$' },
        },
      },
      operand: {
        type: 'object',
        required: ['ref', 'slot', 'role'],
        additionalProperties: false,
        properties: {
          ref: { type: 'integer', minimum: 0 },
          slot: { type: 'string' },
          role: { type: 'string' },
        },
      },
      instruction: {
        type: 'object',
        required: ['id', 'kind', 'path', 'operands', 'results', 'meta', 'symbolic'],
        additionalProperties: false,
        properties: {
          id: { type: 'integer', minimum: 0 },
          kind: { enum: kinds.map((k) => k.kind) },
          path: { $ref: '#/$defs/path' },
          operands: { type: 'array', items: { $ref: '#/$defs/operand' } },
          results: { type: 'object', additionalProperties: { $ref: '#/$defs/tensor' } },
          meta: {
            type: 'object',
            additionalProperties: {
              oneOf: [
                { type: ['string', 'number', 'boolean', 'null'] },
                { type: 'array', items: { type: 'number' } },
                { type: 'array', items: { type: 'string' } },
              ],
            },
          },
          symbolic: { type: 'string', minLength: 1 },
        },
        allOf: kinds.map((k) => ({
          if: { properties: { kind: { const: k.kind } } },
          then: {
            properties: {
              path: { properties: { phase: { const: k.phase } } },
              results: { required: [...k.results] },
            },
          },
        })),
      },
    },
    properties: {
      header: {
        type: 'object',
        required: [
          'format',
          'version',
          'generator',
          'seed',
          'config',
          'model',
          'dataset',
          'length',
          'epochStarts',
        ],
        additionalProperties: false,
        properties: {
          format: { const: 'npm-trace' },
          version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
          generator: { type: 'string' },
          seed: { type: 'integer' },
          config: { type: 'object' },
          model: {
            type: 'object',
            required: ['inputShape', 'outputShape', 'layers', 'params'],
            properties: {
              inputShape: { type: 'array', items: { type: 'integer' } },
              outputShape: { type: 'array', items: { type: 'integer' } },
              layers: { type: 'array' },
              params: { type: 'array' },
            },
          },
          dataset: {
            type: 'object',
            required: ['name', 'n', 'inputShape', 'classes', 'xs', 'ys'],
            properties: {
              xs: { oneOf: [{ $ref: '#/$defs/tensor' }, { type: 'null' }] },
              ys: { oneOf: [{ $ref: '#/$defs/tensor' }, { type: 'null' }] },
            },
          },
          length: { type: 'integer', minimum: 0 },
          epochStarts: { type: 'array', items: { type: 'integer', minimum: 0 } },
        },
      },
      instructions: { type: 'array', items: { $ref: '#/$defs/instruction' } },
    },
  };
}

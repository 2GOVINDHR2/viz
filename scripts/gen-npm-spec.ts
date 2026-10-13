/**
 * Regenerates the data-derived sections of docs/NPM-SPEC.md: the instruction
 * table (operand roles, result slots and metadata keys as actually emitted by
 * every planned architecture) and the measured memory trade-off.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BUILTIN_KINDS, TraceStore, kindSpec } from '../src/core/npm';
import { ARCHITECTURES } from '../tests/parity/architectures';
import { fmtBytes, mdTable, replaceGenerated } from './docs-util';

const SPEC = resolve(import.meta.dirname, '../docs/NPM-SPEC.md');
const seen = new Map<
  string,
  { roles: Set<string>; results: Set<string>; meta: Set<string>; example: string; count: number }
>();
for (const a of ARCHITECTURES) {
  const { store } = TraceStore.generate({ ...a.config, epochs: 1, boundaryGrid: 4 }, a.data());
  for (const i of store.toTrace().instructions) {
    const s = seen.get(i.kind) ?? {
      roles: new Set(),
      results: new Set(),
      meta: new Set(),
      example: i.symbolic,
      count: 0,
    };
    i.operands.forEach((o) => s.roles.add(o.role));
    Object.keys(i.results).forEach((r) => s.results.add(r));
    Object.keys(i.meta).forEach((m) => s.meta.add(m));
    s.count++;
    seen.set(i.kind, s);
  }
}
const code = (xs: Iterable<string>): string => [...xs].map((x) => `\`${x}\``).join(', ') || '—';
const groups: [string, readonly string[]][] = Object.entries(BUILTIN_KINDS);
const tables = groups
  .map(([group, kinds]) => {
    const rows = kinds.map((k) => {
      const s = seen.get(k)!;
      const spec = kindSpec(k);
      return [
        `\`${k}\``,
        spec.phase,
        code(s.roles),
        code(s.results),
        code(s.meta),
        `\`${s.example}\``,
        spec.summary,
      ];
    });
    return `**${group[0].toUpperCase()}${group.slice(1)}**\n\n${mdTable(['Kind', 'Phase', 'Operand roles', 'Result slots', 'Metadata keys', 'Symbolic form (example)', 'Meaning'], rows)}`;
  })
  .join('\n\n');
replaceGenerated(SPEC, 'instruction-table', tables);

const mem = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../reports/memory.json'), 'utf8'),
) as Record<string, number | string>[];
replaceGenerated(
  SPEC,
  'memory-table',
  mdTable(
    [
      'Run',
      'Instructions',
      'Cache budget',
      'Full trace',
      'Resident (cache + checkpoints)',
      'Random access',
      'Sequential step back',
      'Generation',
    ],
    mem.map((r) => [
      String(r.run),
      Number(r.instructions).toLocaleString('en'),
      `${Number(r.budgetFraction) * 100}%`,
      fmtBytes(Number(r.fullBytes)),
      `${fmtBytes(Number(r.residentBytes))} (${((100 * Number(r.residentBytes)) / Number(r.fullBytes)).toFixed(1)}%)`,
      `${r.randomAccessMs} ms`,
      `${r.sequentialBackStepMs} ms`,
      `${r.generationMs} ms`,
    ]),
  ),
);
console.log('NPM-SPEC.md generated sections updated');

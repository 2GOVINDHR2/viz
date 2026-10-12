import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

/** Merges `rows` into reports/<name>.json keyed by row id, so suites can append independently. */
export function recordResults<T extends { id: string }>(name: string, rows: T[]): void {
  const file = resolve(ROOT, 'reports', `${name}.json`);
  mkdirSync(dirname(file), { recursive: true });
  const existing: Record<string, T> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  for (const r of rows) existing[r.id] = r;
  const sorted = Object.fromEntries(Object.entries(existing).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
}

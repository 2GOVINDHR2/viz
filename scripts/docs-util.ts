import { readFileSync, writeFileSync } from 'node:fs';

/** Replaces the text between <!-- BEGIN GENERATED: name --> and <!-- END GENERATED: name --> in a markdown file. */
export function replaceGenerated(file: string, name: string, body: string): void {
  const src = readFileSync(file, 'utf8');
  const begin = `<!-- BEGIN GENERATED: ${name} -->`;
  const end = `<!-- END GENERATED: ${name} -->`;
  const a = src.indexOf(begin);
  const b = src.indexOf(end);
  if (a < 0 || b < 0) throw new Error(`markers for ${name} not found in ${file}`);
  writeFileSync(file, src.slice(0, a + begin.length) + '\n' + body.trim() + '\n' + src.slice(b));
}

export const mdTable = (head: string[], rows: (string | number)[][]): string =>
  [
    `| ${head.join(' | ')} |`,
    `|${head.map(() => '---').join('|')}|`,
    ...rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n');

export const fmtBytes = (n: number): string =>
  n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(2)} MiB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KiB` : `${n} B`;

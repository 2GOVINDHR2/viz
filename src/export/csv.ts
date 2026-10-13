/** RFC 4180 CSV: comma separator, CRLF rows, quotes doubled, empty cell for null. */
export type Cell = string | number | null | undefined;

const cell = (v: Cell): string => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? (Number.isFinite(v) ? String(v) : '') : v;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCsv(columns: readonly string[], rows: readonly Record<string, Cell>[]): string {
  return (
    [columns.join(','), ...rows.map((r) => columns.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n'
  );
}

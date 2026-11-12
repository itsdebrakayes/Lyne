/**
 * csv.js — one way to write a CSV cell, used by every export.
 *
 * Two things a naive join(',') gets wrong:
 *
 *   1. Quoting. A value containing a comma, a quote or a line break must be
 *      wrapped in quotes with its own quotes doubled, or the row shifts.
 *
 *   2. Formula injection. Excel, Numbers and Google Sheets run a cell that
 *      starts with = + - @ (or a tab / carriage return) as a formula. A visitor
 *      can type their own name at a kiosk, so "=HYPERLINK(...)" in guest_name
 *      would execute on the executive's computer when they open the export.
 *      Such a cell is prefixed with an apostrophe, which spreadsheets show as
 *      plain text. Numbers are exempt: a negative wait time is not a formula.
 */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  let s = Buffer.isBuffer(value) ? value.toString('utf8') : (typeof value === 'object' ? JSON.stringify(value) : String(value));
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(values) {
  return values.map(csvCell).join(',');
}

/** A whole table: header row, then one row per record, CRLF as RFC 4180 asks. */
function toCsv(headers, rows) {
  const lines = [csvRow(headers)];
  for (const row of rows) lines.push(csvRow(headers.map((h) => row[h])));
  return `${lines.join('\r\n')}\r\n`;
}

module.exports = { csvCell, csvRow, toCsv };

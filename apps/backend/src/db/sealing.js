/**
 * The database side of field encryption (src/lib/fieldCrypto.js).
 *
 *   openResult   every sealed value in a query result comes back readable, so
 *                routes, exports and SMS never handle ciphertext.
 *   checkWrite   an INSERT or UPDATE that puts plaintext into a sealed column
 *                throws, naming the column, so a new route cannot forget seal().
 */
const { open, isSealed, SEALED_COLUMNS } = require('../lib/fieldCrypto');

function openRow(row) {
  if (!row || typeof row !== 'object' || Buffer.isBuffer(row) || row instanceof Date) return;
  for (const k of Object.keys(row)) {
    if (isSealed(row[k])) row[k] = open(row[k]);
  }
}

function openResult(result) {
  const rows = result?.[0];
  if (!Array.isArray(rows)) return result;
  for (const item of rows) {
    if (Array.isArray(item)) item.forEach(openRow);
    else openRow(item);
  }
  return result;
}

/* Splits "a, NOW(), 'x,y', ?" at top-level commas. */
function splitTopLevel(text) {
  const out = []; let depth = 0; let quote = null; let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quote) { if (c === quote && text[i - 1] !== '\\') quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(') depth += 1;
    else if (c === ')') depth -= 1;
    else if (c === ',' && depth === 0) { out.push(text.slice(start, i)); start = i + 1; }
  }
  out.push(text.slice(start));
  return out.map((s) => s.trim());
}

const countMarks = (s) => (s.match(/\?/g) || []).length;
const COLUMN_RE = new RegExp(`\\b(${SEALED_COLUMNS.join('|')})\\b`);

function refuse(column) {
  const err = new Error(`${column} must be stored sealed. Wrap the value in seal() from src/lib/fieldCrypto.js (a value read back from the database is already opened, so a copy needs seal() too).`);
  err.code = 'LYNE_UNSEALED_WRITE';
  throw err;
}

const plaintext = (v) => typeof v === 'string' && v !== '' && !isSealed(v);

/** Throws when a write would store a sealed column's value as plaintext. Reads and other columns pass. */
function checkWrite(sql, values) {
  if (typeof sql !== 'string' || !Array.isArray(values) || !COLUMN_RE.test(sql)) return;
  if (!process.env.FIELD_ENCRYPTION_KEY) return;

  const insert = sql.match(/^\s*INSERT\s+(?:IGNORE\s+)?INTO\s+\S+\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)\)\s*;?\s*$/i);
  if (insert) {
    const cols = splitTopLevel(insert[1]).map((c) => c.replace(/`/g, ''));
    const vals = splitTopLevel(insert[2]);
    const before = countMarks(sql.slice(0, insert.index + insert[0].indexOf(insert[2])));
    let mark = before;
    cols.forEach((col, i) => {
      const v = vals[i] || '';
      if (SEALED_COLUMNS.includes(col) && v === '?' && plaintext(values[mark])) refuse(col);
      mark += countMarks(v);
    });
    return;
  }

  if (/^\s*UPDATE\b/i.test(sql)) {
    const re = new RegExp(`\\b(${SEALED_COLUMNS.join('|')})\\s*=\\s*(?:COALESCE\\(\\s*)?\\?`, 'gi');
    for (const m of sql.matchAll(re)) {
      const idx = countMarks(sql.slice(0, m.index + m[0].length)) - 1;
      if (plaintext(values[idx])) refuse(m[1]);
    }
  }
}

module.exports = { openResult, checkWrite };

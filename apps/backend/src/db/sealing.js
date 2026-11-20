/**
 * The database side of field encryption (src/lib/fieldCrypto.js).
 *
 *   openResult   every sealed value in a query result comes back readable, so
 *                routes, exports and SMS never handle ciphertext.
 *   checkWrite   an INSERT or UPDATE that puts plaintext into a sealed column,
 *                or a fingerprinted column without its fingerprint, throws,
 *                naming the column, so a new route cannot forget either.
 */
const { open, isSealed, SEALED, FINGERPRINTED, SEALED_COLUMNS } = require('../lib/fieldCrypto');

const COLUMN_RE = new RegExp(`\\b(${SEALED_COLUMNS.join('|')})\\b`);

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

/* Index of the ')' that closes the '(' just before `from`. */
function closingParen(text, from) {
  let depth = 1; let quote = null;
  for (let i = from; i < text.length; i += 1) {
    const c = text[i];
    if (quote) { if (c === quote && text[i - 1] !== '\\') quote = null; continue; }
    if (c === "'" || c === '"' || c === '`') quote = c;
    else if (c === '(') depth += 1;
    else if (c === ')' && --depth === 0) return i;
  }
  return text.length;
}

const countMarks = (s) => (s.match(/\?/g) || []).length;
const unquote = (c) => c.replace(/`/g, '').replace(/^\w+\./, '').trim();

function refuse(table, column, why) {
  const err = new Error(why === 'fingerprint'
    ? `${table}.${column} is written without ${FINGERPRINTED[table][column]}. Write ${FINGERPRINTED[table][column]} = fingerprint(value) from src/lib/fieldCrypto.js in the same statement.`
    : `${table}.${column} must be stored sealed. Wrap the value in seal() from src/lib/fieldCrypto.js (a value read back from the database is already opened, so a copy needs seal() too).`);
  err.code = 'LYNE_UNSEALED_WRITE';
  throw err;
}

const plaintext = (v) => typeof v === 'string' && v !== '' && !isSealed(v);

/* Columns written by the statement, each with its value: the param, or undefined for an SQL expression. */
function writtenColumns(sql, values) {
  const insert = sql.match(/^\s*INSERT\s+(?:IGNORE\s+)?INTO\s+`?(\w+)`?\s*\(([^)]*)\)\s*VALUES\s*\(/i);
  if (insert) {
    const cols = splitTopLevel(insert[2]).map(unquote);
    const rows = [];
    let open = insert.index + insert[0].length;
    for (;;) {
      const close = closingParen(sql, open);
      const vals = splitTopLevel(sql.slice(open, close));
      let mark = countMarks(sql.slice(0, open));
      const row = new Map();
      cols.forEach((col, i) => {
        const v = vals[i] || '';
        row.set(col, v === '?' ? { value: values[mark] } : { expression: v });
        mark += countMarks(v);
      });
      rows.push(row);
      const next = sql.slice(close + 1).match(/^\s*,\s*\(/);
      if (!next) break;
      open = close + 1 + next[0].length;
    }
    return { table: insert[1], rows };
  }
  const update = sql.match(/^\s*UPDATE\s+`?(\w+)`?[\s\S]*?\bSET\b([\s\S]*?)(?:\bWHERE\b|$)/i);
  if (update) {
    const setAt = update.index + update[0].indexOf(update[2]);
    const out = new Map();
    let offset = 0;
    for (const part of splitTopLevel(update[2])) {
      const at = update[2].indexOf(part, offset); offset = at + part.length;
      const m = part.match(/^`?(?:\w+\.)?(\w+)`?\s*=\s*([\s\S]*)$/);
      if (!m) continue;
      const expr = m[2].trim();
      const param = /^(?:COALESCE\(\s*)?\?/.test(expr);
      out.set(m[1], param ? { value: values[countMarks(sql.slice(0, setAt + at + part.indexOf(expr)))] } : { expression: expr });
    }
    return { table: update[1], rows: [out] };
  }
  return null;
}

/** Throws when a write would store a sealed column in plain text, or a fingerprinted one without its fingerprint. */
function checkWrite(sql, values) {
  if (typeof sql !== 'string' || !COLUMN_RE.test(sql) || !/^\s*(INSERT|UPDATE)\b/i.test(sql)) return;
  const w = writtenColumns(sql, Array.isArray(values) ? values : []);
  if (!w || !SEALED[w.table]) return;
  for (const columns of w.rows) {
    for (const [col, v] of columns) {
      if (!SEALED[w.table].includes(col)) continue;
      const literal = v.expression && /^'/.test(v.expression);
      if (process.env.FIELD_ENCRYPTION_KEY && (plaintext(v.value) || literal)) refuse(w.table, col);
      const fp = FINGERPRINTED[w.table]?.[col];
      const clearing = v.expression && /^NULL$/i.test(v.expression);
      if (fp && !clearing && !columns.has(fp)) refuse(w.table, col, 'fingerprint');
    }
  }
}

module.exports = { openResult, checkWrite };

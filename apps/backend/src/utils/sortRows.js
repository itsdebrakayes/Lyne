/**
 * Sorting rows in JavaScript, for anything ordered by a sealed column (names,
 * emails: see src/lib/fieldCrypto.js). SQL cannot order a sealed value, so the
 * query orders by what it still can and this finishes the job once
 * src/db/pool.js has opened the values.
 *
 *   sortRows(rows, 'role_name', 'full_name')
 *   sortRows(rows, { by: (r) => r.last_seen_at, desc: true, nullsLast: true }, 'full_name')
 *
 * Each key is a column name, a function, or { by, desc, nullsLast }. Text
 * compares the way a person reads a list: case-insensitive, numbers in order.
 * Returns the same array, sorted in place.
 */
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

function compare(a, b) {
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() - new Date(b).getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

function sortRows(rows, ...keys) {
  const specs = keys.map((k) => {
    const spec = typeof k === 'object' ? k : { by: k };
    const get = typeof spec.by === 'function' ? spec.by : (r) => r[spec.by];
    return { get, desc: Boolean(spec.desc), nullsLast: spec.nullsLast !== false };
  });
  return rows.sort((x, y) => {
    for (const { get, desc, nullsLast } of specs) {
      const a = get(x); const b = get(y);
      const an = a === null || a === undefined; const bn = b === null || b === undefined;
      if (an || bn) {
        if (an && bn) continue;
        return (an ? 1 : -1) * (nullsLast ? 1 : -1);
      }
      const c = compare(a, b);
      if (c) return desc ? -c : c;
    }
    return 0;
  });
}

module.exports = { sortRows };

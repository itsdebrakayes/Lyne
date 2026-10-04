/**
 * The values the code writes must exist in the ENUM.
 *
 * DELETE /api/auth/account returned 500 in production, every time, AFTER having
 * already deleted the customer's data. The cause was one word: auth.js passed
 * 'account_deleted' to createRevocation, and token_revocations.reason was
 * declared ENUM('logout','forced_signout','role_change','security'). Strict
 * mode refuses an out-of-range ENUM value rather than coercing it, so the
 * INSERT threw and the customer was told "Nothing was changed" while their row
 * was already gone.
 *
 * Nothing caught it because nothing could: the column and the literal live in
 * different languages, in different directories, and neither file is wrong on
 * its own. The only thing that is wrong is the relationship between them, and
 * that is what this file tests.
 *
 * It reads the schema the way MySQL would — schema.sql first, then every
 * migration in order, each ALTER replacing what came before — and compares the
 * result against what the code actually writes. No database required, so it
 * runs in the same second as everything else and fails on the pull request
 * rather than in production.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../../..');
const SQL_DIR = path.join(ROOT, 'database');
const SRC_DIR = path.join(ROOT, 'apps/backend/src');

/** Every ENUM column, as it stands after the last migration that touched it. */
function declaredEnums() {
  const files = [
    path.join(SQL_DIR, 'schema.sql'),
    ...fs.readdirSync(path.join(SQL_DIR, 'migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .map((f) => path.join(SQL_DIR, 'migrations', f)),
  ].filter((f) => fs.existsSync(f));

  const enums = new Map();
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8').replace(/--[^\n]*/g, '');

    for (const table of sql.matchAll(
      /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+`?(\w+)`?\s*\(([\s\S]*?)\n\)\s*[^;]*;/gi)) {
      for (const col of table[2].matchAll(/^\s*`?(\w+)`?\s+ENUM\s*\(([^)]*)\)/gim)) {
        enums.set(`${table[1]}.${col[1]}`, values(col[2]));
      }
    }
    // A later ALTER wins, which is the whole reason this is read in order.
    for (const alt of sql.matchAll(
      /ALTER TABLE\s+`?(\w+)`?\s+(?:MODIFY|CHANGE|ADD)\s+(?:COLUMN\s+)?`?(\w+)`?(?:\s+`?\w+`?)?\s+ENUM\s*\(([^)]*)\)/gi)) {
      enums.set(`${alt[1]}.${alt[2]}`, values(alt[3]));
    }
  }
  return enums;
}

const values = (list) => new Set([...list.matchAll(/'([^']*)'/g)].map((m) => m[1]));

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return e.name.endsWith('.js') ? [full] : [];
  });
}

/** column name -> the tables that have a column with that name. A name owned by
 *  one table can be matched in SQL without ambiguity; one owned by several
 *  cannot, and pretending otherwise is how a lint becomes noise. */
function columnOwners() {
  const owners = new Map();
  const add = (col, table) => {
    const key = col.toLowerCase();
    if (!owners.has(key)) owners.set(key, new Set());
    owners.get(key).add(table);
  };
  const files = [
    path.join(SQL_DIR, 'schema.sql'),
    ...fs.readdirSync(path.join(SQL_DIR, 'migrations'))
      .filter((f) => f.endsWith('.sql')).sort()
      .map((f) => path.join(SQL_DIR, 'migrations', f)),
  ].filter((f) => fs.existsSync(f));

  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8').replace(/--[^\n]*/g, '');
    for (const table of sql.matchAll(
      /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+`?(\w+)`?\s*\(([\s\S]*?)\n\)\s*[^;]*;/gi)) {
      for (const col of table[2].matchAll(
        /^\s*`?(\w+)`?\s+(?:ENUM|VARCHAR|INT|BIGINT|TINYINT|CHAR|TEXT|DATE|DATETIME|TIMESTAMP|DECIMAL|BOOLEAN|JSON|TIME|FLOAT|DOUBLE)/gim)) {
        add(col[1], table[1]);
      }
    }
    for (const alt of sql.matchAll(/ALTER TABLE\s+`?(\w+)`?\s+ADD\s+(?:COLUMN\s+)?`?(\w+)`?/gi)) {
      add(alt[2], alt[1]);
    }
  }
  return owners;
}

const ENUMS = declaredEnums();
const COLUMN_OWNERS = columnOwners();
const SOURCES = sourceFiles(SRC_DIR).map((f) => ({ file: f, src: fs.readFileSync(f, 'utf8') }));

// ── The bug, exactly ──────────────────────────────────────────

test('every reason passed to createRevocation is in the token_revocations ENUM', () => {
  const allowed = ENUMS.get('token_revocations.reason');
  assert.ok(allowed, 'token_revocations.reason should be declared as an ENUM');

  const used = [];
  for (const { file, src } of SOURCES) {
    // createRevocation(uid, jti, 'reason', ...) — the third argument.
    for (const m of src.matchAll(/createRevocation\(\s*[^,]+,\s*[^,]+,\s*'([^']+)'/g)) {
      used.push({ reason: m[1], file: path.relative(ROOT, file) });
    }
  }

  assert.ok(used.length >= 3, `expected to find the createRevocation calls, found ${used.length}`);

  for (const { reason, file } of used) {
    assert.ok(
      allowed.has(reason),
      `${file} writes token_revocations.reason = '${reason}', which the ENUM does not allow `
      + `(${[...allowed].sort().join(', ')}). Strict mode REFUSES this — it does not coerce it. `
      + 'Add the value in a new migration.'
    );
  }
});

// ── The same mistake one table over ───────────────────────────

test('wait_time_records.channel accepts every queue_tickets.channel value', () => {
  const source = ENUMS.get('queue_tickets.channel');
  const target = ENUMS.get('wait_time_records.channel');
  assert.ok(source && target, 'both channel columns should be declared as ENUMs');

  /* routes/tickets.js and jobs/expireStaleTickets.js both copy ticket.channel
     straight into wait_time_records when a visit completes, so the destination
     has to accept everything the source can hold. Migration 023 added 'web' to
     queue_tickets for the public web check-in and did not widen this one, which
     meant a web-joined ticket could not be completed at all: the INSERT is
     inside the serve transaction, so the whole completion rolled back. */
  const missing = [...source].filter((v) => !target.has(v));
  assert.deepEqual(
    missing, [],
    `queue_tickets.channel allows ${missing.join(', ')} but wait_time_records.channel does not, `
    + 'and the serve path copies one into the other.'
  );
});

// ── The general case ──────────────────────────────────────────

test('no ENUM column is written a literal it does not declare', () => {
  /* Matching `column = 'literal'` in the SQL the backend sends, which works
     only where the column NAME identifies the table on its own.
     `status` sits on nine tables and `channel` on three, so a bare match says
     nothing about which ENUM applies — checking those here produced confident
     nonsense (line_helper_requests.status = 'holding' reported against
     queue_tickets). They are excluded by name rather than fudged, and the two
     that matter are covered exactly by the tests above.

     This one would NOT have caught the account-deletion bug on its own:
     'account_deleted' is passed as an argument to createRevocation, never
     written as `reason = '...'` in SQL, so there is nothing here to match. The
     first test exists for exactly that reason. This is the net for the next
     one — a literal written straight into an UPDATE, which is the more common
     shape. */
  const ambiguous = new Set();
  for (const column of ENUMS.keys()) {
    const col = column.split('.')[1];
    if (COLUMN_OWNERS.get(col)?.size > 1) ambiguous.add(col);
  }

  const offences = [];
  for (const [column, allowed] of ENUMS) {
    const col = column.split('.')[1];
    if (ambiguous.has(col)) continue;
    const pattern = new RegExp(`\\b${col}\\s*=\\s*'([a-z_][a-z0-9_]*)'`, 'gi');
    for (const { file, src } of SOURCES) {
      for (const m of src.matchAll(pattern)) {
        if (!allowed.has(m[1])) {
          offences.push(`${path.relative(ROOT, file)}: ${column} = '${m[1]}' (allowed: ${[...allowed].sort().join(', ')})`);
        }
      }
    }
  }
  assert.deepEqual(offences, [], `ENUM values written by the code but not declared:\n  ${offences.join('\n  ')}`);
});

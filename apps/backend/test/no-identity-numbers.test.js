/**
 * TRN, national ID and passport numbers never reach Lyne's server.
 *
 * This is a promise made to organisations and the public (deck, privacy
 * policy, security overview): identification numbers are read and kept on the
 * customer's phone. It was untrue until 11 November 2026, because the old
 * /api/ocr route was still mounted and stored every scanned number unmasked.
 * These checks fail if anything like it comes back.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC = path.join(__dirname, '..', 'src');

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return e.name.endsWith('.js') ? [full] : [];
  });
}

/** Source with comments removed, so explanations of the history do not count. */
function code(file) {
  return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('there is no OCR route and nothing mounts one', () => {
  assert.equal(fs.existsSync(path.join(SRC, 'routes', 'ocr.js')), false, 'routes/ocr.js stored TRNs on the server; it must not return');
  assert.doesNotMatch(code(path.join(SRC, 'index.js')), /\/api\/ocr/);
});

test('no server code reads or writes the identity-scan table', () => {
  const offenders = sourceFiles(SRC).filter((f) => /\b(FROM|INTO|UPDATE|JOIN)\s+ocr_results\b/i.test(code(f)));
  assert.deepEqual(offenders.map((f) => path.relative(SRC, f)), []);
});

test('no SQL in the server writes a TRN or national ID column', () => {
  const pattern = /(INSERT\s+INTO\s+users[^;]*\b(trn|national_id)\b|SET\s+[^;]*\b(trn|national_id)\s*=)/i;
  const offenders = sourceFiles(SRC).filter((f) => pattern.test(code(f)));
  assert.deepEqual(offenders.map((f) => path.relative(SRC, f)), []);
});

test('signup and profile validation strip identity numbers', () => {
  const { schemas } = require('../src/middleware/validate');
  for (const name of Object.keys(schemas)) {
    const shape = schemas[name]?.shape;
    if (!shape) continue;
    assert.equal('trn' in shape, false, `schema ${name} accepts trn`);
    assert.equal('national_id' in shape, false, `schema ${name} accepts national_id`);
  }
});

test('migration 050 removes the stored numbers', () => {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'database', 'migrations', '050_remove_identity_numbers.sql'), 'utf8');
  assert.match(sql, /DROP TABLE IF EXISTS ocr_results/);
  assert.match(sql, /DROP COLUMN national_id/);
  assert.match(sql, /DROP COLUMN trn/);
});

/**
 * db-timezone.test.js — the connection must share the database's wall clock.
 *
 * Regression guard for a bug that silently corrupted every duration in the
 * system. The pool was configured with `timezone: '+00:00'`, so the API wrote
 * called_at / started_serving_at / completed_at as UTC while joined_at
 * (CURRENT_TIMESTAMP), the seeds, and every TIMESTAMPDIFF / CURDATE() /
 * HOUR(NOW()) read those same columns as America/Jamaica.
 *
 * App-only round-trips still looked right — write a Date, read it back, same
 * Date — which is exactly why it survived so long. What broke was anything
 * comparing an app-written timestamp against a database-written one: a
 * two-minute visit recorded as 302 minutes, wait_time_records (the ML training
 * set) filled with ~300-minute waits, and the anomaly detector reporting the
 * corruption to executives as a real service failure.
 *
 * 'local' is the only correct value: the API and MySQL containers both take
 * their zone from APP_TZ, so the process zone and the session zone move
 * together. A fixed offset does not — it silently desynchronises the moment
 * APP_TZ changes, and it is wrong today for any APP_TZ that is not UTC.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/db/pool');
const timezone = pool.pool.config.connectionConfig.timezone;

test('the pool shares the database wall clock rather than pinning an offset', () => {
  assert.equal(timezone, 'local',
    `pool timezone is ${JSON.stringify(timezone)}. It must be 'local' so the ` +
    'API and MySQL agree on what "now" means — see the header of this file.');
});

test('the pool never pins a fixed UTC offset', () => {
  // '+00:00' / 'Z' / '-05:00' all reintroduce the bug: they fix the app to one
  // zone while the database session follows APP_TZ.
  assert.ok(!/^[+-]\d{2}:\d{2}$/.test(String(timezone)),
    'a fixed offset desynchronises the app from the database session');
  assert.notEqual(String(timezone).toUpperCase(), 'Z');
});

// The pool is created lazily, but requiring it registers a connection pool that
// would otherwise hold the test runner open.
test.after(() => pool.end());

/**
 * Line Helper must never recommend a time and then refuse it.
 *
 * Reported: Line Helper suggested the quietest slot for a service, then
 * scheduling it failed with "That service is not running at this branch".
 * The check looked for an ACTIVE QUEUE ROW, but queues are created one day at
 * a time, so every future slot failed. The rule is now: the branch has an
 * active counter for the service and is open at that time.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { serviceAvailableAt } = require('../src/utils/serviceAvailability');

const branch = (over = {}) => ({
  branch_name: 'Blue Harbour Main Office', service_name: 'General Enquiries',
  opening_time: '08:30:00', closing_time: '16:30:00', open_days: '1,2,3,4,5', offered: 1, ...over,
});
const db = (row) => ({ query: async () => [[row]] });
// A Wednesday (2026-10-14) at a given local hour.
const wed = (h, m = 0) => new Date(2026, 9, 14, h, m);

test('an offered service, on an open day, in opening hours, is available', async () => {
  assert.deepEqual(await serviceAvailableAt(db(branch()), 'b', 's', wed(13)), { ok: true });
});

test('it does not depend on a queue row existing for that day', async () => {
  // The query only reads branches, services and counters; no queues table.
  const sql = [];
  await serviceAvailableAt({ query: async (q) => { sql.push(q); return [[branch()]]; } }, 'b', 's', wed(10));
  assert.ok(!/\bqueues\b/.test(sql.join(' ')), 'availability must not be "is a queue row active"');
});

test('a service with no active counter at the branch is not offered', async () => {
  const r = await serviceAvailableAt(db(branch({ offered: 0 })), 'b', 's', wed(13));
  assert.equal(r.ok, false); assert.equal(r.reason, 'not_offered');
});

test('a closed day is refused with the reason', async () => {
  const sat = new Date(2026, 9, 17, 11);
  const r = await serviceAvailableAt(db(branch()), 'b', 's', sat);
  assert.equal(r.reason, 'closed_day'); assert.match(r.message, /closed on Saturdays/);
});

test('before opening and from closing time onward are refused', async () => {
  assert.equal((await serviceAvailableAt(db(branch()), 'b', 's', wed(8, 0))).reason, 'closed_hours');
  assert.equal((await serviceAvailableAt(db(branch()), 'b', 's', wed(16, 30))).reason, 'closed_hours');
  assert.equal((await serviceAvailableAt(db(branch()), 'b', 's', wed(17))).reason, 'closed_hours');
  assert.equal((await serviceAvailableAt(db(branch()), 'b', 's', wed(16, 29))).ok, true);
});

test('the helper job joins TODAY\'s queue, opening it first', () => {
  const src = fs.readFileSync(require.resolve('../src/jobs/lineHelper.js'), 'utf8');
  assert.match(src, /ensureQueuesForToday\(h\.business_id, h\.branch_id\)/);
  assert.match(src, /queue_date = CURDATE\(\)/);
});

test('quote and scheduling use the same availability rule', () => {
  const src = fs.readFileSync(require.resolve('../src/routes/line-helper.js'), 'utf8');
  assert.equal((src.match(/serviceAvailableAt\(/g) || []).length, 2);
  assert.ok(!/error: 'That service is not running/.test(src), 'the old refusal must be gone');
});

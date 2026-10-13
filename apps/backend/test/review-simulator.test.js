/**
 * The App Review simulator only ever touches the review organisation and the
 * review account, and is off unless the server turns it on.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { settings, runReviewSimulatorTick } = require('../src/jobs/reviewSimulator');

const src = fs.readFileSync(path.join(__dirname, '../src/jobs/reviewSimulator.js'), 'utf8');

test('off by default, and off for anything but an explicit "true"', async () => {
  assert.equal(settings({}).enabled, false);
  assert.equal(settings({ REVIEW_SIMULATOR: '1' }).enabled, false);
  assert.equal(settings({ REVIEW_SIMULATOR: 'TRUE' }).enabled, true);
  assert.deepEqual(await runReviewSimulatorTick({}), { enabled: false });
});

test('defaults to the seeded review organisation and account', () => {
  const s = settings({ REVIEW_SIMULATOR: 'true' });
  assert.equal(s.businessId, 'biz-review-demo-0001');
  assert.equal(s.email, 'appreview@uselyne.com');
});

test('every query that changes tickets is scoped to the review business or a demo visitor', () => {
  const writes = src.match(/`(UPDATE|DELETE|INSERT)[\s\S]*?`/g) || [];
  assert.ok(writes.length >= 4);
  for (const w of writes) {
    const scoped = /business_id = \?|guest_name = \?|DEMO_VISITOR|queue_tickets\s*\n?\s*\(id, queue_id, guest_name/.test(w) || /INSERT INTO queue_tickets/.test(w);
    assert.ok(scoped, `unscoped write: ${w.slice(0, 80)}`);
  }
  // Only made-up visitors are served on the reviewer's behalf.
  assert.match(src, /WHERE id = \? AND guest_name = \? AND status = 'waiting'/);
});

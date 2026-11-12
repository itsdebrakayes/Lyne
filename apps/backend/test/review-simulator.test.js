/**
 * The App Review simulator only ever touches the review organisation and the
 * review account, and is off unless the server turns it on.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { settings, organisations, runReviewSimulatorTick } = require('../src/jobs/reviewSimulator');

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

test('showcase organisations have their own switch', () => {
  const both = settings({ REVIEW_SIMULATOR: 'true', REVIEW_SHOWCASE_IDS: 'biz-lgb-001, wf-biz-0001,biz-review-demo-0001,' });
  assert.deepEqual(organisations(both), ['biz-review-demo-0001', 'biz-lgb-001', 'wf-biz-0001']);
  // App Review mode off after approval: the showcase keeps going on its own.
  assert.deepEqual(organisations(settings({ REVIEW_SHOWCASE_IDS: 'biz-lgb-001' })), ['biz-lgb-001']);
  assert.deepEqual(organisations(settings({ REVIEW_SIMULATOR: 'true' })), ['biz-review-demo-0001']);
  assert.deepEqual(organisations(settings({})), []);
});

test('a demo window is on only between DEMO_FROM and DEMO_UNTIL, and needs both', () => {
  const { demoActive, configured } = require('../src/jobs/reviewSimulator');
  const env = { DEMO_SHOWCASE_IDS: 'wf-biz-0001', DEMO_FROM: '2026-11-10T14:00:00-05:00', DEMO_UNTIL: '2026-11-10T18:00:00-05:00' };
  const s = settings(env);
  assert.equal(configured(s), true);
  assert.equal(demoActive(s, new Date('2026-11-10T18:59:00Z')), false); // 13:59 Jamaica
  assert.equal(demoActive(s, new Date('2026-11-10T19:00:00Z')), true); // 14:00
  assert.equal(demoActive(s, new Date('2026-11-10T23:00:00Z')), false); // 18:00, the end
  assert.equal(demoActive(settings({ DEMO_SHOWCASE_IDS: 'wf-biz-0001', DEMO_FROM: env.DEMO_FROM }), new Date('2026-11-10T20:00:00Z')), false);
  // A demo organisation is not a regular showcase: it is never served on its own outside the window.
  assert.deepEqual(organisations(s), []);
});

test('in a demo window the person at the front waits for the desk', () => {
  assert.match(src, /else if \(!holdAtFront\) \{\s*await moveReviewerTicket\(t\.id, 'called'/);
  assert.match(src, /holdAtFront: true/);
});

/**
 * The free trial, which was not one.
 *
 * The app's button reads "Start 14-day free trial · cancel anytime", next to a
 * paid subscription on the same screen. The endpoint behind it set is_premium
 * and nothing else: no start date, no end date, and no check that a trial had
 * already been taken. So it granted permanent premium, to anyone, any number
 * of times — nobody ever needed to pay, and the app made a specific factual
 * claim the backend did not implement.
 *
 * These tests hold both halves of that claim: fourteen days, and once.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { hasPremium, withPremiumState, trialEndsAt, TRIAL_DAYS, PAYMENTS_ENABLED } = require('../src/lib/premium');

/* The trial and paid-access rules are kept for when payments return. The pure
   rules are tested in that mode; the routes are skipped while the release is
   free, and the free behaviour has its own tests below. */
const PAID = { paymentsEnabled: true };
const trialRoute = { skip: !PAYMENTS_ENABLED && 'payments are off in this release (lib/premium.js)' };
const { callAs, reset, startWith, stop, db } = require('./helpers/accountHarness');

test.beforeEach(async () => { reset(); await startWith(); });
test.after(() => stop());

const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// ── What counts as premium ────────────────────────────────────

test('a trial inside its window is premium', () => {
  assert.equal(hasPremium({ is_premium: 1, premium_until: days(3) }, PAID), true);
});

test('a lapsed trial is not premium, whatever the flag says', () => {
  assert.equal(
    hasPremium({ is_premium: 1, premium_until: days(-1) }, PAID), false,
    'is_premium staying true after the window closed is exactly the bug'
  );
});

test('a paid subscription has no end date and stays premium', () => {
  assert.equal(hasPremium({ is_premium: 1, premium_until: null }, PAID), true);
});

test('a customer who never subscribed is not premium', () => {
  assert.equal(hasPremium({ is_premium: 0, premium_until: null }, PAID), false);
  assert.equal(hasPremium({ is_premium: 0, premium_until: days(5) }, PAID), false,
    'an end date alone must never grant access');
});

test('the trial window is exactly the length the app advertises', () => {
  assert.equal(TRIAL_DAYS, 14, 'the app says 14 days in a button label');
  const started = new Date('2026-01-01T00:00:00Z');
  assert.equal(trialEndsAt(started).toISOString(), '2026-01-15T00:00:00.000Z');
});

test('the client is told real access, not the raw column', () => {
  const lapsed = withPremiumState({ id: 'u1', is_premium: 1, premium_until: days(-1) }, PAID);
  assert.equal(lapsed.is_premium, 0, 'the app reads this one field to draw the paywall');
  const active = withPremiumState({ id: 'u1', is_premium: 1, premium_until: days(2) }, PAID);
  assert.equal(active.is_premium, 1);
});

// ── Starting a trial ──────────────────────────────────────────

test('a first trial starts, and it has an end', trialRoute, async () => {
  const result = await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  assert.equal(result.status, 200, `trial failed: ${JSON.stringify(result.body)}`);
  assert.ok(result.body.trial_ends_at, 'a trial with no end date is not a trial');

  const endsAt = new Date(result.body.trial_ends_at);
  const expected = trialEndsAt();
  assert.ok(
    Math.abs(endsAt - expected) < 60_000,
    `the trial must end about ${TRIAL_DAYS} days out, got ${endsAt.toISOString()}`
  );
  assert.ok(db.users[0].trial_started_at, 'without this stamp a second trial cannot be refused');
});

test('a trial cannot be taken twice', trialRoute, async () => {
  await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  const again = await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  assert.equal(again.status, 409, 'repeat trials mean nobody ever has to subscribe');
  assert.match(again.body.error, /already used/i);
});

test('a trial cannot be restarted once it has lapsed', trialRoute, async () => {
  await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  // The window closes, but the fact that a trial was taken does not expire.
  db.users[0].premium_until = days(-1);

  const again = await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  assert.equal(again.status, 409, 'a lapsed trial must not be a fresh one');
});

test('a lapsed trial stops granting access', trialRoute, async () => {
  await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  db.users[0].premium_until = days(-1);

  const me = await callAs('user-1', '/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.record.is_premium, 0, 'the paywall must come back when the trial ends');
});

test('an active trial reads as premium', trialRoute, async () => {
  await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  const me = await callAs('user-1', '/api/auth/me');
  assert.equal(me.body.record.is_premium, 1);
});

test('a subscriber keeps access with no end date', async () => {
  // What the Stripe webhook does on capture.
  db.users[0].is_premium = 1;
  db.users[0].premium_until = null;
  const me = await callAs('user-1', '/api/auth/me');
  assert.equal(me.body.record.is_premium, 1, 'a paying customer must never be cut off by a stale trial date');
});

test('nobody can start a trial without signing in', trialRoute, async () => {
  const result = await callAs(null, '/api/auth/start-trial', { method: 'POST' });
  assert.equal(result.status, 401);
});

// ── The free release ──────────────────────────────────────────

test('while payments are off, every signed-in customer has every feature', { skip: PAYMENTS_ENABLED && 'payments are on' }, () => {
  assert.equal(hasPremium({ is_premium: 0, premium_until: null }), true);
  assert.equal(hasPremium({ is_premium: 1, premium_until: days(-30) }), true);
  assert.equal(hasPremium(null), false, 'no user is still no user');
});

test('while payments are off, starting a trial is simply not available', { skip: PAYMENTS_ENABLED && 'payments are on' }, async () => {
  const result = await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  assert.equal(result.status, 404);
  assert.equal(result.body.available, false);
  assert.equal(db.users[0].trial_started_at ?? null, null, 'nothing may be written');
});

test('while payments are off, the purchase gate answers "not available"', { skip: PAYMENTS_ENABLED && 'payments are on' }, () => {
  const { requirePayments } = require('../src/lib/premium');
  let status = null; let body = null; let passed = false;
  const res = { status(c) { status = c; return this; }, json(b) { body = b; return this; } };
  requirePayments({}, res, () => { passed = true; });
  assert.equal(passed, false, 'nothing behind the gate may run');
  assert.equal(status, 404);
  assert.equal(body.available, false);
});

test('the server mounts the gate on every purchase path', () => {
  const src = require('fs').readFileSync(require.resolve('../src/index.js'), 'utf8');
  assert.match(src, /app\.post\('\/api\/payments\/webhook',\s*requirePayments,/);
  assert.match(src, /app\.use\('\/api\/iap',\s*requirePayments,/);
  assert.match(src, /app\.use\('\/api\/payments',\s*requirePayments,/);
  const auth = require('fs').readFileSync(require.resolve('../src/routes/auth.js'), 'utf8');
  assert.match(auth, /router\.post\('\/start-trial',\s*requirePayments,/);
});

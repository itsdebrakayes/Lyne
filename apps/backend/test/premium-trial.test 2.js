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
const { hasPremium, withPremiumState, trialEndsAt, TRIAL_DAYS } = require('../src/lib/premium');
const { callAs, reset, startWith, stop, db } = require('./helpers/accountHarness');

test.beforeEach(async () => { reset(); await startWith(); });
test.after(() => stop());

const days = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

// ── What counts as premium ────────────────────────────────────

test('a trial inside its window is premium', () => {
  assert.equal(hasPremium({ is_premium: 1, premium_until: days(3) }), true);
});

test('a lapsed trial is not premium, whatever the flag says', () => {
  assert.equal(
    hasPremium({ is_premium: 1, premium_until: days(-1) }), false,
    'is_premium staying true after the window closed is exactly the bug'
  );
});

test('a paid subscription has no end date and stays premium', () => {
  assert.equal(hasPremium({ is_premium: 1, premium_until: null }), true);
});

test('a customer who never subscribed is not premium', () => {
  assert.equal(hasPremium({ is_premium: 0, premium_until: null }), false);
  assert.equal(hasPremium({ is_premium: 0, premium_until: days(5) }), false,
    'an end date alone must never grant access');
});

test('the trial window is exactly the length the app advertises', () => {
  assert.equal(TRIAL_DAYS, 14, 'the app says 14 days in a button label');
  const started = new Date('2026-01-01T00:00:00Z');
  assert.equal(trialEndsAt(started).toISOString(), '2026-01-15T00:00:00.000Z');
});

test('the client is told real access, not the raw column', () => {
  const lapsed = withPremiumState({ id: 'u1', is_premium: 1, premium_until: days(-1) });
  assert.equal(lapsed.is_premium, 0, 'the app reads this one field to draw the paywall');
  const active = withPremiumState({ id: 'u1', is_premium: 1, premium_until: days(2) });
  assert.equal(active.is_premium, 1);
});

// ── Starting a trial ──────────────────────────────────────────

test('a first trial starts, and it has an end', async () => {
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

test('a trial cannot be taken twice', async () => {
  await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  const again = await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  assert.equal(again.status, 409, 'repeat trials mean nobody ever has to subscribe');
  assert.match(again.body.error, /already used/i);
});

test('a trial cannot be restarted once it has lapsed', async () => {
  await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  // The window closes, but the fact that a trial was taken does not expire.
  db.users[0].premium_until = days(-1);

  const again = await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  assert.equal(again.status, 409, 'a lapsed trial must not be a fresh one');
});

test('a lapsed trial stops granting access', async () => {
  await callAs('user-1', '/api/auth/start-trial', { method: 'POST' });
  db.users[0].premium_until = days(-1);

  const me = await callAs('user-1', '/api/auth/me');
  assert.equal(me.status, 200);
  assert.equal(me.body.record.is_premium, 0, 'the paywall must come back when the trial ends');
});

test('an active trial reads as premium', async () => {
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

test('nobody can start a trial without signing in', async () => {
  const result = await callAs(null, '/api/auth/start-trial', { method: 'POST' });
  assert.equal(result.status, 401);
});

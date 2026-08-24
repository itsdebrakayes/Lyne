/**
 * subscriptions.test.js
 *
 * What this replaces: POST /payments/create-intent charged once, called itself
 * `premium_subscription`, set is_premium with no end date, never renewed, and
 * could not be cancelled because there was nothing to cancel. The customer was
 * never shown a price before the charge.
 *
 * These cover the decisions that live in our code rather than in Stripe's — the
 * price list, what counts as entitling, and the shape the app renders. The
 * Stripe calls themselves are exercised against a test key, not mocked here;
 * mocking an SDK mostly proves the mock works.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PLANS, PLAN_IDS, planFor, yearlySavingCents,
  subscriptionEntitles, hasPremium,
} = require('../src/lib/premium');
const { toClientShape, CURRENCY } = require('../src/lib/subscriptions');

// ── the price list ──────────────────────────────────────────────────────────

test('the plans are $10 a month and $100 a year, in USD', () => {
  assert.equal(PLANS.monthly.amountCents, 1000);
  assert.equal(PLANS.yearly.amountCents, 10000);
  assert.equal(CURRENCY, 'usd');
});

test('the annual really is two months free, not a rounded-down number', () => {
  // If the amounts ever drift apart, the marketing claim drifts with them.
  assert.equal(yearlySavingCents(), PLANS.monthly.amountCents * 2);
  assert.equal(yearlySavingCents(), 2000);
});

test('the intervals are what Stripe will actually bill on', () => {
  assert.equal(PLANS.monthly.interval, 'month');
  assert.equal(PLANS.yearly.interval, 'year');
});

test('an unknown plan is not a plan, and neither is an inherited property', () => {
  assert.equal(planFor('lifetime_free'), null);
  assert.equal(planFor('constructor'), null);
  assert.equal(planFor('__proto__'), null);
  assert.equal(planFor(undefined), null);
});

test('only the two plans are on offer', () => {
  assert.deepEqual(PLAN_IDS.sort(), ['monthly', 'yearly']);
});

// ── who is entitled ─────────────────────────────────────────────────────────

test('a past_due subscriber keeps access while Stripe retries the card', () => {
  /* Cutting access on the first failed retry punishes an expired card, not a
     non-payer. premium_until is what actually ends it. */
  assert.equal(subscriptionEntitles('past_due'), true);
  assert.equal(subscriptionEntitles('active'), true);
  assert.equal(subscriptionEntitles('trialing'), true);
});

test('a cancelled or unpaid subscription does not entitle', () => {
  for (const status of ['canceled', 'unpaid', 'incomplete', 'incomplete_expired', '', null]) {
    assert.equal(subscriptionEntitles(status), false, `${status} must not entitle`);
  }
});

test('a lapsed paid-through date ends access with no sweep job', () => {
  const yesterday = new Date(Date.now() - 86400000);
  assert.equal(hasPremium({ is_premium: 1, premium_until: yesterday }), false);
});

test('a legacy grant with no end date is not retroactively revoked', () => {
  // Rows that predate migration 014 keep premium_until NULL and stay premium.
  assert.equal(hasPremium({ is_premium: 1, premium_until: null }), true);
});

// ── the shape the app renders ───────────────────────────────────────────────

const subscribed = (over = {}) => ({
  stripe_subscription_id: 'sub_123',
  subscription_plan: 'monthly',
  subscription_status: 'active',
  cancel_at_period_end: 0,
  premium_until: new Date('2026-09-23T00:00:00Z'),
  ...over,
});

test('an active subscription reports when it renews and what it costs', () => {
  const out = toClientShape(subscribed());
  assert.equal(out.is_subscribed, true);
  assert.equal(out.amount_cents, 1000);
  assert.equal(out.price_label, '$10 / month');
  assert.ok(out.renews_on, 'the customer is told the next charge date');
});

test('a cancelling subscription never reports a renewal date', () => {
  /* The two fields exist separately so the app cannot print "renews on" over
     what is actually the last day of access. */
  const out = toClientShape(subscribed({ cancel_at_period_end: 1 }));
  assert.equal(out.renews_on, null, 'nothing renews — it is ending');
  assert.ok(out.access_until, 'but the customer keeps what they paid for');
  assert.equal(out.cancel_at_period_end, true);
});

test('somebody who never subscribed is not described as a subscriber', () => {
  const out = toClientShape({});
  assert.equal(out.is_subscribed, false);
  assert.equal(out.plan, null);
  assert.equal(out.amount_cents, null);
});

/* ── STATUS = FULL EVENT TIMELINE ─────────────────────────────────────────
   From the payment architecture: payment_events is an immutable ledger and
   status is derived from it, not stored beside it. These cover the two
   failures that are otherwise indistinguishable from success — a charge that
   went through while our response was lost, and a charge that failed or was
   refunded after we had already recorded a capture. */

const { deriveStatus } = require('../src/routes/payments');

const ev = (event_type, recorded_at) => ({ event_type, recorded_at });

test('an empty ledger derives nothing rather than guessing', () => {
  assert.equal(deriveStatus([]), null);
  assert.equal(deriveStatus(undefined), null);
});

test('the timeline resolves to its highest state, not its latest row', () => {
  assert.equal(deriveStatus([
    ev('payment_initialized', 1), ev('payment_authorized', 2), ev('payment_captured', 3),
  ]), 'captured');
});

test('a late authorization cannot demote a capture', () => {
  /* Stripe does not guarantee webhook ordering. Ranking rather than taking the
     last row is what stops an out-of-order delivery reopening a settled
     payment. */
  assert.equal(deriveStatus([
    ev('payment_captured', 1), ev('payment_authorized', 2),
  ]), 'captured');
});

test('a refund overrides a capture, whenever it arrives', () => {
  assert.equal(deriveStatus([
    ev('payment_captured', 1), ev('payment_refunded', 2),
  ]), 'refunded');
  assert.equal(deriveStatus([
    ev('payment_refunded', 1), ev('payment_captured', 2),
  ]), 'refunded');
});

test('a payment nobody captured does not read as captured', () => {
  // "their card bounced but it says registered" — the ledger has no capture.
  assert.equal(deriveStatus([
    ev('payment_initialized', 1), ev('payment_failed', 2),
  ]), 'failed');
});

test('a capture recorded only in the ledger still resolves', () => {
  /* "somebody paid and it did not register": the in-band response was lost so
     the cached column never moved, but the webhook landed. The timeline knows. */
  assert.equal(deriveStatus([ev('payment_captured', 1)]), 'captured');
});

test('unknown event types are ignored, not treated as a state', () => {
  assert.equal(deriveStatus([
    ev('payment_captured', 1), ev('some_future_stripe_event', 2),
  ]), 'captured');
});

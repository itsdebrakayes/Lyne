const test = require('node:test');
const assert = require('node:assert/strict');

const { router: paymentsRouter, mapEvent, advancesStatus } = require('../src/routes/payments');

function routeHandlers(router, method, path) {
  const layer = router.stack.find(candidate => (
    candidate.route?.path === path && candidate.route.methods?.[method]
  ));
  assert.ok(layer, `${method.toUpperCase()} ${path} route must exist`);
  return layer.route.stack.map(handler => handler.name);
}

// ── Route wiring: every payment endpoint is authenticated ────────────────────
test('all payment endpoints require authentication', () => {
  const routes = [
    ['get', '/methods'],
    ['post', '/methods'],
    ['delete', '/methods/:id'],
    ['post', '/create-intent'],
    ['get', '/intents/:id'],
  ];
  for (const [method, path] of routes) {
    const handlers = routeHandlers(paymentsRouter, method, path);
    assert.ok(handlers.includes('requireAuth'), `${method.toUpperCase()} ${path} must authenticate`);
  }
});

// ── mapEvent: Stripe event type → ledger event + projected status ────────────
test('mapEvent maps the meaningful Stripe events and ignores the rest', () => {
  assert.deepEqual(mapEvent('payment_intent.succeeded'),      { event: 'payment_captured',   status: 'captured' });
  assert.deepEqual(mapEvent('payment_intent.payment_failed'), { event: 'payment_failed',     status: 'failed' });
  assert.deepEqual(mapEvent('payment_intent.canceled'),       { event: 'payment_canceled',   status: 'canceled' });
  assert.deepEqual(mapEvent('charge.refunded'),               { event: 'payment_refunded',   status: 'refunded' });
  assert.deepEqual(mapEvent('payment_intent.created'),        { event: 'payment_initialized', status: 'initialized' });
  // An event we don't care about must not produce a ledger row.
  assert.equal(mapEvent('customer.updated'), null);
  assert.equal(mapEvent('nonsense'), null);
});

// ── Forward-only status projection — the immutable-ledger guarantee ──────────
test('status only ever advances (out-of-order / duplicate events cannot regress it)', () => {
  // Normal forward progression.
  assert.equal(advancesStatus('initialized', 'authorized'), true);
  assert.equal(advancesStatus('authorized', 'captured'), true);
  assert.equal(advancesStatus('captured', 'refunded'), true);

  // Stripe is at-least-once: a re-delivered or late lower-ranked event must NOT
  // move a captured payment backwards, and a duplicate is a no-op.
  assert.equal(advancesStatus('captured', 'authorized'), false);
  assert.equal(advancesStatus('captured', 'failed'), false);
  assert.equal(advancesStatus('captured', 'captured'), false);
  assert.equal(advancesStatus('refunded', 'captured'), false);

  // Unknown states are treated as rank 0 so they can never clobber a real one.
  assert.equal(advancesStatus('captured', 'mystery'), false);
});

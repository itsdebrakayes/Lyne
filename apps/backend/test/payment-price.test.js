/**
 * payment-price.test.js
 *
 * POST /api/payments/create-intent took `amount_cents` from the request body
 * and handed it to Stripe as the charge:
 *
 *   const amount = Number.isInteger(amount_cents) && amount_cents > 0
 *     ? amount_cents : DEFAULT_PREMIUM_CENTS;
 *
 * Any authenticated customer could therefore POST { amount_cents: 1 }, be
 * charged one cent on their own real card, and have the charge SUCCEED — which
 * fires payment_intent.succeeded, which the webhook maps to 'captured', which
 * sets is_premium = TRUE. Premium, permanently, for $0.01. The payment_intents
 * row recorded 1 cent as the price, so the ledger agreed with the theft.
 *
 * The price is now looked up server-side by `purpose` and the body cannot
 * influence it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { priceFor, PURPOSE_PRICES } = require('../src/routes/payments');

test('a known purpose resolves to a server-side price', () => {
  const cents = priceFor('premium_subscription');
  assert.equal(typeof cents, 'number');
  assert.ok(cents > 0, 'premium must cost something');
});

test('an unknown purpose is refused, not silently priced', () => {
  assert.equal(priceFor('free_stuff_please'), null);
  assert.equal(priceFor(''), null);
  assert.equal(priceFor(undefined), null);
});

test('inherited Object properties are not purposes', () => {
  // A plain `PURPOSE_PRICES[purpose]` lookup would return a function for
  // 'constructor' / 'toString' and treat it as a resolvable price.
  assert.equal(priceFor('constructor'), null);
  assert.equal(priceFor('toString'), null);
  assert.equal(priceFor('__proto__'), null);
});

test('every declared purpose yields a positive integer number of cents', () => {
  for (const purpose of Object.keys(PURPOSE_PRICES)) {
    const cents = priceFor(purpose);
    assert.ok(Number.isInteger(cents) && cents > 0, `${purpose} must price to a positive integer`);
  }
});

test('create-intent does not read amount_cents from the request body', () => {
  /* The invariant is about where the number COMES FROM, which no amount of
     calling the handler can demonstrate as clearly as this: the body is never
     destructured for it. Asserted against the source because that is the thing
     that regressed, and it is the thing a future edit would reintroduce. */
  const src = fs.readFileSync(path.join(__dirname, '../src/routes/payments.js'), 'utf8');
  const handler = src.slice(src.indexOf("router.post('/create-intent'"));
  const body = handler.slice(0, handler.indexOf('\nrouter.'));

  const destructures = [...body.matchAll(/const\s*\{([^}]*)\}\s*=\s*req\.body/g)]
    .map(m => m[1]);
  for (const d of destructures) {
    assert.ok(
      !/\bamount_cents\b/.test(d),
      'amount_cents must not be destructured from req.body — the server sets the price'
    );
  }
  assert.ok(
    /priceFor\(\s*purpose\s*\)/.test(body),
    'the amount must come from priceFor(purpose)'
  );
});

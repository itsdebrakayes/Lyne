/**
 * payments.js — Stripe payments with an event-sourced, immutable ledger.
 *
 * Safety model (see migration 012):
 *  • Card data never reaches us — the client tokenizes with Stripe (publishable
 *    key) and sends only a payment_method id + a client idempotency key (UUID).
 *  • We create the charge with the secret key using that idempotency key, so a
 *    retry can never double-charge.
 *  • Stripe reports state via webhooks (at-least-once). Every event is appended
 *    to payment_events (immutable); duplicates are ignored via the unique
 *    stripe_event_id; status is a forward-only projection of the timeline,
 *    advanced inside a transaction that holds an exclusive row lock
 *    (SELECT ... FOR UPDATE) so concurrent/out-of-order events can't corrupt it.
 *
 * Configuration is gated on STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET — until
 * those are set, the charge/webhook endpoints return 503 "not configured" and
 * the rest of the app is unaffected.
 */
const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');

const DEFAULT_PREMIUM_CENTS = Number(process.env.PREMIUM_PRICE_CENTS || 999);

/* ── The server owns the price ─────────────────────────────────────────────
   `amount_cents` used to be read from the request body and passed straight to
   Stripe as the charge amount:

     const amount = Number.isInteger(amount_cents) && amount_cents > 0
       ? amount_cents : DEFAULT_PREMIUM_CENTS;

   So a customer could POST { amount_cents: 1 }, be charged one cent on their
   own real card, and the charge would SUCCEED — at which point
   payment_intent.succeeded fires, the webhook maps it to 'captured', and the
   capture branch sets is_premium = TRUE. Premium, permanently, for $0.01. The
   attacker needs no special access; every authenticated customer could do it,
   and the payment_intents row would record 1 cent as though that were the
   price, so the ledger agreed with the theft.

   A price is not user input. It is looked up here, by purpose, and the body
   cannot influence it. `purpose` is likewise constrained: it was a free string
   that reached Stripe as the charge description and was stored on the intent,
   so it was both a pricing key and an injection surface into our own records. */
const PURPOSE_PRICES = {
  premium_subscription: () => DEFAULT_PREMIUM_CENTS,
};

function priceFor(purpose) {
  const resolve = Object.prototype.hasOwnProperty.call(PURPOSE_PRICES, purpose)
    ? PURPOSE_PRICES[purpose]
    : null;
  return resolve ? resolve() : null;
}
const CURRENCY = (process.env.PREMIUM_CURRENCY || 'usd').toLowerCase();
const { PLANS, PLAN_IDS, planFor, yearlySavingCents, subscriptionEntitles } = require('../lib/premium');
const {
  ensurePrice, ensureCustomerEmail, fromUnix, toClientShape,
} = require('../lib/subscriptions');
const portalHandoff = require('../lib/portalHandoff');

// Lazy Stripe client — null when no secret key is configured yet.
let _stripe;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    try { _stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); }
    catch { return null; }
  }
  return _stripe;
}

// Map a Stripe event type → our ledger event_type + projected status.
const STATUS_RANK = { initialized: 0, authorized: 1, failed: 2, canceled: 2, captured: 3, refunded: 4 };

// The ledger's forward-only guarantee: status may only move to a higher-ranked
// state. Duplicate or out-of-order webhook deliveries (Stripe is at-least-once)
// therefore can never move a captured payment back to "authorized", etc.
function advancesStatus(current, next) {
  return (STATUS_RANK[next] ?? 0) > (STATUS_RANK[current] ?? 0);
}

function mapEvent(stripeType) {
  switch (stripeType) {
    case 'payment_intent.created':                   return { event: 'payment_initialized', status: 'initialized' };
    case 'payment_intent.processing':                return { event: 'payment_processing',  status: 'authorized' };
    case 'payment_intent.requires_action':
    case 'payment_intent.amount_capturable_updated': return { event: 'payment_authorized',  status: 'authorized' };
    case 'payment_intent.succeeded':                 return { event: 'payment_captured',    status: 'captured' };
    case 'payment_intent.payment_failed':            return { event: 'payment_failed',      status: 'failed' };
    case 'payment_intent.canceled':                  return { event: 'payment_canceled',    status: 'canceled' };
    case 'charge.refunded':
    case 'charge.refund.updated':                    return { event: 'payment_refunded',    status: 'refunded' };
    default:                                          return null;
  }
}


/**
 * STATUS = FULL EVENT TIMELINE.
 *
 * The stored `payment_intents.status` column is a cache. This is the answer.
 *
 * Deriving matters for the two failures that are otherwise indistinguishable
 * from success: a charge that went through while our response was lost, and a
 * charge that later failed or was refunded after we had already written
 * "captured". The ledger is append-only and every row carries when Stripe says
 * it happened, so the highest-ranked event that actually arrived is the truth
 * regardless of what order the webhooks did.
 *
 * Rank rather than recency on purpose: Stripe does not guarantee delivery
 * order, and a late-arriving `payment_authorized` must never demote a capture.
 * Refunded outranks captured because it genuinely is the later state of the
 * world, and a refund is the one thing that should override a success.
 */
const EVENT_TO_STATUS = {
  payment_initialized: 'initialized',
  payment_processing:  'authorized',
  payment_authorized:  'authorized',
  payment_captured:    'captured',
  payment_failed:      'failed',
  payment_canceled:    'canceled',
  payment_refunded:    'refunded',
};

function deriveStatus(events = []) {
  let best = null;
  for (const row of events) {
    const status = EVENT_TO_STATUS[row.event_type];
    if (!status) continue;
    if (best === null || (STATUS_RANK[status] ?? 0) > (STATUS_RANK[best] ?? 0)) best = status;
  }
  return best;
}

async function getOrCreateCustomer(stripe, dbUser) {
  const [rows] = await pool.query('SELECT stripe_customer_id, email, full_name FROM users WHERE id = ?', [dbUser.id]);
  const u = rows[0] || {};
  if (u.stripe_customer_id) return u.stripe_customer_id;
  const customer = await stripe.customers.create({ email: u.email, name: u.full_name, metadata: { user_id: dbUser.id } });
  await pool.query('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customer.id, dbUser.id]);
  return customer.id;
}

// ── GET /api/payments/methods — saved cards (metadata only) ───
router.get('/methods', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, brand, last4, exp_month, exp_year, is_default FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC',
      [req.dbUser.id]
    );
    res.json(rows);
  } catch (err) { console.error('payments/methods:', err); res.status(500).json({ error: 'Could not load payment methods.' }); }
});

// ── POST /api/payments/methods — save a tokenized card ────────
// Body: { payment_method_id }. The card was tokenized on the client; we only
// attach the pm id to the customer and store display metadata (brand/last4).
router.post('/methods', requireAuth, validate(schemas.attachPaymentMethod), async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Payments are not configured yet.' });
  const { payment_method_id } = req.body || {};
  if (!payment_method_id) return res.status(400).json({ error: 'payment_method_id is required.' });
  try {
    const customer = await getOrCreateCustomer(stripe, req.dbUser);
    try { await stripe.paymentMethods.attach(payment_method_id, { customer }); } catch (e) { if (!/already been attached/i.test(e.message || '')) throw e; }
    const pm = await stripe.paymentMethods.retrieve(payment_method_id);
    if (!pm.card) return res.status(400).json({ error: 'That payment method is not a card.' });
    const [existing] = await pool.query('SELECT COUNT(*) AS n FROM payment_methods WHERE user_id = ?', [req.dbUser.id]);
    const isFirst = Number(existing[0].n) === 0;
    const id = uuidv4();
    await pool.query(
      `INSERT INTO payment_methods (id, user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE brand = VALUES(brand), last4 = VALUES(last4), exp_month = VALUES(exp_month), exp_year = VALUES(exp_year)`,
      [id, req.dbUser.id, payment_method_id, pm.card.brand, pm.card.last4, pm.card.exp_month, pm.card.exp_year, isFirst]
    );
    res.status(201).json({ id, brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year, is_default: isFirst });
  } catch (err) {
    console.error('payments/methods add:', err);
    res.status(402).json({ error: err.message || 'Could not save card.' });
  }
});

// ── DELETE /api/payments/methods/:id — detach a saved card ────
router.delete('/methods/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT stripe_payment_method_id FROM payment_methods WHERE id = ? AND user_id = ?', [req.params.id, req.dbUser.id]);
    if (!rows.length) return res.status(404).json({ error: 'Card not found.' });
    const stripe = getStripe();
    if (stripe) { try { await stripe.paymentMethods.detach(rows[0].stripe_payment_method_id); } catch { /* already gone */ } }
    await pool.query('DELETE FROM payment_methods WHERE id = ? AND user_id = ?', [req.params.id, req.dbUser.id]);
    res.json({ ok: true });
  } catch (err) { console.error('payments/methods delete:', err); res.status(500).json({ error: 'Could not remove card.' }); }
});



/**
 * Stripe's subscription object → our users row. One writer, used by both the
 * routes and the webhook, so a state change cannot be recorded two different
 * ways depending on which arrived first.
 *
 * premium_until takes current_period_end. That is what makes access expire on
 * its own: no sweep job, no cron, no "did we remember to revoke it". If Stripe
 * stops renewing, the date stops moving and lib/premium.js stops entitling.
 */
async function applySubscriptionState(conn, userId, subscription, planHint) {
  const plan = planHint
    || subscription?.metadata?.lyne_plan
    || subscription?.items?.data?.[0]?.price?.metadata?.lyne_plan
    || null;

  const status = subscription?.status || null;
  const periodEnd = fromUnix(subscription?.current_period_end);
  const entitled = subscriptionEntitles(status);

  await conn.query(
    `UPDATE users SET
       stripe_subscription_id = ?,
       subscription_plan      = ?,
       subscription_status    = ?,
       cancel_at_period_end   = ?,
       is_premium             = ?,
       premium_until          = ?,
       updated_at             = NOW()
     WHERE id = ?`,
    [
      subscription?.id || null,
      plan,
      status,
      subscription?.cancel_at_period_end ? 1 : 0,
      entitled ? 1 : 0,
      /* A subscription that has ended keeps its last period end rather than
         being nulled: NULL means "legacy permanent grant" in this schema, and
         writing it here would hand a cancelled customer unlimited access. */
      periodEnd,
      userId,
    ]
  );
}


/* ── The web portal ───────────────────────────────────────────────────────
   Apple does not permit the app to sell a subscription, so buying and
   cancelling happen on the website. These three endpoints are what make that
   possible without putting a login form on a public marketing site. */

// ── POST /api/payments/portal/verify — public, rate-limited ──
// The website calls this before it renders anything. A failure here means the
// route must behave exactly like a page that does not exist: no form, no
// "session expired", no confirmation that /account is real.
router.post('/portal/verify', (req, res) => {
  const result = portalHandoff.verify(req.body?.token);
  // Deliberately uniform. The reason is logged, never returned — distinguishing
  // "expired" from "forged" tells an attacker which half to work on.
  if (!result.valid) {
    console.warn('[portal] handoff rejected:', result.reason);
    /* Byte-identical to the app's own 404 (index.js). An earlier version said
       "Not found." while the catch-all says "Route not found." — a one-word
       difference that told an attacker the portal endpoint exists and had
       rejected them, rather than that nothing is there. That is the whole
       property this route is built for, defeated by a string. */
    return res.status(404).json({ error: 'Route not found.' });
  }
  res.json({ ok: true });
});

// ── POST /api/payments/checkout-session ──
// Stripe's own hosted page. It handles 3-D Secure, the receipt, and the card
// form, none of which we should be reimplementing to look slightly different.
router.post('/checkout-session', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Payments are not configured yet.' });
  if (!req.dbUser) return res.status(404).json({ error: 'No user record found.' });

  const plan = req.body?.plan;
  if (!planFor(plan)) return res.status(400).json({ error: 'Unknown plan.' });

  try {
    const customer = await getOrCreateCustomer(stripe, req.dbUser);
    await ensureCustomerEmail(stripe, customer, req.dbUser.email);
    const price = await ensurePrice(stripe, plan);
    const site = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: `${site}/account?checkout=done`,
      cancel_url: `${site}/account?checkout=cancelled`,
      // The subscription carries the same metadata the webhook reads, so a
      // renewal months from now still resolves to a user and a plan.
      subscription_data: { metadata: { lyne_user_id: req.dbUser.id, lyne_plan: plan } },
      client_reference_id: req.dbUser.id,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('checkout session error:', err);
    res.status(500).json({ error: 'Could not start checkout.' });
  }
});

// ── POST /api/payments/billing-portal ──
// Stripe's hosted management page: change card, change plan, cancel, download
// invoices. Cancelling through it emits customer.subscription.updated, which
// the webhook already handles — so the cancel path needs no bespoke code and
// cannot drift from what Stripe believes.
router.post('/billing-portal', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Payments are not configured yet.' });
  if (!req.dbUser) return res.status(404).json({ error: 'No user record found.' });

  try {
    const [rows] = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id = ? LIMIT 1', [req.dbUser.id]
    );
    const customer = rows[0]?.stripe_customer_id;
    if (!customer) return res.status(404).json({ error: 'You do not have a subscription to manage.' });

    const site = (process.env.FRONTEND_URL || '').replace(/\/+$/, '');
    const session = await stripe.billingPortal.sessions.create({
      customer,
      return_url: `${site}/account`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('billing portal error:', err);
    res.status(500).json({ error: 'Could not open subscription management.' });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   SUBSCRIPTIONS
   ══════════════════════════════════════════════════════════════════════════ */

// ── GET /api/payments/plans — public, so the price is visible BEFORE signup ──
// The old flow charged $9.99 without ever showing a number. A price the
// customer has not seen is not a price they agreed to.
router.get('/plans', (_req, res) => {
  res.json({
    currency: CURRENCY,
    plans: PLAN_IDS.map((id) => ({
      id,
      label: PLANS[id].label,
      amount_cents: PLANS[id].amountCents,
      interval: PLANS[id].interval,
    })),
    yearly_saving_cents: yearlySavingCents(),
  });
});

// ── GET /api/payments/subscription — what am I paying, and when next? ──
router.get('/subscription', requireAuth, async (req, res) => {
  if (!req.dbUser) return res.status(404).json({ error: 'No user record found.' });
  try {
    const [rows] = await pool.query(
      `SELECT stripe_subscription_id, subscription_plan, subscription_status,
              cancel_at_period_end, premium_until
         FROM users WHERE id = ? LIMIT 1`,
      [req.dbUser.id]
    );
    res.json(toClientShape(rows[0] || {}));
  } catch (err) {
    console.error('subscription read error:', err);
    res.status(500).json({ error: 'Could not load your subscription.' });
  }
});

// ── POST /api/payments/subscription — start one ──
router.post('/subscription', requireAuth, validate(schemas.startSubscription), async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Payments are not configured yet.' });
  if (!req.dbUser) return res.status(404).json({ error: 'No user record found.' });

  const { plan, payment_method_id, idempotency_key } = req.body;
  if (!planFor(plan)) return res.status(400).json({ error: 'Unknown plan.' });

  try {
    const [existing] = await pool.query(
      'SELECT stripe_subscription_id, subscription_status FROM users WHERE id = ? LIMIT 1',
      [req.dbUser.id]
    );
    // Refuse rather than stack a second subscription on the same customer —
    // double-charging somebody who tapped twice is not a bug we get to shrug at.
    if (existing[0]?.stripe_subscription_id && subscriptionEntitles(existing[0].subscription_status)) {
      return res.status(409).json({ error: 'You already have an active Lyne Premium subscription.' });
    }

    const customer = await getOrCreateCustomer(stripe, req.dbUser);
    await ensureCustomerEmail(stripe, customer, req.dbUser.email);

    await stripe.paymentMethods.attach(payment_method_id, { customer }).catch((err) => {
      if (err?.code !== 'resource_already_attached') throw err;
    });
    await stripe.customers.update(customer, {
      invoice_settings: { default_payment_method: payment_method_id },
    });

    const price = await ensurePrice(stripe, plan);
    const subscription = await stripe.subscriptions.create({
      customer,
      items: [{ price: price.id }],
      default_payment_method: payment_method_id,
      payment_behavior: 'error_if_incomplete',
      expand: ['latest_invoice.payment_intent'],
      metadata: { lyne_user_id: req.dbUser.id, lyne_plan: plan },
    }, { idempotencyKey: idempotency_key });

    await applySubscriptionState(pool, req.dbUser.id, subscription, plan);

    const [updated] = await pool.query(
      `SELECT stripe_subscription_id, subscription_plan, subscription_status,
              cancel_at_period_end, premium_until FROM users WHERE id = ? LIMIT 1`,
      [req.dbUser.id]
    );
    res.status(201).json(toClientShape(updated[0]));
  } catch (err) {
    console.error('subscription create error:', err);
    const message = err?.type === 'StripeCardError'
      ? (err.message || 'Your card was declined.')
      : 'Could not start your subscription.';
    res.status(err?.type === 'StripeCardError' ? 402 : 500).json({ error: message });
  }
});

// ── POST /api/payments/subscription/cancel ──
// One call. No retention flow, no "are you sure" chain, no support ticket. The
// customer keeps what they already paid for and is not charged again.
router.post('/subscription/cancel', requireAuth, validate(schemas.cancelSubscription), async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Payments are not configured yet.' });
  if (!req.dbUser) return res.status(404).json({ error: 'No user record found.' });

  try {
    const [rows] = await pool.query(
      'SELECT stripe_subscription_id FROM users WHERE id = ? LIMIT 1', [req.dbUser.id]
    );
    const subId = rows[0]?.stripe_subscription_id;
    if (!subId) return res.status(404).json({ error: 'You do not have a subscription to cancel.' });

    const subscription = await stripe.subscriptions.update(subId, {
      cancel_at_period_end: true,
      metadata: { lyne_cancel_reason: (req.body?.reason || '').slice(0, 500) },
    });
    await applySubscriptionState(pool, req.dbUser.id, subscription);

    const endsAt = fromUnix(subscription.current_period_end);
    res.json({
      message: endsAt
        ? `Cancelled. You keep Lyne Premium until ${endsAt.toISOString().slice(0, 10)}, and you will not be charged again.`
        : 'Cancelled. You will not be charged again.',
      access_until: endsAt ? endsAt.toISOString() : null,
      cancel_at_period_end: true,
    });
  } catch (err) {
    console.error('subscription cancel error:', err);
    res.status(500).json({ error: 'Could not cancel your subscription. Please try again.' });
  }
});

// ── POST /api/payments/subscription/resume ──
// Undo, available right up to the period end. Somebody who cancels by mistake
// should not have to re-enter a card.
router.post('/subscription/resume', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Payments are not configured yet.' });
  if (!req.dbUser) return res.status(404).json({ error: 'No user record found.' });

  try {
    const [rows] = await pool.query(
      'SELECT stripe_subscription_id, cancel_at_period_end FROM users WHERE id = ? LIMIT 1', [req.dbUser.id]
    );
    const subId = rows[0]?.stripe_subscription_id;
    if (!subId) return res.status(404).json({ error: 'You do not have a subscription.' });
    if (!Number(rows[0].cancel_at_period_end)) {
      return res.status(409).json({ error: 'Your subscription is not scheduled to end.' });
    }

    const subscription = await stripe.subscriptions.update(subId, { cancel_at_period_end: false });
    await applySubscriptionState(pool, req.dbUser.id, subscription);
    res.json({ message: 'Your subscription will continue.', cancel_at_period_end: false });
  } catch (err) {
    console.error('subscription resume error:', err);
    res.status(500).json({ error: 'Could not resume your subscription.' });
  }
});

// ── POST /api/payments/create-intent — start a charge ─────────
// Body: { payment_method_id, idempotency_key, amount_cents?, purpose?, save_card? }
router.post('/create-intent', requireAuth, validate(schemas.createIntent), async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Payments are not configured yet.' });

  const { payment_method_id, idempotency_key, purpose = 'premium_subscription', save_card } = req.body || {};
  if (!payment_method_id || !idempotency_key) return res.status(400).json({ error: 'payment_method_id and idempotency_key are required.' });

  /* amount_cents is deliberately NOT destructured — see PURPOSE_PRICES above.
     Anything the caller sends under that name is ignored, not honoured. */
  const amount = priceFor(purpose);
  if (amount === null) return res.status(400).json({ error: 'Unknown purpose.' });

  try {
    // Idempotent at our layer: same key → return the existing attempt, never re-charge.
    const [existing] = await pool.query('SELECT id, status, stripe_payment_intent_id FROM payment_intents WHERE idempotency_key = ?', [idempotency_key]);
    if (existing.length) return res.json({ id: existing[0].id, status: existing[0].status, reused: true });

    const customer = await getOrCreateCustomer(stripe, req.dbUser);

    // Card data was tokenized on the client; we only ever handle the pm id.
    const pi = await stripe.paymentIntents.create({
      amount, currency: CURRENCY, customer,
      payment_method: payment_method_id,
      confirm: true,
      description: purpose,
      metadata: { user_id: req.dbUser.id, purpose },
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    }, { idempotencyKey: idempotency_key });

    const intentId = uuidv4();
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        `INSERT INTO payment_intents (id, user_id, idempotency_key, stripe_payment_intent_id, purpose, amount_cents, currency, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'initialized')`,
        [intentId, req.dbUser.id, idempotency_key, pi.id, purpose, amount, CURRENCY]
      );
      await conn.query(
        `INSERT INTO payment_events (id, payment_intent_id, stripe_event_id, event_type, amount_cents, payload, occurred_at)
         VALUES (?, ?, NULL, 'payment_initialized', ?, ?, NOW())`,
        [uuidv4(), intentId, amount, JSON.stringify({ stripe_status: pi.status })]
      );
      await conn.commit();
    } catch (e) { await conn.rollback(); throw e; } finally { conn.release(); }

    // Optionally remember the card (metadata only) for next time.
    if (save_card) {
      try {
        const pm = await stripe.paymentMethods.retrieve(payment_method_id);
        if (pm.card) {
          await pool.query(
            `INSERT INTO payment_methods (id, user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, is_default)
             VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)
             ON DUPLICATE KEY UPDATE brand = VALUES(brand), last4 = VALUES(last4), exp_month = VALUES(exp_month), exp_year = VALUES(exp_year)`,
            [uuidv4(), req.dbUser.id, payment_method_id, pm.card.brand, pm.card.last4, pm.card.exp_month, pm.card.exp_year]
          );
        }
      } catch (e) { console.error('save_card:', e.message); /* non-fatal */ }
    }

    res.json({ id: intentId, status: 'initialized', stripe_status: pi.status, client_secret: pi.client_secret });
  } catch (err) {
    console.error('create-intent:', err);
    res.status(402).json({ error: err.message || 'Payment could not be started.' });
  }
});

// ── GET /api/payments/intents/:id — status + full event timeline ──
router.get('/intents/:id', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, status, amount_cents, currency, purpose, created_at FROM payment_intents WHERE id = ? AND user_id = ?', [req.params.id, req.dbUser.id]);
    if (!rows.length) return res.status(404).json({ error: 'Payment not found.' });
    const [events] = await pool.query('SELECT event_type, amount_cents, occurred_at, recorded_at FROM payment_events WHERE payment_intent_id = ? ORDER BY recorded_at ASC', [req.params.id]);

    /* The ledger is authoritative; the column is a cache. When they disagree
       the cache lost a webhook, and saying so is more useful than quietly
       serving either one — that disagreement IS the reconciliation signal. */
    const derived = deriveStatus(events);
    res.json({
      ...rows[0],
      status: derived || rows[0].status,
      stored_status: rows[0].status,
      status_source: derived ? 'timeline' : 'stored',
      needs_reconciliation: Boolean(derived && derived !== rows[0].status),
      timeline: events,
    });
  } catch (err) { console.error('intents/:id:', err); res.status(500).json({ error: 'Could not load payment.' }); }
});

// ── POST /api/payments/webhook — Stripe's source of truth ─────
// Mounted in index.js with express.raw so the signature can be verified.


/**
 * A renewal is a payment, so it belongs in the payment ledger.
 *
 * The subscription handler wrote nothing here at first: it moved
 * users.premium_until and left no trace. That is exactly the gap the ledger
 * exists to close — "somebody paid and it did not register" is unanswerable
 * without a row saying money moved.
 *
 * Every Stripe invoice carries a PaymentIntent, so a renewal charge already IS
 * one; it does not need a parallel table. This finds or creates the
 * payment_intents row for an invoice, so the ledger event has something to hang
 * on and a subscriber's history reads as one timeline rather than two systems.
 */
async function intentRowForInvoice(invoice, userId) {
  const piId = typeof invoice.payment_intent === 'string'
    ? invoice.payment_intent
    : invoice.payment_intent?.id;
  if (!piId) return null;

  const [existing] = await pool.query(
    'SELECT id FROM payment_intents WHERE stripe_payment_intent_id = ? LIMIT 1', [piId]
  );
  if (existing.length) return existing[0].id;

  const id = uuidv4();
  await pool.query(
    `INSERT INTO payment_intents
       (id, user_id, idempotency_key, stripe_payment_intent_id, purpose, amount_cents, currency, status)
     VALUES (?, ?, ?, ?, 'premium_subscription', ?, ?, 'initialized')`,
    [id, userId, `invoice_${invoice.id}`, piId,
     invoice.amount_paid ?? invoice.amount_due ?? 0,
     (invoice.currency || CURRENCY).toLowerCase()]
  );
  return id;
}

/** Append to the ledger. uk_stripe_event makes a redelivered webhook a no-op. */
async function recordLedgerEvent(intentId, eventType, stripeEventId, amountCents, payload, occurredAt) {
  if (!intentId) return;
  try {
    await pool.query(
      `INSERT INTO payment_events
         (id, payment_intent_id, stripe_event_id, event_type, amount_cents, payload, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), intentId, stripeEventId || null, eventType, amountCents ?? null,
       JSON.stringify(payload || {}), occurredAt || new Date()]
    );
  } catch (err) {
    // Duplicate stripe_event_id: Stripe redelivered. The ledger already holds
    // it, which is the point of the unique key.
    if (err?.code !== 'ER_DUP_ENTRY') throw err;
  }
}

/**
 * Subscription lifecycle, handled before the PaymentIntent path below.
 *
 * These events carry no payment_intent, so the existing handler would have
 * dropped them on the "no payment_intent reference" line and Stripe would have
 * seen 200 OK while nothing was recorded — a renewal that silently never
 * extended anybody's access.
 *
 * Returns true when it claimed the event.
 */
async function handleSubscriptionEvent(event) {
  const obj = event.data.object || {};

  // ── the customer was told, before the money moved ──
  if (event.type === 'invoice.upcoming') {
    const subId = obj.subscription;
    const dueAt = fromUnix(obj.next_payment_attempt || obj.period_end);
    if (!subId || !dueAt) return true;

    const [rows] = await pool.query(
      `SELECT id, subscription_plan, renewal_notice_sent_for
         FROM users WHERE stripe_subscription_id = ? LIMIT 1`,
      [subId]
    );
    const user = rows[0];
    if (!user) return true;

    /* Stripe can deliver invoice.upcoming more than once for the same invoice.
       Being told twice that money is about to leave your account is the
       opposite of the reassurance this is meant to be. */
    const already = user.renewal_notice_sent_for
      && new Date(user.renewal_notice_sent_for).getTime() === dueAt.getTime();
    if (already) return true;

    const amount = ((obj.amount_due ?? 0) / 100).toFixed(2);
    const when = dueAt.toISOString().slice(0, 10);
    await pool.query(
      `INSERT INTO notifications (id, user_id, notification_type, channel, message)
       VALUES (?, ?, 'general', 'push', ?)`,
      [uuidv4(), user.id,
       `Your Lyne Premium renews on ${when} for $${amount}. You can cancel any time in Account before then.`]
    );
    await pool.query(
      'UPDATE users SET renewal_notice_sent_for = ? WHERE id = ?', [dueAt, user.id]
    );
    return true;
  }

  // ── a renewal succeeded: move the paid-through date forward ──
  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') {
    const subId = obj.subscription;
    if (!subId) return true;
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subId);
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE stripe_subscription_id = ? LIMIT 1', [subId]
    );
    if (rows[0]) {
      await applySubscriptionState(pool, rows[0].id, subscription);
      const intentId = await intentRowForInvoice(obj, rows[0].id);
      await recordLedgerEvent(
        intentId, 'payment_captured', event.id,
        obj.amount_paid ?? obj.amount_due, { invoice: obj.id, subscription: subId },
        fromUnix(event.created)
      );
      if (intentId) {
        await pool.query('UPDATE payment_intents SET status = ? WHERE id = ?', ['captured', intentId]);
      }
    }
    return true;
  }

  // ── created / updated / deleted: mirror Stripe verbatim ──
  if (event.type.startsWith('customer.subscription.')) {
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE stripe_subscription_id = ? LIMIT 1', [obj.id]
    );
    const userId = rows[0]?.id || obj.metadata?.lyne_user_id || null;
    if (userId) await applySubscriptionState(pool, userId, obj);
    return true;
  }

  // ── payment failed: Stripe keeps retrying, so do not cut access here ──
  // past_due still entitles (see ENTITLING_STATUSES); premium_until is what
  // actually ends it. Cutting off at the first failed retry punishes an expired
  // card rather than a non-payer.
  if (event.type === 'invoice.payment_failed') {
    const subId = obj.subscription;
    if (!subId) return true;
    const [rows] = await pool.query(
      'SELECT id FROM users WHERE stripe_subscription_id = ? LIMIT 1', [subId]
    );
    if (rows[0]) {
      const intentId = await intentRowForInvoice(obj, rows[0].id);
      await recordLedgerEvent(
        intentId, 'payment_failed', event.id,
        obj.amount_due, { invoice: obj.id, subscription: subId }, fromUnix(event.created)
      );
      await pool.query(
        `INSERT INTO notifications (id, user_id, notification_type, channel, message)
         VALUES (?, ?, 'general', 'push', ?)`,
        [uuidv4(), rows[0].id,
         'We could not take payment for Lyne Premium. Update your card in Account to keep it — you have not lost access yet.']
      );
    }
    return true;
  }

  return false;
}

async function webhookHandler(req, res) {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Payments not configured.');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
  }

  /* Subscription events first: they carry no payment_intent, so the mapping
     below would ignore them and the PaymentIntent path would drop them. */
  try {
    if (await handleSubscriptionEvent(event)) {
      return res.json({ received: true, handled: event.type });
    }
  } catch (err) {
    console.error('[webhook] subscription event failed:', event.type, err.message);
    // 500 so Stripe retries — a missed renewal must not be silently accepted.
    return res.status(500).json({ error: 'Subscription event could not be recorded.' });
  }

  const mapped = mapEvent(event.type);
  if (!mapped) return res.json({ received: true, ignored: event.type });

  const obj = event.data.object || {};
  const piStripeId = obj.object === 'payment_intent' ? obj.id : obj.payment_intent;
  if (!piStripeId) return res.json({ received: true, note: 'no payment_intent reference' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Exclusive lock on the payment row — serialize concurrent/out-of-order events.
    const [rows] = await conn.query('SELECT id, user_id, status FROM payment_intents WHERE stripe_payment_intent_id = ? FOR UPDATE', [piStripeId]);
    if (!rows.length) { await conn.commit(); return res.json({ received: true, note: 'no matching intent' }); }
    const intent = rows[0];

    // Append to the immutable ledger; unique stripe_event_id makes replays no-ops.
    try {
      await conn.query(
        `INSERT INTO payment_events (id, payment_intent_id, stripe_event_id, event_type, amount_cents, payload, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(?))`,
        [uuidv4(), intent.id, event.id, mapped.event, obj.amount ?? obj.amount_received ?? null, JSON.stringify(obj), event.created]
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') { await conn.commit(); return res.json({ received: true, duplicate: true }); }
      throw e;
    }

    // Forward-only status projection.
    if (advancesStatus(intent.status, mapped.status)) {
      await conn.query('UPDATE payment_intents SET status = ? WHERE id = ?', [mapped.status, intent.id]);
      if (mapped.status === 'captured') {
        /* premium_until must be CLEARED, not left alone: a customer who
           subscribes during their trial would otherwise keep the trial's end
           date and lose access on that day despite having paid. */
        await conn.query(
          'UPDATE users SET is_premium = TRUE, premium_until = NULL, updated_at = NOW() WHERE id = ?',
          [intent.user_id]
        );
      }
    }

    await conn.commit();
    res.json({ received: true });
  } catch (err) {
    await conn.rollback();
    console.error('payments webhook:', err);
    res.status(500).send('Webhook processing failed.'); // Stripe retries (at-least-once)
  } finally {
    conn.release();
  }
}

module.exports = { router, webhookHandler, mapEvent, advancesStatus, STATUS_RANK, priceFor, PURPOSE_PRICES, deriveStatus, EVENT_TO_STATUS };

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

const DEFAULT_PREMIUM_CENTS = Number(process.env.PREMIUM_PRICE_CENTS || 999);
const CURRENCY = (process.env.PREMIUM_CURRENCY || 'usd').toLowerCase();

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

// ── POST /api/payments/create-intent — start a charge ─────────
// Body: { payment_method_id, idempotency_key, amount_cents?, purpose?, save_card? }
router.post('/create-intent', requireAuth, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) return res.status(503).json({ error: 'Payments are not configured yet.' });

  const { payment_method_id, idempotency_key, amount_cents, purpose = 'premium_subscription', save_card } = req.body || {};
  if (!payment_method_id || !idempotency_key) return res.status(400).json({ error: 'payment_method_id and idempotency_key are required.' });
  const amount = Number.isInteger(amount_cents) && amount_cents > 0 ? amount_cents : DEFAULT_PREMIUM_CENTS;

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
    res.json({ ...rows[0], timeline: events });
  } catch (err) { console.error('intents/:id:', err); res.status(500).json({ error: 'Could not load payment.' }); }
});

// ── POST /api/payments/webhook — Stripe's source of truth ─────
// Mounted in index.js with express.raw so the signature can be verified.
async function webhookHandler(req, res) {
  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Payments not configured.');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
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
    if ((STATUS_RANK[mapped.status] ?? 0) > (STATUS_RANK[intent.status] ?? 0)) {
      await conn.query('UPDATE payment_intents SET status = ? WHERE id = ?', [mapped.status, intent.id]);
      if (mapped.status === 'captured') {
        await conn.query('UPDATE users SET is_premium = TRUE, updated_at = NOW() WHERE id = ?', [intent.user_id]);
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

module.exports = { router, webhookHandler };

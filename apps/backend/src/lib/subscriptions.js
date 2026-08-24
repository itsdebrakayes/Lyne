/**
 * subscriptions.js — the recurring half of Lyne Premium.
 *
 * What replaced what: `POST /payments/create-intent` charged a one-time
 * PaymentIntent, described it as `premium_subscription`, set is_premium = TRUE
 * with no end date, and never renewed. It could not be cancelled because there
 * was nothing to cancel, and the customer was never told a price before the
 * charge. This module is the actual subscription.
 *
 * Three commitments are wired in here rather than left to the UI, because a
 * promise the interface makes and the server does not keep is not a promise:
 *
 *   Receipts.  Stripe emails one per successful invoice. That needs the
 *              Customer to carry the right email — ensureCustomerEmail below —
 *              and the "Successful payments" toggle enabled once in the Stripe
 *              dashboard. We do not send it ourselves: there is no mail
 *              provider in this backend, and inventing one to duplicate an
 *              email Stripe already sends would be worse, not better.
 *
 *   Warning before charging.  Stripe fires `invoice.upcoming` ahead of every
 *              renewal (7 days by default). We turn that into a notification
 *              the customer actually receives, deduplicated so nobody is told
 *              twice that money is about to leave their account.
 *
 *   Cancelling is easy and honest.  cancelSubscription sets
 *              cancel_at_period_end, so the customer keeps the period they paid
 *              for and is not charged again. It is one call, it is reversible
 *              until the period ends, and it never asks anybody to email
 *              support.
 */

const { PLANS, planFor } = require('./premium');

const CURRENCY = (process.env.PREMIUM_CURRENCY || 'usd').toLowerCase();
const PRODUCT_NAME = 'Lyne Premium';

/**
 * Find or create the Stripe Price for a plan.
 *
 * Looked up by metadata rather than a hardcoded price id so a fresh Stripe
 * account — a new test key, a different environment — works without anybody
 * clicking through the dashboard first. Prices are immutable in Stripe, so
 * changing an amount in PLANS creates a new Price and leaves existing
 * subscribers on the one they agreed to, which is the correct behaviour and
 * not something to work around.
 */
async function ensurePrice(stripe, planId) {
  const plan = planFor(planId);
  if (!plan) return null;

  const lookupKey = `lyne_premium_${planId}_${plan.amountCents}_${CURRENCY}`;

  const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 });
  if (existing.data.length) return existing.data[0];

  return stripe.prices.create({
    lookup_key: lookupKey,
    currency: CURRENCY,
    unit_amount: plan.amountCents,
    recurring: { interval: plan.interval, interval_count: plan.intervalCount },
    product_data: { name: `${PRODUCT_NAME} — ${planId}` },
    metadata: { lyne_plan: planId },
  });
}

/**
 * Stripe's receipt goes to the address on the Customer, not the one in our
 * users table. They drift — somebody changes their email in the app — and the
 * receipt then goes to an address they no longer read.
 */
async function ensureCustomerEmail(stripe, customerId, email) {
  if (!customerId || !email) return;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !customer.deleted && customer.email !== email) {
      await stripe.customers.update(customerId, { email });
    }
  } catch (err) {
    // A receipt going to a stale address is bad; failing the subscription over
    // it is worse. Log and carry on.
    console.error('[subscriptions] could not sync customer email:', err.message);
  }
}

/** Seconds since epoch (Stripe) → Date, tolerating null. */
function fromUnix(seconds) {
  return seconds ? new Date(seconds * 1000) : null;
}

/**
 * The subscription as the app should see it. Deliberately shaped around the
 * three questions a customer actually has — am I paying, how much, and when
 * does it next happen — rather than around Stripe's object.
 */
function toClientShape(user) {
  const planId = user?.subscription_plan || null;
  const plan = planId ? PLANS[planId] : null;
  const renewsOn = user?.premium_until ? new Date(user.premium_until) : null;
  const cancelling = Boolean(Number(user?.cancel_at_period_end));

  return {
    plan: planId,
    price_label: plan ? plan.label : null,
    amount_cents: plan ? plan.amountCents : null,
    currency: CURRENCY,
    status: user?.subscription_status || null,
    /* When cancelling, this is the last day of access, not a renewal date. The
       app must not print "renews on" over it — hence two named fields rather
       than one date the caller has to interpret. */
    renews_on: cancelling ? null : (renewsOn ? renewsOn.toISOString() : null),
    access_until: renewsOn ? renewsOn.toISOString() : null,
    cancel_at_period_end: cancelling,
    is_subscribed: Boolean(user?.stripe_subscription_id) && !!planId,
  };
}

module.exports = {
  CURRENCY,
  PRODUCT_NAME,
  ensurePrice,
  ensureCustomerEmail,
  fromUnix,
  toClientShape,
};

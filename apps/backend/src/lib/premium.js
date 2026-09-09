/**
 * premium.js — one definition of "does this customer have premium".
 *
 * is_premium on its own is not the answer. A trial sets premium_until to a
 * date; a paid subscription leaves it NULL. Reading the flag alone is what let
 * a 14-day trial last forever, so every surface that gates a paid feature must
 * go through here rather than testing the column directly.
 */

const TRIAL_DAYS = 14;

/* ── The price list ───────────────────────────────────────────────────────
   Server-side, like every price in this codebase — see PURPOSE_PRICES in
   routes/payments.js and the reason it exists.

   $10 a month, or $100 for a year. The annual is two months free; that is the
   reason to offer it, not a rounding artefact, so the saving is published
   rather than left for the customer to work out.

   Amounts are in cents and the currency is USD. PREMIUM_CURRENCY can override
   it, but changing it does NOT reprice: 1000 cents is $10 and would be J$10 if
   the currency moved without new amounts. Whoever changes the currency has to
   change the numbers too, deliberately. */
const PLANS = {
  monthly: { interval: 'month', intervalCount: 1, amountCents: 1000,  label: '$10 / month' },
  yearly:  { interval: 'year',  intervalCount: 1, amountCents: 10000, label: '$100 / year' },
};

const PLAN_IDS = Object.keys(PLANS);

/** A plan by id, or null. hasOwnProperty so 'constructor' is not a plan. */
function planFor(id) {
  return Object.prototype.hasOwnProperty.call(PLANS, id) ? PLANS[id] : null;
}

/** What the annual saves against twelve months, in cents. */
function yearlySavingCents() {
  return PLANS.monthly.amountCents * 12 - PLANS.yearly.amountCents;
}

/* Stripe statuses that mean the customer should still be able to use what they
   paid for. `past_due` is deliberately included: the card failed but the period
   they already paid for has not ended, and Stripe is still retrying. Cutting
   access at the first failed retry punishes an expired card, not a non-payer —
   premium_until is what actually ends the access. */
const ENTITLING_STATUSES = new Set(['active', 'trialing', 'past_due']);

function subscriptionEntitles(status) {
  return ENTITLING_STATUSES.has(String(status || ''));
}

/** True only while access is genuinely current. */
const { NEVER_EXPOSE } = require('../utils/publicShapes');

function hasPremium(user) {
  if (!user || !Number(user.is_premium)) return false;
  if (!user.premium_until) return true; // no end date: a paid subscription
  return new Date(user.premium_until).getTime() > Date.now();
}

/**
 * The user row as the client should see it: is_premium reflects real access,
 * so an app reading that one field cannot be shown a lapsed trial as active.
 *
 * "As the client should see it" is taken literally now. Every route that hands
 * back a user row goes through here — sync-user, /me, profile save, trial start
 * — and each was passing supabase_uid straight out with it. It is the caller's
 * own uid rather than somebody else's, so nothing was exposed across accounts;
 * but it is the identity binding this system authenticates on, and no client
 * reads it. This function already claims to be the boundary, so it may as well
 * be one.
 */
function withPremiumState(user) {
  if (!user) return user;
  const safe = { ...user, is_premium: hasPremium(user) ? 1 : 0 };
  for (const field of NEVER_EXPOSE) delete safe[field];
  return safe;
}

function trialEndsAt(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

module.exports = {
  hasPremium, withPremiumState, trialEndsAt, TRIAL_DAYS,
  PLANS, PLAN_IDS, planFor, yearlySavingCents,
  ENTITLING_STATUSES, subscriptionEntitles,
};

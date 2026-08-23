/**
 * premium.js — one definition of "does this customer have premium".
 *
 * is_premium on its own is not the answer. A trial sets premium_until to a
 * date; a paid subscription leaves it NULL. Reading the flag alone is what let
 * a 14-day trial last forever, so every surface that gates a paid feature must
 * go through here rather than testing the column directly.
 */

const TRIAL_DAYS = 14;

/** True only while access is genuinely current. */
function hasPremium(user) {
  if (!user || !Number(user.is_premium)) return false;
  if (!user.premium_until) return true; // no end date: a paid subscription
  return new Date(user.premium_until).getTime() > Date.now();
}

/**
 * The user row as the client should see it: is_premium reflects real access,
 * so an app reading that one field cannot be shown a lapsed trial as active.
 */
function withPremiumState(user) {
  if (!user) return user;
  return { ...user, is_premium: hasPremium(user) ? 1 : 0 };
}

function trialEndsAt(from = new Date()) {
  return new Date(from.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

module.exports = { hasPremium, withPremiumState, trialEndsAt, TRIAL_DAYS };

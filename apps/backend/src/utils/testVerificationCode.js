/**
 * testVerificationCode.js — a six-character code that skips customer verification,
 * for testing only.
 *
 * The counter screen will not start service without the code the customer is
 * holding. That is correct, and it stays correct: it is the whole reason a
 * ticket cannot be served to the wrong person. But it also means nobody can
 * exercise call → verify → serve without two devices and a real customer, which
 * is exactly the walkthrough a reviewer or a demo needs to do alone.
 *
 * So there is one code that any ticket will accept. Four things keep it from
 * becoming a hole in the product:
 *
 *   1. It does not exist unless someone sets STAFF_TEST_VERIFICATION_CODE.
 *      There is no default, and no fallback value in this file to discover.
 *   2. It refuses to work when NODE_ENV is 'production', whatever is set.
 *      A .env copied from a laptop to the server does not carry it across.
 *   3. It must be exactly six letters or digits, so it cannot be a phrase
 *      somebody guesses,
 *      and it looks like every other code in the system rather than announcing
 *      itself in the UI.
 *   4. Every use is logged with the ticket and the staff member. A bypass that
 *      leaves no trace is indistinguishable from a break-in after the fact.
 *
 * Turning it off is deleting one line from .env. Nothing else changes.
 */

const RAW = process.env.STAFF_TEST_VERIFICATION_CODE || '';

/* Resolved once, at load, rather than per request — so a misconfiguration is
   visible in the boot log rather than at the counter in front of a customer. */
const ENABLED = (() => {
  if (!RAW) return null;
  if (process.env.NODE_ENV === 'production') {
    console.warn('[verification-bypass] STAFF_TEST_VERIFICATION_CODE is set but IGNORED: NODE_ENV is production.');
    return null;
  }
  if (!/^[A-Za-z0-9]{6}$/.test(RAW.trim())) {
    console.warn('[verification-bypass] STAFF_TEST_VERIFICATION_CODE is set but IGNORED: it must be exactly six letters or digits.');
    return null;
  }
  console.warn(`[verification-bypass] ACTIVE. Any ticket will accept ${RAW.trim()} as its code. Remove STAFF_TEST_VERIFICATION_CODE before deploying.`);
  return RAW.trim();
})();

/**
 * True when the submitted code is the configured test code.
 *
 * Returns false when the feature is off, which is the default — so the caller
 * needs no environment check of its own and cannot forget one.
 */
function isTestVerificationCode(submitted) {
  if (!ENABLED) return false;
  /* Case-insensitive, because real codes are: the counter uppercases what the
     clerk types before comparing, and an override that only matched one casing
     would fail in the one situation it exists for. */
  return String(submitted || '').trim().toUpperCase() === ENABLED.toUpperCase();
}

/** Whether the bypass is live, for the health endpoint to report honestly. */
function testVerificationEnabled() {
  return ENABLED !== null;
}

module.exports = { isTestVerificationCode, testVerificationEnabled };

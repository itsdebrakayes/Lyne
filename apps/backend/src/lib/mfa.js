/**
 * mfa.js — two-factor sign-in for staff (migration 053).
 *
 * Supabase Auth does the cryptography: enrolling an authenticator app, checking
 * the six-digit code, and stamping the session's token with an assurance level
 * (`aal` claim: "aal1" after a password, "aal2" after password + code). This
 * file decides, per request, whether "aal1" is enough.
 *
 * It is not enough when the caller is a supervisor, manager or executive and
 * their organisation requires two-factor (businesses.require_2fa). Nobody turns
 * it on for themselves: the executive decides for the organisation, and each
 * of those people is then walked through setting it up at their next sign-in.
 * Off by default.
 *
 * Kiosk logins and members of the public are never asked. The token's
 * signature has already been checked by Supabase (auth.getUser) before the
 * claim is read here.
 */
const pool = require('../db/pool');

const MFA_ROLES = new Set(['supervisor', 'manager', 'executive']);
const NEVER_ASKED = new Set(['kiosk_clerk']);
const ORG_CACHE_MS = 15_000;
const orgCache = new Map();

function tokenAal(token) {
  try {
    const claims = JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    return claims.aal === 'aal2' ? 'aal2' : 'aal1';
  } catch {
    return 'aal1';
  }
}

/** A verified authenticator-app factor on the Supabase user. */
function hasVerifiedTotp(user) {
  return Array.isArray(user?.factors) && user.factors.some((f) => f.factor_type === 'totp' && f.status === 'verified');
}

async function orgRequires2fa(businessId, db = pool) {
  if (!businessId) return false;
  const hit = orgCache.get(businessId);
  if (hit && hit.expires > Date.now()) return hit.value;
  let value = false;
  try {
    const [rows] = await db.query('SELECT require_2fa FROM businesses WHERE id = ? LIMIT 1', [businessId]);
    value = !!(rows[0] && Number(rows[0].require_2fa));
  } catch (err) {
    // Before migration 053 the column does not exist: nobody is required yet.
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }
  orgCache.set(businessId, { value, expires: Date.now() + ORG_CACHE_MS });
  return value;
}

function forgetOrg(businessId) {
  if (businessId) orgCache.delete(businessId); else orgCache.clear();
}

/**
 * What two-factor means for this request.
 *   applies      the role can be required to use it
 *   orgRequires  the organisation switched it on
 *   enrolled     the person has a verified authenticator app
 *   required     this session must be aal2
 *   aal          what the session is
 *   satisfied    !required || aal2
 */
async function mfaState(staff, user, token, db = pool) {
  const aal = tokenAal(token);
  const enrolled = hasVerifiedTotp(user);
  if (!staff || NEVER_ASKED.has(staff.role_name)) {
    return { applies: false, orgRequires: false, enrolled, required: false, aal, satisfied: true };
  }
  const applies = MFA_ROLES.has(staff.role_name);
  const orgRequires = await orgRequires2fa(staff.business_id, db);
  const required = applies && orgRequires;
  return { applies, orgRequires, enrolled, required, aal, satisfied: !required || aal === 'aal2' };
}

/* The few addresses a signed-in person must reach BEFORE entering their code:
   who am I (so the app knows to ask), sign out, and the two-factor status. */
const OPEN_BEFORE_CODE = new Set(['GET /api/auth/me', 'POST /api/auth/logout', 'GET /api/auth/mfa/status']);

function openBeforeCode(req) {
  return OPEN_BEFORE_CODE.has(`${req.method} ${String(req.originalUrl || '').split('?')[0].replace(/\/+$/, '')}`);
}

/** The refusal the admin app turns into the code prompt or the set-up screen. */
function refusal(state) {
  return state.enrolled
    ? { status: 403, body: { error: 'Enter the code from your authenticator app to continue.', code: 'mfa_required' } }
    : { status: 403, body: { error: 'Your organisation requires two-factor sign-in. Set it up to continue.', code: 'mfa_enrollment_required' } };
}

module.exports = { MFA_ROLES, tokenAal, hasVerifiedTotp, orgRequires2fa, forgetOrg, mfaState, openBeforeCode, refusal };

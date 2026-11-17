/**
 * mfa.js — two-factor sign-in for staff (migration 053).
 *
 * Supabase Auth does the cryptography: enrolling an authenticator app, checking
 * the six-digit code, and stamping the session's token with an assurance level
 * (`aal` claim: "aal1" after a password, "aal2" after password + code). This
 * file decides, per request, whether "aal1" is enough.
 *
 * Who must use it. Off by default; nobody turns it on for themselves.
 *   - Their ORGANISATION requires it (businesses.require_2fa, set by its
 *     executive): its supervisors, managers and executives, every branch.
 *   - Their BRANCH requires it (branches.require_2fa, set by its manager or an
 *     executive of the same organisation): the supervisors and managers whose
 *     own staff record is in that branch. Not executives, not other branches.
 * Desk staff, kiosks and members of the public are never asked.
 *
 * STRICT SCOPE: both switches are read in ONE query keyed on the person's own
 * staff.business_id, and the branch row is joined only when it belongs to that
 * same organisation. No other organisation's or branch's setting can apply.
 * The token's signature has already been checked by Supabase (auth.getUser)
 * before its claim is read here.
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

/** The two switches for one person: their organisation's and their own branch's. */
async function switchesFor(businessId, branchId, db = pool) {
  if (!businessId) return { org: false, branch: false };
  const key = `${businessId}|${branchId || ''}`;
  const hit = orgCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  let value = { org: false, branch: false };
  try {
    const [rows] = await db.query(
      `SELECT b.require_2fa AS org, br.require_2fa AS branch
         FROM businesses b
         LEFT JOIN branches br ON br.id = ? AND br.business_id = b.id
        WHERE b.id = ?
        LIMIT 1`,
      [branchId || null, businessId]
    );
    if (rows[0]) value = { org: !!Number(rows[0].org), branch: !!Number(rows[0].branch) };
  } catch (err) {
    // Before migration 053 the columns do not exist: nobody is required yet.
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
  }
  orgCache.set(key, { value, expires: Date.now() + ORG_CACHE_MS });
  return value;
}

async function orgRequires2fa(businessId, db = pool) {
  return (await switchesFor(businessId, null, db)).org;
}

/** Forget cached switches (all of them: a change is rare and must apply at once). */
function forgetOrg() {
  orgCache.clear();
}

/** Who a branch switch covers. Executives answer to the organisation's switch only. */
const BRANCH_ROLES = new Set(['supervisor', 'manager']);

/**
 * What two-factor means for this request.
 *   applies      the role can be required to use it
 *   orgRequires  the organisation switched it on
 *   branchRequires  the person's own branch switched it on
 *   enrolled     the person has a verified authenticator app
 *   required     this session must be aal2
 *   aal          what the session is
 *   satisfied    !required || aal2
 */
async function mfaState(staff, user, token, db = pool) {
  const aal = tokenAal(token);
  const enrolled = hasVerifiedTotp(user);
  if (!staff || NEVER_ASKED.has(staff.role_name)) {
    return { applies: false, orgRequires: false, branchRequires: false, enrolled, required: false, aal, satisfied: true };
  }
  const applies = MFA_ROLES.has(staff.role_name);
  const sw = await switchesFor(staff.business_id, staff.branch_id, db);
  const required = applies && (sw.org || (sw.branch && BRANCH_ROLES.has(staff.role_name)));
  return { applies, orgRequires: sw.org, branchRequires: sw.branch, enrolled, required, aal, satisfied: !required || aal === 'aal2' };
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

module.exports = { MFA_ROLES, BRANCH_ROLES, switchesFor, tokenAal, hasVerifiedTotp, orgRequires2fa, forgetOrg, mfaState, openBeforeCode, refusal };

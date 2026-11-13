/**
 * auth.js — Auth sync routes
 *
 * Called by the frontend immediately after a successful Supabase Auth
 * signup or login to ensure the MySQL users table stays in sync.
 *
 * POST /api/auth/sync-user
 *   Body: { supabase_uid, email, full_name, phone? }
 *   Creates a MySQL user row if one does not already exist.
 *   Returns the MySQL user record.
 *
 * GET /api/auth/me
 *   Requires Bearer token.
 *   Returns the MySQL user or staff record for the authenticated caller.
 */

const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { NEVER_EXPOSE } = require('../utils/publicShapes');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { createRevocation } = require('../middleware/sessionLimiter');
const { isPlatformAdmin } = require('../middleware/tenantAccess');
const { auditLog } = require('../middleware/auditLog');
const { withTransaction } = require('../db/tx');
const { withPremiumState, trialEndsAt, TRIAL_DAYS, requirePayments } = require('../lib/premium');
const { profileSyncLimiter, authLimiter } = require('../middleware/rateLimiter');
const { z } = require('zod');
const portalHandoff = require('../lib/portalHandoff');
const { SECTOR_JOIN, SECTOR_COLUMNS, withTerms } = require('../utils/sectorTerms');

// Service-role client, used for exactly one thing: removing the auth identity
// when someone deletes their account. It is created only if the service key is
// configured, and every caller must tolerate it being null — a deployment
// without the key should degrade, not crash at boot.
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');
const supabaseAdmin = (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
  ? createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  : null;

async function getStaffProfile(staffId) {
  const [rows] = await pool.query(
    `SELECT
       s.*,
       r.name AS role_name,
       r.label AS role_label,
       b.name AS business_name,
       b.sector AS sector,
       ${SECTOR_COLUMNS},
       br.name AS branch_name,
       svc.name AS assigned_service_name,
       sa.id AS assignment_id,
       c.id AS counter_id,
       c.label AS counter_label,
       c.counter_number
     FROM staff s
     LEFT JOIN roles r ON r.id = s.role_id
     LEFT JOIN businesses b ON b.id = s.business_id
     ${SECTOR_JOIN}
     LEFT JOIN branches br ON br.id = s.branch_id
     LEFT JOIN services svc ON svc.id = s.assigned_service_id
     LEFT JOIN staff_assignments sa
       ON sa.staff_id = s.id
      AND sa.assignment_date = CURDATE()
     LEFT JOIN counters c ON c.id = sa.counter_id
     WHERE s.id = ?
     ORDER BY sa.shift_start DESC
     LIMIT 1`,
    [staffId]
  );

  if (!rows[0]) return null;

  /* s.* carries password_hash and supabase_uid, and both went out on every
     sign-in. publicShapes.js already names them in NEVER_EXPOSE; this route
     simply never asked. The whitelist itself is the wrong instrument here — a
     staff member's own profile legitimately carries far more than a colleague's
     listing does (sector vocabulary, today's counter, shift times), so
     projecting it through PUBLIC_STAFF_FIELDS would strip what the admin app
     paints its first screen from. Subtract the forbidden columns instead, from
     the same list, so a credential column added later is excluded here too. */
  const profile = { ...rows[0] };
  for (const field of NEVER_EXPOSE) delete profile[field];

  /* The supervisor's section (migration 043), named so the dashboard can say
     "Half Way Tree · Teller Services". Only looked up when there is one, so a
     database without 043 is never asked about tables it does not have. */
  if (profile.section_id) {
    const [[section]] = await pool.query('SELECT name FROM branch_sections WHERE id = ?', [profile.section_id]);
    profile.section_name = section?.name || null;
  }

  // Staff learn their organisation's vocabulary at sign-in, so every admin
  // screen can be worded correctly on first paint rather than saying "Customer"
  // and then correcting itself once a business lookup returns.
  return withTerms(profile);
}

// ── POST /api/auth/sync-user ──────────────────────────────────
// Called after every Supabase signup / first login.
// Idempotent: safe to call multiple times.
router.post('/sync-user', requireAuth, profileSyncLimiter, validate(schemas.syncUser), async (req, res) => {
  try {
    /* national_id and trn are deliberately not read. This is the path signup
       takes, and it was the one that put a Jamaican citizen's TRN on our server
       the moment an account was created — while the published privacy policy
       said it stayed on the device. Ignored rather than rejected, so an older
       build keeps working; it just stops leaving a copy behind. */
    const { full_name, phone, date_of_birth } = req.body;
    const supabaseUser = req.supabaseUser;

    /* A staff member is not a customer, and this route used to make them one.
     *
     * The mobile app calls sync-user for EVERY sign-in before it calls /auth/me
     * to find out who it is talking to. So a kiosk clerk — the one staff role
     * the phone serves — arrived here first, and if their staff row had no
     * supabase_uid yet, nothing identified them as staff: a users row was
     * minted, the uid bound to it, and from that moment the address resolved as
     * a customer. That is why signing in as the kiosk account landed on the
     * customer tabs instead of the kiosk console.
     *
     * It is also permanent without intervention, and it is not limited to
     * kiosks: any manager or line-staff member who tries the phone gets a
     * silent customer account for their work address.
     *
     * Two guards, and neither may throw — the client calls this unconditionally
     * and then asks /auth/me, so an error here breaks kiosk sign-in entirely.
     */
    if (req.dbStaff) {
      // Already known to be staff. Nothing to sync; /auth/me will route them.
      return res.json({ user: null, created: false, staff: true });
    }
    const [staffByEmail] = await pool.query(
      'SELECT id FROM staff WHERE email = ? AND is_active = TRUE LIMIT 1',
      [supabaseUser.email]
    );
    if (staffByEmail.length) {
      /* A staff row exists for this address but is not linked to this identity.
         Refusing beats creating a customer: the account keeps its staff meaning
         and somebody can link it, where a customer row would have to be found
         and unpicked first. */
      return res.status(409).json({
        error: 'This address belongs to a staff account that has not been linked yet. Ask an administrator to link it before signing in.',
        staff_unlinked: true,
      });
    }

    // Already synced?
    if (req.dbUser) {
      /* Supabase owns the sign-in email. A change confirmed there (Account >
         Email) reaches this row on the next sync, so the two never disagree. */
      if (supabaseUser.email && supabaseUser.email.toLowerCase() !== String(req.dbUser.email || '').toLowerCase()) {
        await pool.query('UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?', [supabaseUser.email.toLowerCase(), req.dbUser.id]);
      }
      // Update profile fields if provided
      if (full_name || phone) {
        await pool.query(
          `UPDATE users SET
             full_name    = COALESCE(?, full_name),
             phone        = COALESCE(?, phone),
             date_of_birth = COALESCE(?, date_of_birth),
             updated_at   = NOW()
           WHERE id = ?`,
          [full_name, phone, date_of_birth, req.dbUser.id]
        );
      }
      const [updated] = await pool.query('SELECT * FROM users WHERE id = ?', [req.dbUser.id]);
      return res.json({ user: withPremiumState(updated[0]), created: false });
    }

    // Check if this is a staff account (staff log in via Supabase Auth too)
    if (req.dbStaff) {
      return res.json({ staff: req.dbStaff, created: false });
    }

    // Create new MySQL user record
    const id = uuidv4();
    const email = supabaseUser.email;
    const name  = full_name || supabaseUser.user_metadata?.full_name || email.split('@')[0];

    await pool.query(
      `INSERT INTO users (id, supabase_uid, email, full_name, phone, date_of_birth)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, supabaseUser.id, email, name, phone || null, date_of_birth || null]
    );

    const [newUser] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    res.status(201).json({ user: withPremiumState(newUser[0]), created: true });
  } catch (err) {
    console.error('sync-user error:', err);
    res.status(500).json({ error: 'Failed to sync user.' });
  }
});


// ── POST /api/auth/portal-token ───────────────────────────────
// Mints the short-lived proof that somebody reached the website FROM the app.
// It is not a sign-in: the customer still logs in on the web. See
// lib/portalHandoff.js for why that separation is deliberate.
router.post('/portal-token', requireAuth, async (req, res) => {
  if (!req.dbUser) return res.status(404).json({ error: 'No user record found.' });

  const token = portalHandoff.issue(req.dbUser.id);
  if (!token) {
    // No secret configured. Say so plainly rather than handing back a token
    // signed with something guessable.
    return res.status(503).json({ error: 'The web portal is not available yet.' });
  }
  res.json({ token, expires_in_seconds: Math.floor(portalHandoff.TTL_MS / 1000) });
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.dbUser) return res.json({ type: 'user', record: withPremiumState(req.dbUser) });
    if (req.dbStaff) {
      const m = req.mfa || {};
      const mfa = { applies: !!m.applies, org_requires: !!m.orgRequires, branch_requires: !!m.branchRequires, enrolled: !!m.enrolled, required: !!m.required, aal: m.aal || 'aal1', satisfied: m.satisfied !== false };
      /* Waiting for the two-factor code: say who, and nothing else, until it is entered. */
      if (!mfa.satisfied) {
        return res.json({ type: 'staff', record: { id: req.dbStaff.id, full_name: req.dbStaff.full_name, role_name: req.dbStaff.role_name, business_id: req.dbStaff.business_id }, mfa });
      }
      const staffProfile = await getStaffProfile(req.dbStaff.id);
      return res.json({ type: 'staff', record: staffProfile || req.dbStaff, mfa });
    }
    res.status(404).json({ error: 'No MySQL record found for this account.' });
  } catch (err) {
    console.error('auth/me error:', err);
    res.status(500).json({ error: 'Failed to load account profile.' });
  }
});

// ── PATCH /api/auth/profile ──────────────────────────────────
// Called by the mobile ProfileScreen when the user saves their profile.
// Updates all standard intake fields in the MySQL users table.
router.patch('/profile', requireAuth, validate(schemas.updateProfile), async (req, res) => {
  if (!req.dbUser) {
    return res.status(404).json({ error: 'No user record found. Please sync first.' });
  }
  try {
    // Only columns that exist on the users table — the previous version
    // referenced address/employer/occupation and 500'd on every save.
    /* Same refusal as sync-user. The device keychain (documentVault.ts) is the
       only place identification lives; nothing in that module touches the
       network, so a breach of this database cannot expose one. */
    const { full_name, phone, date_of_birth } = req.body;

    await pool.query(
      `UPDATE users SET
         full_name     = COALESCE(?, full_name),
         phone         = COALESCE(?, phone),
         date_of_birth = COALESCE(?, date_of_birth),
         updated_at    = NOW()
       WHERE id = ?`,
      [
        full_name || null, phone || null, date_of_birth || null,
        req.dbUser.id,
      ]
    );

    const [updated] = await pool.query('SELECT * FROM users WHERE id = ?', [req.dbUser.id]);
    res.json({ user: withPremiumState(updated[0]) });
  } catch (err) {
    console.error('profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ── POST /api/auth/start-trial ───────────────────────────────
// Unlocks Lyne Premium (Smart Timing / visit planner) for this user.
// Billing comes later — for now a trial start simply flips the flag.
router.post('/start-trial', requirePayments, requireAuth, async (req, res) => {
  if (!req.dbUser) {
    return res.status(404).json({ error: 'No user record found. Please sync first.' });
  }
  try {
    const [rows] = await pool.query('SELECT trial_started_at FROM users WHERE id = ?', [req.dbUser.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'No user record found. Please sync first.' });
    }
    const usedMessage = `You have already used your free ${TRIAL_DAYS}-day trial. Subscribe to keep Lyne Premium.`;
    if (rows[0].trial_started_at) {
      return res.status(409).json({ error: usedMessage });
    }

    const endsAt = trialEndsAt();
    // Guarded on trial_started_at IS NULL, so two taps racing each other
    // cannot both start a trial and stack the window.
    const [result] = await pool.query(
      `UPDATE users
          SET is_premium = TRUE, trial_started_at = NOW(), premium_until = ?, updated_at = NOW()
        WHERE id = ? AND trial_started_at IS NULL`,
      [endsAt, req.dbUser.id]
    );
    if (!result.affectedRows) {
      return res.status(409).json({ error: usedMessage });
    }

    const [updated] = await pool.query('SELECT * FROM users WHERE id = ?', [req.dbUser.id]);
    res.json({ user: withPremiumState(updated[0]), trial_ends_at: endsAt });
  } catch (err) {
    console.error('start-trial error:', err);
    res.status(500).json({ error: 'Failed to start your trial.' });
  }
});

// ── POST /api/auth/logout ──────────────────────────────────────
// Revokes the current token and destroys the session record.
// Client should also call supabase.auth.signOut() to clear local storage.
// ── POST /api/auth/signout-everywhere ─────────────────────────
// A customer's "Sign out of all devices". /force-signout is the staff tool for
// someone else's account, and refused customers, so this button used to sign out
// only the phone it was pressed on. Supabase ends every session (refresh tokens),
// and every phone stops getting this account's notifications at once.
router.post('/signout-everywhere', requireAuth, async (req, res) => {
  if (!req.dbUser) return res.status(403).json({ error: 'Clients only.' });
  try {
    await pool.query('DELETE FROM device_push_tokens WHERE user_id = ?', [req.dbUser.id]);
    const jwt = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (supabaseAdmin && jwt) {
      const { error } = await supabaseAdmin.auth.admin.signOut(jwt, 'global');
      if (error) console.error('[SignOutEverywhere]', error.message);
    }
    res.json({ signed_out: true });
  } catch (err) {
    console.error('[SignOutEverywhere]', err.message);
    res.status(500).json({ error: 'Could not sign out everywhere. Try again.' });
  }
});

// ── GET /api/auth/export ──────────────────────────────────────
// "Download my data": everything Lyne's server holds about this person, as JSON
// (the usual machine-readable format for a data access request). Documents such
// as a TRN are not here because they never leave the phone.
router.get('/export', requireAuth, async (req, res) => {
  if (!req.dbUser) return res.status(403).json({ error: 'Clients only.' });
  const id = req.dbUser.id;
  const q = async (sql) => (await pool.query(sql, [id]))[0];
  try {
    const [[profile]] = await pool.query(
      `SELECT email, full_name, phone, date_of_birth, created_at, updated_at, sms_opt_in, sms_opt_in_at, phone_verified_at,
              is_premium, trial_started_at, premium_until
         FROM users WHERE id = ?`, [id]);
    const data = {
      exported_at: new Date().toISOString(),
      about: 'Everything Lyne holds about your account. Identification numbers you saved (TRN, National ID) are kept only on your phone, so they are not in this file.',
      profile,
      visits: await q(
        `SELECT t.ticket_number, t.status, t.channel, t.visit_reason, t.joined_at, t.called_at, t.completed_at, t.closed_reason,
                t.estimated_wait_minutes, t.appointment_at, t.notify_consent_at, b.name AS business, br.name AS branch, s.name AS service
           FROM queue_tickets t
           JOIN queues qu ON qu.id = t.queue_id
           LEFT JOIN services s ON s.id = qu.service_id
           LEFT JOIN branches br ON br.id = qu.branch_id
           LEFT JOIN businesses b ON b.id = br.business_id
          WHERE t.user_id = ? ORDER BY t.joined_at DESC`),
      ratings: await q('SELECT rating, wait_ok, comment, created_at FROM ticket_ratings WHERE user_id = ? ORDER BY created_at DESC'),
      session_registrations: await q(
        `SELECT reference, appointment_time, status, registered_at, checked_in_at, sms_consent_at
           FROM session_registrations WHERE user_id = ? ORDER BY registered_at DESC`),
      saved_businesses: await q(
        `SELECT b.name, sb.saved_at FROM saved_businesses sb JOIN businesses b ON b.id = sb.business_id WHERE sb.user_id = ?`),
      notifications: await q('SELECT notification_type, channel, message, is_read, sent_at FROM notifications WHERE user_id = ? ORDER BY sent_at DESC'),
      devices: await q('SELECT platform, device_name, last_seen_at, created_at FROM device_push_tokens WHERE user_id = ?'),
    };
    res.setHeader('Content-Disposition', 'attachment; filename="lyne-my-data.json"');
    res.json(data);
  } catch (err) {
    console.error('[Export]', err.message);
    res.status(500).json({ error: 'Could not gather your data. Try again.' });
  }
});

// ── Forgotten password ─────────────────────────────────────────────────────────
// POST /api/auth/password-reset/start   { email }                 email a 6-digit code
// POST /api/auth/password-reset/finish  { email, code, password } set the new password
//
// By code, not by link: the app uses PKCE and has no deep-link handler, and a code
// works whichever device opens the email. Supabase's Reset Password email must
// include {{ .Token }}. The code is checked here, not on the phone, because checking
// it on the phone would sign the person in before they had chosen a new password.
// Once set, every other session is signed out. Start always answers the same way,
// so nobody can use it to find out whether an email has an account.
const resetStart = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
const resetFinish = resetStart.extend({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from the email.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(72, 'Use 72 characters or fewer.'),
});
const publicKey = () => process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const publicClient = () => createSupabaseClient(process.env.SUPABASE_URL, publicKey(), {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

router.post('/password-reset/start', authLimiter, async (req, res) => {
  const parsed = resetStart.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (!process.env.SUPABASE_URL || !publicKey()) return res.status(503).json({ error: 'Password reset is unavailable right now. Try again later.' });
  const { error } = await publicClient().auth.resetPasswordForEmail(parsed.data.email);
  if (error) {
    console.error('[PasswordReset] start:', error.status, error.code || error.message);
    if (error.status === 429) return res.status(429).json({ error: 'Too many reset emails have been sent. Wait a few minutes and try again.' });
  }
  return res.json({ sent: true });
});

router.post('/password-reset/finish', authLimiter, async (req, res) => {
  const parsed = resetFinish.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your details.' });
  if (!supabaseAdmin || !publicKey()) return res.status(503).json({ error: 'Password reset is unavailable right now. Try again later.' });
  const { email, code, password } = parsed.data;
  try {
    const { data, error } = await publicClient().auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (error || !data?.user || !data?.session) {
      return res.status(400).json({ error: "That code didn't work. It may have expired: send a new one and use the latest email." });
    }
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, { password });
    if (updateError) {
      const weak = /password/i.test(updateError.message);
      return res.status(weak ? 400 : 502).json({ error: weak ? updateError.message : 'Could not save your new password. Try again.' });
    }
    // Anyone still signed in with the old password is signed out everywhere.
    const { error: outError } = await supabaseAdmin.auth.admin.signOut(data.session.access_token, 'global');
    if (outError) console.error('[PasswordReset] sign-out everywhere failed:', outError.message);
    return res.json({ reset: true });
  } catch (err) {
    console.error('[PasswordReset] finish:', err.message);
    return res.status(502).json({ error: 'Could not reset your password. Try again.' });
  }
});

router.post('/logout', requireAuth, async (req, res) => {
  try {
    const token = (req.headers.authorization || '').split(' ')[1];
    let jti = null;
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
      );
      jti = payload.jti || payload.session_id || null;
    } catch { /* non-fatal */ }

    const uid      = req.supabaseUser.id;
    // Expiry: use JWT exp if available, else 1h from now
    let expiresAt  = new Date(Date.now() + 60 * 60 * 1000);
    try {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
      );
      if (payload.exp) expiresAt = new Date(payload.exp * 1000);
    } catch { /* non-fatal */ }

    await createRevocation(uid, jti, 'logout', expiresAt);
    res.json({ message: 'Logged out successfully.' });
  } catch (err) {
    console.error('logout error:', err);
    res.status(500).json({ error: 'Failed to logout.' });
  }
});

// ── DELETE /api/auth/account ───────────────────────────────────
// Permanent account deletion, initiated by the account holder.
//
// Required by App Store guideline 5.1.1(v) and by the Jamaican Data Protection
// Act's erasure right, but the reason it is written this carefully is that the
// schema does NOT delete everything on its own.
//
// Seven tables cascade from `users` (device_push_tokens, notifications,
// payment_intents, payment_methods, saved_businesses, user_sessions,
// visit_history) — those look after themselves. Five others are ON DELETE SET
// NULL, which orphans the row but KEEPS the contents:
//
//   • (ocr_results, which held scanned ID numbers, no longer exists:
//      migration 050 dropped it and the route that wrote to it.)
//   • intake_forms       — free-form submitted data. Hard-deleted.
//   • queue_tickets      — guest_name / guest_phone and triage answers (health
//                          information) survive. Scrubbed, then the
//                          row is allowed to anonymise: the agency keeps its
//                          operational record of "a person was served at 10:04",
//                          with nothing left tying it to a human.
//   • ticket_ratings      — the free-text comment is removed; the score stays.
//   • session_registrations — guest contact details scrubbed.
//   • sms_log (no FK)      — the user_id link is removed; only a hash of the
//                          number remains, for the per-number throttle.
//   • audit_logs          — the person's ID, IP address and device are removed;
//                          what happened and when stays. The deletion itself is
//                          logged with no ID, so it is proof without a name.
// The Supabase sign-in record is deleted last, through the admin API, so the
// email address is free to sign up again.
//
// Telling someone their data is gone while their scanned passport number sits
// in a table with a null user_id would be a lie, and under the DPA an offence.
router.delete('/account', requireAuth, auditLog('delete_account', 'user', null, { anonymous: true }), async (req, res) => {
  if (!req.dbUser) {
    return res.status(403).json({
      error: 'Staff accounts are managed by their business and cannot be deleted from the app.',
    });
  }
  if (!supabaseAdmin) {
    console.error('[DeleteAccount] SUPABASE_SERVICE_KEY is not configured.');
    return res.status(503).json({ error: 'Account deletion is temporarily unavailable. Please try again later.' });
  }

  const userId = req.dbUser.id;
  const supabaseUid = req.supabaseUser.id;

  /* Everything after the DELETE is cleanup of things that live OUTSIDE the
     users row, and none of it can be undone by failing. Once this is true the
     personal data is gone, so no later error may abort the remaining steps and
     no later message may say nothing changed. That sentence is what made the
     original bug a lie rather than just a 500. */
  let dataDeleted = false;

  try {
    // Refuse while the customer is still standing in a line — deleting now
    // would strand a ticket that staff are actively serving.
    const [activeTickets] = await pool.query(
      `SELECT COUNT(*) AS active
         FROM queue_tickets
        WHERE user_id = ?
          AND status IN ('waiting', 'called', 'in_service')`,
      [userId]
    );
    if (activeTickets[0].active > 0) {
      return res.status(409).json({
        error: 'You are still in a queue. Leave your active queue first, then delete your account.',
      });
    }

    await withTransaction(async (conn) => {
      /* The tables that only SET NULL on a user's deletion, emptied of the
         person first (see the note above this route). These were here once and
         were lost in a later port, which left scanned ID numbers and intake
         answers behind, orphaned but intact, after "your data is gone". */
      await conn.query('DELETE FROM intake_forms WHERE user_id = ?', [userId]);
      await conn.query(
        "UPDATE queue_tickets SET guest_name = NULL, guest_phone = NULL, guest_access_token = NULL, triage_answers = NULL, visit_reason = NULL, guest_dob = NULL, readiness_note = NULL, triage_flag = 'none', notify_consent_at = NULL WHERE user_id = ?",
        [userId]
      );
      await conn.query(
        'UPDATE session_registrations SET guest_name = NULL, guest_phone = NULL, guest_email = NULL WHERE user_id = ?',
        [userId]
      );
      // A rating's free-text comment is the customer's own words; the score stays.
      await conn.query('UPDATE ticket_ratings SET comment = NULL WHERE user_id = ?', [userId]);
      /* Text-message columns and sms_log arrive with migration 048, which may
         not be applied on every database yet. Only "that table/column does not
         exist" is tolerated here; any other error still aborts the deletion. */
      for (const sql of [
        'UPDATE queue_tickets SET sms_stop_code = NULL WHERE user_id = ?',
        'UPDATE session_registrations SET sms_consent_at = NULL WHERE user_id = ?',
        // sms_log keeps only a hash of the number for throttling; drop the link to the person.
        'UPDATE sms_log SET user_id = NULL WHERE user_id = ?',
      ]) {
        try {
          await conn.query(sql, [userId]);
        } catch (e) {
          if (e.code !== 'ER_NO_SUCH_TABLE' && e.code !== 'ER_BAD_FIELD_ERROR') throw e;
        }
      }
      /* Earlier audit entries keep what happened and when, but not who: the
         person's ID, IP address and device go. The deletion's own entry is
         written without them (auditLog anonymous), so it proves a deletion
         happened without saying whose. */
      await conn.query(
        "UPDATE audit_logs SET actor_id = NULL, ip_address = NULL, user_agent = NULL WHERE actor_type = 'user' AND actor_id = ?",
        [userId]
      );
      await conn.query('UPDATE audit_logs SET resource_id = NULL WHERE resource_id = ?', [userId]);
      await conn.query('DELETE FROM users WHERE id = ?', [userId]);
    });
    dataDeleted = true;

    /* ── Past the point of no return ─────────────────────────────────────────
       Each remaining step is attempted independently and records its own
       failure. They used to be a chain, so the first one to throw skipped the
       rest — and the first one threw EVERY TIME, because 'account_deleted' was
       not in the reason ENUM (fixed by migration 035). The identity deletion
       below, which is the step that actually matters to the person asking to be
       deleted, was therefore never reached even once. */
    const unfinished = [];

    // Sign the account out everywhere before releasing the identity.
    try {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await createRevocation(supabaseUid, null, 'account_deleted', expiresAt, null);
    } catch (revokeError) {
      /* Deliberately not fatal. A revocation row is belt-and-braces: deleting
         the Supabase identity below invalidates the tokens anyway. Letting this
         stop the identity deletion trades a small safeguard for the whole
         point of the request. */
      console.error('[DeleteAccount] revocation failed:', revokeError.message);
      unfinished.push('existing sign-ins could not be revoked');
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(supabaseUid);
    if (authError) {
      console.error('[DeleteAccount] Supabase identity delete failed:', authError.message);
      unfinished.push('the sign-in record could not be removed');
    }

    if (unfinished.length) {
      /* 500, because something genuinely did not finish — but the message says
         what IS gone. Someone who reads "nothing was changed" and tries again
         gets 403 (their user row no longer exists), concludes the app is
         broken, and never learns their data was in fact deleted. */
      return res.status(500).json({
        error: `Your personal data was deleted, but ${unfinished.join(' and ')}. `
             + 'Please contact support so we can finish — do not try again, your data is already gone.',
        data_deleted: true,
      });
    }

    res.json({
      message: 'Your account and personal data have been deleted.',
      deleted: [
        'Profile and contact details',
        'Saved businesses and recent searches',
        'Notifications and device push tokens',
        'Saved payment methods',
        'Visit history',
        'Sign-in record',
      ],
      retained: [
        'Anonymous records of visits that already happened, which businesses keep for their own reporting. These are no longer linked to you.',
      ],
    });
  } catch (err) {
    console.error('delete-account error:', err);
    /* "Nothing was changed" is only true BEFORE the delete commits. Saying it
       afterwards is what turned a 500 into a false statement about somebody's
       personal data. */
    if (dataDeleted) {
      return res.status(500).json({
        error: 'Your personal data was deleted, but we could not finish releasing your sign-in. '
             + 'Please contact support — do not try again, your data is already gone.',
        data_deleted: true,
      });
    }
    res.status(500).json({ error: 'Failed to delete your account. Nothing was changed.' });
  }
});

router.post('/force-signout', requireAuth, validate(schemas.forceSignout), async (req, res) => {
  if (!req.dbStaff || !['manager', 'executive', 'platform_admin'].includes(req.dbStaff.role_name)) {
    return res.status(403).json({ error: 'Managers and executives only.' });
  }
  const { target_supabase_uid } = req.body;
  if (!target_supabase_uid) {
    return res.status(400).json({ error: 'target_supabase_uid is required.' });
  }
  try {
    if (!isPlatformAdmin(req)) {
      const [targetRows] = await pool.query(
        `SELECT business_id, branch_id FROM staff WHERE supabase_uid = ? LIMIT 1`,
        [target_supabase_uid]
      );
      if (!targetRows.length) return res.status(404).json({ error: 'Target staff account not found.' });
      if (targetRows[0].business_id !== req.dbStaff.business_id) {
        return res.status(403).json({ error: 'You cannot force sign-out accounts outside your business.' });
      }
      if (req.dbStaff.role_name === 'manager' && req.dbStaff.branch_id && targetRows[0].branch_id !== req.dbStaff.branch_id) {
        return res.status(403).json({ error: 'You cannot force sign-out staff outside your branch.' });
      }
    }
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createRevocation(target_supabase_uid, null, 'forced_signout', expiresAt, req.dbStaff.id);
    res.json({ message: 'All sessions for that account have been revoked.' });
  } catch (err) {
    console.error('force-signout error:', err);
    res.status(500).json({ error: 'Failed to force sign-out.' });
  }
});

module.exports = router;

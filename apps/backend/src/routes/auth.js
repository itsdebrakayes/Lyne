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
const { requireAuth } = require('../middleware/auth');
const { createRevocation } = require('../middleware/sessionLimiter');
const { isPlatformAdmin } = require('../middleware/tenantAccess');
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

  // Staff learn their organisation's vocabulary at sign-in, so every admin
  // screen can be worded correctly on first paint rather than saying "Customer"
  // and then correcting itself once a business lookup returns.
  return rows[0] ? withTerms(rows[0]) : null;
}

// ── POST /api/auth/sync-user ──────────────────────────────────
// Called after every Supabase signup / first login.
// Idempotent: safe to call multiple times.
router.post('/sync-user', requireAuth, async (req, res) => {
  try {
    const { full_name, phone, national_id, trn, date_of_birth } = req.body;
    const supabaseUser = req.supabaseUser;

    // Already synced?
    if (req.dbUser) {
      // Update profile fields if provided
      if (full_name || phone) {
        await pool.query(
          `UPDATE users SET
             full_name    = COALESCE(?, full_name),
             phone        = COALESCE(?, phone),
             national_id  = COALESCE(?, national_id),
             trn          = COALESCE(?, trn),
             date_of_birth = COALESCE(?, date_of_birth),
             updated_at   = NOW()
           WHERE id = ?`,
          [full_name, phone, national_id, trn, date_of_birth, req.dbUser.id]
        );
      }
      const [updated] = await pool.query('SELECT * FROM users WHERE id = ?', [req.dbUser.id]);
      return res.json({ user: updated[0], created: false });
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
      `INSERT INTO users (id, supabase_uid, email, full_name, phone, national_id, trn, date_of_birth)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, supabaseUser.id, email, name, phone || null, national_id || null, trn || null, date_of_birth || null]
    );

    const [newUser] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    res.status(201).json({ user: newUser[0], created: true });
  } catch (err) {
    console.error('sync-user error:', err);
    res.status(500).json({ error: 'Failed to sync user.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.dbUser) return res.json({ type: 'user', record: req.dbUser });
    if (req.dbStaff) {
      const staffProfile = await getStaffProfile(req.dbStaff.id);
      return res.json({ type: 'staff', record: staffProfile || req.dbStaff });
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
router.patch('/profile', requireAuth, async (req, res) => {
  if (!req.dbUser) {
    return res.status(404).json({ error: 'No user record found. Please sync first.' });
  }
  try {
    // Only columns that exist on the users table — the previous version
    // referenced address/employer/occupation and 500'd on every save.
    const { full_name, phone, date_of_birth, national_id, trn } = req.body;

    await pool.query(
      `UPDATE users SET
         full_name     = COALESCE(?, full_name),
         phone         = COALESCE(?, phone),
         date_of_birth = COALESCE(?, date_of_birth),
         national_id   = COALESCE(?, national_id),
         trn           = COALESCE(?, trn),
         updated_at    = NOW()
       WHERE id = ?`,
      [
        full_name || null, phone || null, date_of_birth || null,
        national_id || null, trn || null,
        req.dbUser.id,
      ]
    );

    const [updated] = await pool.query('SELECT * FROM users WHERE id = ?', [req.dbUser.id]);
    res.json({ user: updated[0] });
  } catch (err) {
    console.error('profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// ── POST /api/auth/start-trial ───────────────────────────────
// Unlocks Lyne Premium (Smart Timing / visit planner) for this user.
// Billing comes later — for now a trial start simply flips the flag.
router.post('/start-trial', requireAuth, async (req, res) => {
  if (!req.dbUser) {
    return res.status(404).json({ error: 'No user record found. Please sync first.' });
  }
  try {
    await pool.query('UPDATE users SET is_premium = TRUE, updated_at = NOW() WHERE id = ?', [req.dbUser.id]);
    const [updated] = await pool.query('SELECT * FROM users WHERE id = ?', [req.dbUser.id]);
    res.json({ user: updated[0] });
  } catch (err) {
    console.error('start-trial error:', err);
    res.status(500).json({ error: 'Failed to start your trial.' });
  }
});

// ── POST /api/auth/logout ──────────────────────────────────────
// Revokes the current token and destroys the session record.
// Client should also call supabase.auth.signOut() to clear local storage.
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
//   • ocr_results        — extracted_national_id, extracted_trn,
//                          extracted_passport, extracted_dob, raw_text.
//                          The most sensitive data in the system. Hard-deleted.
//   • intake_forms       — free-form submitted data. Hard-deleted.
//   • queue_tickets      — guest_name / guest_phone survive. Scrubbed, then the
//                          row is allowed to anonymise: the agency keeps its
//                          operational record of "a person was served at 10:04",
//                          with nothing left tying it to a human.
//   • ticket_ratings,
//     session_registrations — anonymise cleanly; no personal columns.
//
// Telling someone their data is gone while their scanned passport number sits
// in a table with a null user_id would be a lie, and under the DPA an offence.
router.delete('/account', requireAuth, async (req, res) => {
  // Staff accounts are provisioned by their agency and are not the account
  // holder's to delete — a customer must never be able to remove a staff row.
  if (req.dbStaff) {
    return res.status(403).json({ error: 'Staff accounts are managed by your organisation and cannot be deleted here.' });
  }
  if (!req.dbUser) {
    return res.status(403).json({ error: 'User account required.' });
  }

  const userId = req.dbUser.id;
  const uid = req.supabaseUser?.id;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // Order matters: scrub the SET NULL tables BEFORE the users row goes, while
    // user_id still identifies which rows are ours.
    const [ocr] = await conn.query('DELETE FROM ocr_results WHERE user_id = ?', [userId]);
    const [intake] = await conn.query('DELETE FROM intake_forms WHERE user_id = ?', [userId]);
    await conn.query(
      'UPDATE queue_tickets SET guest_name = NULL, guest_phone = NULL WHERE user_id = ?',
      [userId]
    );

    // Cascades take the remaining seven tables with it.
    await conn.query('DELETE FROM users WHERE id = ?', [userId]);

    await conn.commit();
    console.log(`[Account] Deleted user ${userId} — ${ocr.affectedRows} document scans, ${intake.affectedRows} intake forms removed.`);
  } catch (err) {
    await conn.rollback();
    console.error('account deletion error:', err);
    return res.status(500).json({ error: 'Could not delete your account. Nothing was removed — please try again.' });
  } finally {
    conn.release();
  }

  // The auth identity goes last and OUTSIDE the transaction: if this fails the
  // application data is already gone, and leaving a login that resolves to
  // nothing is a far better failure than rolling the data back and telling the
  // person their deletion did not happen when most of it did.
  let authRemoved = true;
  try {
    if (uid && supabaseAdmin) {
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
      if (delErr) throw delErr;
    } else {
      authRemoved = false;
    }
  } catch (err) {
    authRemoved = false;
    console.error(`[Account] Data for ${userId} deleted but Supabase user ${uid} remains:`, err.message);
  }

  // Kill the session either way, so the app cannot keep acting as a user who no
  // longer exists.
  try {
    await createRevocation(uid, null, 'account_deleted', new Date(Date.now() + 24 * 60 * 60 * 1000));
  } catch { /* non-fatal */ }

  res.json({
    message: 'Your account and personal data have been deleted.',
    auth_identity_removed: authRemoved,
  });
});

// ── POST /api/auth/force-signout ───────────────────────────────
// Manager/executive can force-sign-out a specific user or staff member.
// Revokes ALL active tokens for that supabase_uid.
router.post('/force-signout', requireAuth, async (req, res) => {
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

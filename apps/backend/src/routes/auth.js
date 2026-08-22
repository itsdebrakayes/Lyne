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
const { auditLog } = require('../middleware/auditLog');
const { withTransaction } = require('../db/tx');
const { createClient } = require('@supabase/supabase-js');

// Deleting a Supabase Auth identity is an administrative action, so unlike the
// request-path verification in middleware/auth.js it needs the service-role
// key. It is used for nothing else.
const supabaseAdmin = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
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
       br.name AS branch_name,
       svc.name AS assigned_service_name,
       sa.id AS assignment_id,
       c.id AS counter_id,
       c.label AS counter_label,
       c.counter_number
     FROM staff s
     LEFT JOIN roles r ON r.id = s.role_id
     LEFT JOIN businesses b ON b.id = s.business_id
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

  return rows[0] || null;
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
// Unlocks QMe Premium (Smart Timing / visit planner) for this user.
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

// ── DELETE /api/auth/account ──────────────────────────────────
// App Store Guideline 5.1.1(v): an app with account creation must let the user
// initiate deletion of the account and its data from inside the app. Not
// deactivation, and not "email support".
//
// What happens:
//   • The MySQL `users` row is deleted. Everything personal cascades with it —
//     saved businesses, notifications, device push tokens, saved payment
//     methods, visit history.
//   • Queue tickets and intake forms are NOT deleted. The FKs are ON DELETE SET
//     NULL, so the business keeps the operational record of a visit that
//     actually happened while it stops being linked to a person.
//   • Every session for the account is revoked, so other devices are signed out.
//   • The Supabase Auth identity is deleted last, which frees the email address
//     for re-registration.
//
// The Supabase step needs the service-role key. If it is not configured we fail
// the whole request rather than half-deleting an account and reporting success.
router.delete('/account', requireAuth, auditLog('delete_account', 'user'), async (req, res) => {
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
      await conn.query('DELETE FROM users WHERE id = ?', [userId]);
    });

    // Sign the account out everywhere before releasing the identity.
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await createRevocation(supabaseUid, null, 'account_deleted', expiresAt, null);

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(supabaseUid);
    if (authError) {
      // The personal data is already gone; surface the failure so the identity
      // can be cleaned up rather than silently reporting complete success.
      console.error('[DeleteAccount] Supabase identity delete failed:', authError.message);
      return res.status(500).json({
        error: 'Your personal data was deleted, but the sign-in record could not be removed. Please contact support so we can finish.',
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
    res.status(500).json({ error: 'Failed to delete your account. Nothing was changed.' });
  }
});

module.exports = router;

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
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { createRevocation } = require('../middleware/sessionLimiter');
const { isPlatformAdmin } = require('../middleware/tenantAccess');

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
  if (req.dbUser)  return res.json({ type: 'user',  record: req.dbUser });
  if (req.dbStaff) return res.json({ type: 'staff', record: req.dbStaff });
  res.status(404).json({ error: 'No MySQL record found for this account.' });
});

// ── PATCH /api/auth/profile ──────────────────────────────────
// Called by the mobile ProfileScreen when the user saves their profile.
// Updates all standard intake fields in the MySQL users table.
router.patch('/profile', requireAuth, async (req, res) => {
  if (!req.dbUser) {
    return res.status(404).json({ error: 'No user record found. Please sync first.' });
  }
  try {
    const {
      full_name, phone, date_of_birth, address,
      national_id, trn, employer, occupation,
    } = req.body;

    await pool.query(
      `UPDATE users SET
         full_name     = COALESCE(?, full_name),
         phone         = COALESCE(?, phone),
         date_of_birth = COALESCE(?, date_of_birth),
         address       = COALESCE(?, address),
         national_id   = COALESCE(?, national_id),
         trn           = COALESCE(?, trn),
         employer      = COALESCE(?, employer),
         occupation    = COALESCE(?, occupation),
         updated_at    = NOW()
       WHERE id = ?`,
      [
        full_name || null, phone || null, date_of_birth || null, address || null,
        national_id || null, trn || null, employer || null, occupation || null,
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
      jti = payload.jti || null;
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
  if (!req.dbStaff || !['manager', 'executive'].includes(req.dbStaff.role_name)) {
    return res.status(403).json({ error: 'Managers and executives only.' });
  }
  const { target_supabase_uid } = req.body;
  if (!target_supabase_uid) {
    return res.status(400).json({ error: 'target_supabase_uid is required.' });
  }
  try {
    if (!isPlatformAdmin(req)) {
      const [targetRows] = await pool.query(
        `SELECT business_id FROM staff WHERE supabase_uid = ?
         UNION
         SELECT NULL AS business_id FROM users WHERE supabase_uid = ?
         LIMIT 1`,
        [target_supabase_uid, target_supabase_uid]
      );
      if (!targetRows.length) return res.status(404).json({ error: 'Target account not found.' });
      if (targetRows[0].business_id && targetRows[0].business_id !== req.dbStaff.business_id) {
        return res.status(403).json({ error: 'You cannot force sign-out accounts outside your business.' });
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

/**
 * staff-invite.js — Staff invite-code flow for Q ME NOW
 *
 * Staff accounts are NEVER self-registered. They must be created by a manager
 * or executive, who generates an invite code. The invited staff member uses
 * the invite code to complete their account setup.
 *
 * POST /api/staff-invite/create       — Manager/exec creates an invite (generates code)
 * POST /api/staff-invite/redeem       — Invited staff redeems the code to activate account
 * GET  /api/staff-invite/pending      — List pending invites for a business (manager/exec)
 * DELETE /api/staff-invite/:id        — Revoke a pending invite (manager/exec)
 */
const router  = require('express').Router();
const { z }   = require('zod');
const { randomUUID: uuidv4 } = require('crypto');
const crypto  = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const pool    = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const { assertBusinessAccess, assertBranchAccess, isPlatformAdmin } = require('../middleware/tenantAccess');

function validationMessage(error) {
  return error.issues?.[0]?.message || 'Invalid request data.';
}

const idSchema = z.string().min(1).max(64);

// Admin Supabase client for creating staff auth accounts
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL        || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || 'placeholder-key'
);

// ── Validation schemas ────────────────────────────────────────
const createInviteSchema = z.object({
  email:       z.string().email('A valid email is required'),
  full_name:   z.string().min(1).max(255),
  role:        z.enum(['line_staff', 'manager'], {
    errorMap: () => ({ message: 'role must be line_staff or manager' }),
  }),
  business_id: idSchema,
  branch_id:   idSchema.optional(),
  expires_hours: z.number().int().min(1).max(168).optional().default(48),
});

const redeemInviteSchema = z.object({
  invite_code: z.string().min(8).max(64),
  full_name:   z.string().min(1).max(255).optional(),
  phone:       z.string().max(50).optional(),
  password:    z.string().min(8).max(128, 'Password must be between 8 and 128 characters'),
});

// ── POST /api/staff-invite/create ─────────────────────────────
router.post('/create',
  requireAuth,
  requireRole('manager', 'executive'),
  auditLog('create_staff_invite', 'staff_invite'),
  async (req, res) => {
    const parsed = createInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: validationMessage(parsed.error) });
    }

    const { email, full_name, role, business_id, branch_id, expires_hours } = parsed.data;

    try {
      const [staffRows] = await pool.query(
        `SELECT s.id, s.business_id, s.branch_id, r.name AS role_name
         FROM staff s
         JOIN roles r ON r.id = s.role_id
         WHERE s.id = ? AND s.business_id = ? AND s.is_active = TRUE`,
        [req.dbStaff?.id, business_id]
      );
      if (!staffRows.length || !assertBusinessAccess(req, business_id)) {
        return res.status(403).json({ error: 'You do not have permission to invite staff for this business.' });
      }

      // Managers can only invite line_staff; executives can invite managers and line_staff
      const inviterRole = staffRows[0].role_name;
      if (inviterRole === 'manager' && role !== 'line_staff') {
        return res.status(403).json({ error: 'Managers can only invite line staff.' });
      }

      if (branch_id) {
        const [branchRows] = await pool.query(
          'SELECT id, business_id FROM branches WHERE id = ? LIMIT 1',
          [branch_id]
        );
        if (!branchRows.length || branchRows[0].business_id !== business_id) {
          return res.status(400).json({ error: 'Branch does not belong to this business.' });
        }
        if (!assertBranchAccess(req, branch_id)) {
          return res.status(403).json({ error: 'You do not have permission to invite staff for this branch.' });
        }
      }

      // Check for existing pending invite for this email+business
      const [existing] = await pool.query(
        "SELECT id FROM staff_invites WHERE email = ? AND business_id = ? AND status IN ('requested','pending') AND expires_at > NOW()",
        [email, business_id]
      );
      if (existing.length) {
        return res.status(409).json({ error: 'A pending invite already exists for this email.' });
      }

      // Generate a secure, URL-safe invite code
      const inviteCode = crypto.randomBytes(24).toString('base64url');
      const expiresAt  = new Date(Date.now() + expires_hours * 60 * 60 * 1000);
      const inviteId   = uuidv4();

      await pool.query(
        `INSERT INTO staff_invites
           (id, business_id, branch_id, email, full_name, role, invite_code,
            invited_by_staff_id, expires_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [inviteId, business_id, branch_id || null, email, full_name, role,
         inviteCode, req.dbStaff?.id, expiresAt,
         // A platform admin acting directly is the approval; anyone else is asking.
         isPlatformAdmin(req) ? 'pending' : 'requested']
      );

      const approved = isPlatformAdmin(req);
      res.status(201).json({
        invite_id:    inviteId,
        status:       approved ? 'pending' : 'requested',
        // The code is withheld until DKS approves, so nobody is handed a code
        // that will be refused at redemption.
        invite_code:  approved ? inviteCode : null,
        message:      approved
          ? 'Invite created. Share the code with your new staff member.'
          : 'Request sent to DKS Technologies. You will see the invite code here once it is approved.',
        email,
        full_name,
        role,
        expires_at:   expiresAt.toISOString(),
        // In production, this code would be emailed to the invitee.
        // The invite_code is returned here for the admin to share manually
        // or for the email service to pick up.
        message: `Invite created. Share the invite code with ${full_name} (${email}).`,
      });
    } catch (err) {
      console.error('[StaffInvite] Create error:', err.message);
      res.status(500).json({ error: 'Failed to create staff invite.' });
    }
  }
);

// ── POST /api/staff-invite/redeem ─────────────────────────────
router.post('/redeem', async (req, res) => {
  const parsed = redeemInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: validationMessage(parsed.error) });
  }

  const { invite_code, full_name, phone, password } = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [invites] = await conn.query(
      `SELECT * FROM staff_invites
       WHERE invite_code = ? AND status = 'pending' AND expires_at > NOW()
       FOR UPDATE`,
      [invite_code]
    );
    if (!invites.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'Invalid or expired invite code.' });
    }

    const invite = invites[0];

    // Check if a staff account already exists for this email
    const [existing] = await conn.query(
      'SELECT id FROM staff WHERE email = ? AND business_id = ?',
      [invite.email, invite.business_id]
    );
    if (existing.length) {
      await conn.rollback();
      return res.status(409).json({ error: 'A staff account already exists for this email.' });
    }

    // Create Supabase Auth account — staff log in via Supabase just like customers
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email:          invite.email,
      password,
      email_confirm:  true,
      user_metadata:  {
        full_name: full_name || invite.full_name,
        role:      invite.role,
        is_staff:  true,
      },
    });

    if (authError) {
      await conn.rollback();
      // If account already exists in Supabase, surface a clear message
      if (authError.message?.includes('already registered')) {
        return res.status(409).json({ error: 'A Supabase account already exists for this email.' });
      }
      console.error('[StaffInvite] Supabase createUser error:', authError.message);
      return res.status(500).json({ error: 'Failed to create authentication account.' });
    }

    const supabaseUid = authData.user.id;

    // Get the role_id for the invited role
    const [roleRows] = await conn.query(
      'SELECT id FROM roles WHERE name = ?',
      [invite.role]
    );
    const roleId = roleRows[0]?.id || null;

    // Create the MySQL staff record, linked to the Supabase account
    const staffId   = uuidv4();
    const staffCode = `STF-${Date.now().toString(36).toUpperCase()}`;

    await conn.query(
      `INSERT INTO staff
         (id, business_id, branch_id, role_id, full_name, email, phone,
          staff_code, supabase_uid, is_active, invited_by_staff_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)`,
      [
        staffId,
        invite.business_id,
        invite.branch_id || null,
        roleId,
        full_name || invite.full_name,
        invite.email,
        phone || null,
        staffCode,
        supabaseUid,
        invite.invited_by_staff_id,
      ]
    );

    // Mark invite as redeemed
    await conn.query(
      "UPDATE staff_invites SET status = 'redeemed', redeemed_at = NOW(), redeemed_by_staff_id = ? WHERE id = ?",
      [staffId, invite.id]
    );

    await conn.commit();

    res.status(201).json({
      success:      true,
      staff_id:     staffId,
      staff_code:   staffCode,
      email:        invite.email,
      role:         invite.role,
      supabase_uid: supabaseUid,
      message:      'Staff account created. You can now log in with your email and password.',
    });
  } catch (err) {
    await conn.rollback();
    console.error('[StaffInvite] Redeem error:', err.message);
    res.status(500).json({ error: 'Failed to redeem invite.' });
  } finally {
    conn.release();
  }
});

// ── GET /api/staff-invite/pending ─────────────────────────────
router.get('/pending',
  requireAuth,
  requireRole('manager', 'executive'),
  async (req, res) => {
    const { business_id } = req.query;
    if (!business_id) {
      return res.status(400).json({ error: 'business_id query parameter is required.' });
    }
    if (!assertBusinessAccess(req, business_id)) {
      return res.status(403).json({ error: 'You do not have access to this business.' });
    }

    try {
      const [rows] = await pool.query(
        `SELECT si.id, si.email, si.full_name, si.role, si.expires_at,
                si.created_at, s.full_name AS invited_by_name
         FROM staff_invites si
         LEFT JOIN staff s ON si.invited_by_staff_id = s.id
         WHERE si.business_id = ? AND si.status IN ('requested','pending','declined') AND si.expires_at > NOW()
         ORDER BY si.created_at DESC`,
        [business_id]
      );
      res.json(rows);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch pending invites.' });
    }
  }
);

// ── DELETE /api/staff-invite/:id ──────────────────────────────
router.delete('/:id',
  requireAuth,
  requireRole('manager', 'executive'),
  auditLog('revoke_staff_invite', 'staff_invite'),
  async (req, res) => {
    try {
      const [rows] = await pool.query(
        "SELECT id, business_id FROM staff_invites WHERE id = ? AND status IN ('requested','pending')",
        [req.params.id]
      );
      if (!rows.length) {
        return res.status(404).json({ error: 'Pending invite not found.' });
      }
      if (!assertBusinessAccess(req, rows[0].business_id)) {
        return res.status(403).json({ error: 'You do not have access to this invite.' });
      }

      await pool.query(
        "UPDATE staff_invites SET status = 'revoked', revoked_at = NOW() WHERE id = ? AND business_id = ?",
        [req.params.id, rows[0].business_id]
      );

      res.json({ success: true, message: 'Invite revoked.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to revoke invite.' });
    }
  }
);

// ── POST /api/staff-invite/:id/approve ────────────────────────
// DKS Technologies only. Turns a manager's request into a live invite code.
// A manager cannot approve their own request — that is the entire point of the
// gate, and requireStaffRole would let an executive through, so this checks
// platform admin explicitly.
router.post('/:id/approve', requireAuth, auditLog('staff_invite_approve', 'staff_invite'), async (req, res) => {
  if (!isPlatformAdmin(req)) {
    return res.status(403).json({ error: 'Only DKS Technologies can approve staff requests.' });
  }
  try {
    const [rows] = await pool.query(
      "SELECT id, invite_code, email, full_name, role FROM staff_invites WHERE id = ? AND status = 'requested' LIMIT 1",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'No pending request with that id.' });

    await pool.query(
      "UPDATE staff_invites SET status = 'pending', approved_at = NOW(), approved_by = ? WHERE id = ?",
      [req.dbStaff?.email || 'platform_admin', req.params.id]
    );
    res.json({
      invite_id:   rows[0].id,
      invite_code: rows[0].invite_code,
      email:       rows[0].email,
      full_name:   rows[0].full_name,
      role:        rows[0].role,
      message:     'Approved. The manager can now share this code with their staff member.',
    });
  } catch (err) {
    console.error('approve staff request error:', err);
    res.status(500).json({ error: 'Failed to approve the request.' });
  }
});

// ── POST /api/staff-invite/:id/decline ────────────────────────
router.post('/:id/decline', requireAuth, auditLog('staff_invite_decline', 'staff_invite'), async (req, res) => {
  if (!isPlatformAdmin(req)) {
    return res.status(403).json({ error: 'Only DKS Technologies can decline staff requests.' });
  }
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.slice(0, 500) : null;
  try {
    const [result] = await pool.query(
      "UPDATE staff_invites SET status = 'declined', decline_reason = ? WHERE id = ? AND status = 'requested'",
      [reason, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'No pending request with that id.' });
    res.json({ message: 'Request declined.', reason });
  } catch (err) {
    console.error('decline staff request error:', err);
    res.status(500).json({ error: 'Failed to decline the request.' });
  }
});

module.exports = router;

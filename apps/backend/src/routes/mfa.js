/**
 * mfa.js — two-factor sign-in settings (migration 053). Mounted at /api/auth/mfa.
 *
 * Enrolling and entering a code happen between the admin app and Supabase
 * Auth directly; the policy is lib/mfa.js and is enforced in requireAuth. These
 * routes are what an organisation controls:
 *
 *   GET  /status          this session: required? enrolled? code entered?
 *   GET  /organisation    executive: the switch, and who has set it up
 *   PUT  /organisation    executive: { require_2fa }. Switched on, everyone it
 *                         covers (the executive included) is asked to set it
 *                         up at their next request; the app takes them to the
 *                         set-up screen on the sign-in card
 *   GET  /branch          manager (own branch) or executive (any branch of
 *                         their organisation): the branch switch and its people
 *   PUT  /branch          { branch_id?, require_2fa } — same people. Covers the
 *                         branch's supervisors and managers, nobody else
 *   POST /reset           executive: { staff_id } — remove a lost phone's
 *                         factor; that person sets up again at next sign-in
 *
 * Every change is written to the activity log.
 */
const router = require('express').Router();
const { randomUUID } = require('crypto');
const { z } = require('zod');
const { createClient } = require('@supabase/supabase-js');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { requireStaffRole, isPlatformAdmin } = require('../middleware/tenantAccess');
const { MFA_ROLES, BRANCH_ROLES, forgetOrg, hasVerifiedTotp } = require('../lib/mfa');

const serviceKey = () => process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
let adminClient = null;
function admin() {
  if (!adminClient && process.env.SUPABASE_URL && serviceKey()) {
    adminClient = createClient(process.env.SUPABASE_URL, serviceKey(), { auth: { autoRefreshToken: false, persistSession: false } });
  }
  return adminClient;
}

const audit = (req, businessId, action, resourceType, resourceId) => pool.query(
  `INSERT INTO audit_logs (id, actor_id, actor_type, business_id, action, resource_type, resource_id, ip_address, user_agent)
   VALUES (?, ?, 'staff', ?, ?, ?, ?, ?, ?)`,
  [randomUUID(), req.dbStaff.id, businessId, action, resourceType, resourceId, req.ip || null, req.headers['user-agent'] || null]
);

/** The organisation an executive acts on: their own; a platform admin names one. */
function targetBusiness(req, requested) {
  if (isPlatformAdmin(req) && requested) return String(requested);
  return req.dbStaff.business_id;
}

router.get('/status', requireAuth, (req, res) => {
  if (!req.dbStaff) return res.json({ applies: false, required: false, enrolled: hasVerifiedTotp(req.supabaseUser), aal: null, satisfied: true });
  const m = req.mfa;
  return res.json({ applies: m.applies, org_requires: m.orgRequires, branch_requires: m.branchRequires, enrolled: m.enrolled, required: m.required, aal: m.aal, satisfied: m.satisfied });
});

/* Who has set up two-factor. Read from Supabase one person at a time (five at
   once), so it is capped: an organisation larger than this sees the first ones
   and a note. */
const LIST_CAP = 300;
async function enrolledByUid(uids) {
  const client = admin();
  const out = new Map();
  if (!client) return out;
  let i = 0;
  async function worker() {
    while (i < uids.length) {
      const uid = uids[i++];
      try {
        const { data, error } = await client.auth.admin.getUserById(uid);
        out.set(uid, error ? null : hasVerifiedTotp(data?.user));
      } catch { out.set(uid, null); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(5, uids.length) }, worker));
  return out;
}

router.get('/organisation', requireAuth, requireStaffRole('executive'), async (req, res) => {
  const businessId = targetBusiness(req, req.query.business_id);
  try {
    let requires = false;
    try {
      const [b] = await pool.query('SELECT require_2fa FROM businesses WHERE id = ? LIMIT 1', [businessId]);
      if (!b.length) return res.status(404).json({ error: 'Organisation not found.' });
      requires = !!Number(b[0].require_2fa);
    } catch (err) {
      if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
      return res.status(503).json({ error: 'Two-factor settings are not available yet.' });
    }
    const [branches] = await pool.query(
      'SELECT id, name, require_2fa FROM branches WHERE business_id = ? AND is_active = TRUE ORDER BY name', [businessId]
    );
    const branchOn = new Map(branches.map((b) => [b.id, !!Number(b.require_2fa)]));
    const [staff] = await pool.query(
      `SELECT s.id, s.full_name, s.supabase_uid, s.branch_id, r.name AS role_name, br.name AS branch_name
         FROM staff s JOIN roles r ON r.id = s.role_id LEFT JOIN branches br ON br.id = s.branch_id AND br.business_id = s.business_id
        WHERE s.business_id = ? AND s.is_active = TRUE AND r.name IN ('line_staff', 'supervisor', 'manager', 'executive')
        ORDER BY FIELD(r.name, 'executive', 'manager', 'supervisor', 'line_staff'), s.full_name
        LIMIT ${LIST_CAP + 1}`,
      [businessId]
    );
    const shown = staff.slice(0, LIST_CAP);
    const enrolled = await enrolledByUid(shown.map((s) => s.supabase_uid).filter(Boolean));
    return res.json({
      require_2fa: requires,
      checked: !!admin(),
      truncated: staff.length > LIST_CAP,
      branches: branches.map((b) => ({ id: b.id, name: b.name, require_2fa: !!Number(b.require_2fa) })),
      staff: shown.map((s) => ({
        id: s.id,
        full_name: s.full_name,
        role: s.role_name,
        branch_name: s.branch_name || null,
        /* Covered now: by the organisation's switch, or by their own branch's. */
        must_use: MFA_ROLES.has(s.role_name) && (requires || (BRANCH_ROLES.has(s.role_name) && !!branchOn.get(s.branch_id))),
        could_use: MFA_ROLES.has(s.role_name),
        has_login: !!s.supabase_uid,
        enrolled: s.supabase_uid ? (enrolled.has(s.supabase_uid) ? enrolled.get(s.supabase_uid) : null) : false,
        is_you: s.id === req.dbStaff.id,
      })),
    });
  } catch (err) {
    console.error('[MFA] organisation:', err.message);
    return res.status(500).json({ error: 'Could not load two-factor settings.' });
  }
});

const switchSchema = z.object({ require_2fa: z.boolean(), business_id: z.string().max(36).optional() }).strict();

router.put('/organisation', requireAuth, requireStaffRole('executive'), async (req, res) => {
  const parsed = switchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Send require_2fa as true or false.' });
  const businessId = targetBusiness(req, parsed.data.business_id);
  try {
    const [r] = await pool.query('UPDATE businesses SET require_2fa = ? WHERE id = ?', [parsed.data.require_2fa, businessId]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Organisation not found.' });
    forgetOrg(businessId);
    await audit(req, businessId, parsed.data.require_2fa ? 'two_factor_required' : 'two_factor_not_required', 'organisation', businessId);
    return res.json({ require_2fa: parsed.data.require_2fa });
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') return res.status(503).json({ error: 'Two-factor settings are not available yet.' });
    console.error('[MFA] switch:', err.message);
    return res.status(500).json({ error: 'Could not change the setting.' });
  }
});

/* The branch a request may act on: a manager's own, or an executive's (or
   platform admin's) choice within their organisation. Anything else: null. */
async function allowedBranch(req, requested) {
  const role = req.dbStaff.role_name;
  const branchId = String(requested || req.dbStaff.branch_id || '');
  if (!branchId) return null;
  if (role === 'manager' && branchId !== req.dbStaff.branch_id) return null;
  const [rows] = await pool.query('SELECT id, business_id, name, require_2fa FROM branches WHERE id = ? AND is_active = TRUE LIMIT 1', [branchId]);
  const b = rows[0];
  if (!b) return null;
  if (!isPlatformAdmin(req) && b.business_id !== req.dbStaff.business_id) return null;
  return b;
}

router.get('/branch', requireAuth, requireStaffRole('manager', 'executive'), async (req, res) => {
  try {
    const b = await allowedBranch(req, req.query.branch_id);
    if (!b) return res.status(403).json({ error: 'You can only see two-factor for your own branch.' });
    const [org] = await pool.query('SELECT require_2fa FROM businesses WHERE id = ? LIMIT 1', [b.business_id]);
    const orgOn = !!Number(org[0]?.require_2fa);
    const branchOn = !!Number(b.require_2fa);
    const [staff] = await pool.query(
      `SELECT s.id, s.full_name, s.supabase_uid, r.name AS role_name
         FROM staff s JOIN roles r ON r.id = s.role_id
        WHERE s.business_id = ? AND s.branch_id = ? AND s.is_active = TRUE AND r.name IN ('supervisor', 'manager')
        ORDER BY FIELD(r.name, 'manager', 'supervisor'), s.full_name
        LIMIT ${LIST_CAP}`,
      [b.business_id, b.id]
    );
    const enrolled = await enrolledByUid(staff.map((s) => s.supabase_uid).filter(Boolean));
    return res.json({
      branch_id: b.id,
      branch_name: b.name,
      require_2fa: branchOn,
      org_requires: orgOn,
      checked: !!admin(),
      staff: staff.map((s) => ({
        id: s.id,
        full_name: s.full_name,
        role: s.role_name,
        has_login: !!s.supabase_uid,
        enrolled: s.supabase_uid ? (enrolled.has(s.supabase_uid) ? enrolled.get(s.supabase_uid) : null) : false,
        must_use: orgOn || branchOn,
        is_you: s.id === req.dbStaff.id,
      })),
    });
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') return res.status(503).json({ error: 'Two-factor settings are not available yet.' });
    console.error('[MFA] branch:', err.message);
    return res.status(500).json({ error: 'Could not load two-factor settings.' });
  }
});

const branchSchema = z.object({ require_2fa: z.boolean(), branch_id: z.string().max(36).optional() }).strict();

router.put('/branch', requireAuth, requireStaffRole('manager', 'executive'), async (req, res) => {
  const parsed = branchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Send require_2fa as true or false.' });
  try {
    const b = await allowedBranch(req, parsed.data.branch_id);
    if (!b) return res.status(403).json({ error: 'You can only change two-factor for your own branch.' });
    // Both ids in the WHERE: the row changed is this organisation's branch or nothing.
    const [r] = await pool.query('UPDATE branches SET require_2fa = ? WHERE id = ? AND business_id = ?', [parsed.data.require_2fa, b.id, b.business_id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Branch not found.' });
    forgetOrg();
    await audit(req, b.business_id, parsed.data.require_2fa ? 'two_factor_branch_required' : 'two_factor_branch_not_required', 'branch', b.id);
    return res.json({ branch_id: b.id, require_2fa: parsed.data.require_2fa });
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') return res.status(503).json({ error: 'Two-factor settings are not available yet.' });
    console.error('[MFA] branch switch:', err.message);
    return res.status(500).json({ error: 'Could not change the setting.' });
  }
});

const resetSchema = z.object({ staff_id: z.string().min(1).max(36) }).strict();

router.post('/reset', requireAuth, requireStaffRole('executive'), async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a staff member.' });
  if (parsed.data.staff_id === req.dbStaff.id) {
    return res.status(400).json({ error: 'You cannot reset your own two-factor here. Another executive can, or DKS Technologies after checking who you are.' });
  }
  const client = admin();
  if (!client) return res.status(503).json({ error: 'Two-factor reset is not configured on this server.' });
  try {
    const [rows] = await pool.query(
      'SELECT s.id, s.business_id, s.supabase_uid, r.name AS role_name FROM staff s JOIN roles r ON r.id = s.role_id WHERE s.id = ? LIMIT 1',
      [parsed.data.staff_id]
    );
    const target = rows[0];
    // Same refusal for "not yours" and "does not exist": no probing other organisations.
    if (!target || (!isPlatformAdmin(req) && target.business_id !== req.dbStaff.business_id)) {
      return res.status(404).json({ error: 'Staff member not found.' });
    }
    if (target.role_name === 'platform_admin') return res.status(403).json({ error: 'This account cannot be changed here.' });
    if (!target.supabase_uid) return res.json({ removed: 0 });

    const { data, error } = await client.auth.admin.mfa.listFactors({ userId: target.supabase_uid });
    if (error) throw error;
    let removed = 0;
    for (const f of data?.factors || []) {
      const { error: delErr } = await client.auth.admin.mfa.deleteFactor({ id: f.id, userId: target.supabase_uid });
      if (delErr) throw delErr;
      removed += 1;
    }
    await audit(req, target.business_id, 'two_factor_reset', 'staff', target.id);
    return res.json({ removed });
  } catch (err) {
    console.error('[MFA] reset:', err.message);
    return res.status(500).json({ error: 'Could not reset two-factor for this person.' });
  }
});

module.exports = router;

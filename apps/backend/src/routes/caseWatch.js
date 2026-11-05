/**
 * caseWatch.js — which supervisor is looking after a client's case.
 *
 * GET  /api/case-watch?user_id=     who has it now, who had it before, and who it
 *                                   could go to
 * POST /api/case-watch/take         a supervisor takes an unwatched case
 * POST /api/case-watch/assign       a manager gives or moves a case to a supervisor
 * POST /api/case-watch/transfer     the watcher (or a manager) passes it on
 * POST /api/case-watch/release      the watcher (or a manager) lets it go
 *
 * Only a client who has actually visited this organisation can be watched, and a
 * supervisor can only be given a case from their own organisation.
 */
const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const { requireStaffRole } = require('../middleware/tenantAccess');

const MANAGERS = ['manager', 'executive'];
const isManager = (req) => MANAGERS.includes(req.dbStaff?.role_name);

/** Has this person visited this organisation? It is what makes them a case here. */
async function isClient(businessId, userId) {
  if (!userId) return false;
  const [rows] = await pool.query(
    `SELECT 1 FROM queue_tickets t JOIN queues q ON q.id = t.queue_id JOIN branches b ON b.id = q.branch_id
      WHERE t.user_id = ? AND b.business_id = ? LIMIT 1`, [userId, businessId]);
  return rows.length > 0;
}

async function currentWatch(businessId, userId) {
  const [rows] = await pool.query(
    `SELECT w.id, w.supervisor_id, st.full_name AS supervisor_name
       FROM case_watches w JOIN staff st ON st.id = w.supervisor_id
      WHERE w.business_id = ? AND w.user_id = ? AND w.ended_at IS NULL LIMIT 1`, [businessId, userId]);
  return rows[0] || null;
}

async function supervisorInBusiness(businessId, staffId) {
  const [rows] = await pool.query(
    `SELECT s.id, s.full_name FROM staff s JOIN roles r ON r.id = s.role_id
      WHERE s.id = ? AND s.business_id = ? AND s.is_active = TRUE AND r.name = 'supervisor' LIMIT 1`, [staffId, businessId]);
  return rows[0] || null;
}

async function clientName(userId) {
  const [rows] = await pool.query('SELECT full_name FROM users WHERE id = ?', [userId]);
  return rows[0]?.full_name || 'A client';
}

async function tellSupervisor(toStaff, from, message) {
  if (toStaff === from.id) return;
  await pool.query(
    `INSERT INTO notifications (id, user_id, staff_id, sent_by_staff_id, ticket_id, notification_type, channel, message, is_read, sent_at)
     VALUES (?, NULL, ?, ?, NULL, 'assignment_request', 'in_app', ?, FALSE, NOW())`,
    [uuidv4(), toStaff, from.id, message]);
}

const end = (id, reason) => pool.query('UPDATE case_watches SET ended_at = NOW(), end_reason = ?, open_user = NULL WHERE id = ?', [reason, id]);
const begin = (businessId, userId, supervisorId, by) => pool.query(
  'INSERT INTO case_watches (id, business_id, user_id, supervisor_id, assigned_by, open_user) VALUES (?, ?, ?, ?, ?, ?)',
  [uuidv4(), businessId, userId, supervisorId, by, userId]);

/** Each write works for the signed-in person's own organisation only. */
const clientGuard = async (req, res) => {
  const userId = String(req.body?.user_id || '');
  if (!(await isClient(req.dbStaff.business_id, userId))) {
    res.status(404).json({ error: 'This client has no visits here.' });
    return null;
  }
  return userId;
};

const duplicate = (res, err) => {
  if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Someone else has just taken this case.' });
  console.error('case watch:', err);
  return res.status(500).json({ error: 'Could not update this case.' });
};

router.get('/', requireAuth, requireStaffRole('supervisor', 'manager', 'executive'), async (req, res) => {
  try {
    const me = req.dbStaff;
    const userId = String(req.query.user_id || '');
    if (!(await isClient(me.business_id, userId))) return res.status(404).json({ error: 'This client has no visits here.' });
    const [history] = await pool.query(
      `SELECT st.full_name AS supervisor_name, by_.full_name AS assigned_by_name, w.started_at, w.ended_at, w.end_reason
         FROM case_watches w JOIN staff st ON st.id = w.supervisor_id LEFT JOIN staff by_ ON by_.id = w.assigned_by
        WHERE w.business_id = ? AND w.user_id = ? ORDER BY w.started_at DESC LIMIT 30`, [me.business_id, userId]);
    const [supervisors] = await pool.query(
      `SELECT s.id, s.full_name, br.name AS branch_name
         FROM staff s JOIN roles r ON r.id = s.role_id LEFT JOIN branches br ON br.id = s.branch_id
        WHERE s.business_id = ? AND s.is_active = TRUE AND r.name = 'supervisor'
          ${me.branch_id ? 'AND s.branch_id = ?' : ''}
        ORDER BY s.full_name`, me.branch_id ? [me.business_id, me.branch_id] : [me.business_id]);
    res.json({ current: await currentWatch(me.business_id, userId), history, supervisors, me: me.id, role: me.role_name });
  } catch (err) {
    console.error('case watch read:', err);
    res.status(500).json({ error: 'Could not load this case.' });
  }
});

router.post('/take', requireAuth, requireStaffRole('supervisor'), auditLog('case_take', 'case_watch'), async (req, res) => {
  try {
    const userId = await clientGuard(req, res);
    if (!userId) return undefined;
    const me = req.dbStaff;
    const held = await currentWatch(me.business_id, userId);
    if (held) return res.status(409).json({ error: `${held.supervisor_name} is already watching this case.` });
    await begin(me.business_id, userId, me.id, me.id);
    return res.status(201).json({ watching: true });
  } catch (err) {
    return duplicate(res, err);
  }
});

async function handOver(req, res, reason) {
  try {
    const userId = await clientGuard(req, res);
    if (!userId) return undefined;
    const me = req.dbStaff;
    const target = await supervisorInBusiness(me.business_id, String(req.body?.supervisor_id || ''));
    if (!target) return res.status(404).json({ error: 'Choose a supervisor from this organisation.' });
    const held = await currentWatch(me.business_id, userId);
    if (held && held.supervisor_id === target.id) return res.json({ watching: true });
    if (!isManager(req) && held?.supervisor_id !== me.id) {
      return res.status(403).json({ error: 'Only the supervisor watching this case, or a manager, can pass it on.' });
    }
    if (held) await end(held.id, reason);
    await begin(me.business_id, userId, target.id, me.id);
    await tellSupervisor(target.id, me, `${me.full_name} has asked you to watch ${await clientName(userId)}'s case.`);
    return res.status(201).json({ watching: true, supervisor: target.full_name });
  } catch (err) {
    return duplicate(res, err);
  }
}

router.post('/assign', requireAuth, requireStaffRole('manager', 'executive'), auditLog('case_assign', 'case_watch'), (req, res) => handOver(req, res, 'reassigned'));
router.post('/transfer', requireAuth, requireStaffRole('supervisor', 'manager', 'executive'), auditLog('case_transfer', 'case_watch'), (req, res) => handOver(req, res, 'transferred'));

router.post('/release', requireAuth, requireStaffRole('supervisor', 'manager', 'executive'), auditLog('case_release', 'case_watch'), async (req, res) => {
  try {
    const userId = await clientGuard(req, res);
    if (!userId) return undefined;
    const me = req.dbStaff;
    const held = await currentWatch(me.business_id, userId);
    if (!held) return res.json({ watching: false });
    if (!isManager(req) && held.supervisor_id !== me.id) {
      return res.status(403).json({ error: 'Only the supervisor watching this case, or a manager, can let it go.' });
    }
    await end(held.id, 'released');
    return res.json({ watching: false });
  } catch (err) {
    console.error('case release:', err);
    return res.status(500).json({ error: 'Could not update this case.' });
  }
});

module.exports = router;

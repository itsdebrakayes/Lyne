/**
 * closures.js — closing a branch for a day or a run of days.
 *
 * GET  /api/closures               every recent, current and coming closure
 * POST /api/closures               close a branch (manager, executive), or the
 *                                  whole organisation (executive, no branch_id)
 * POST /api/closures/:id/lift      reopen early
 * GET  /api/closures/holidays       the coming national holidays
 * POST /api/closures/holidays/:day/open    stay open on one (DELETE to undo)
 *
 * A closure starting today clears the lines at once, with the reason, so nobody
 * waits for a counter that will not open. Staff are told in their bell, and anyone
 * holding a booking in those days is told on their phone.
 */
const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const { requireStaffRole } = require('../middleware/tenantAccess');
const { sendPushToUser } = require('../utils/pushSender');
const { closeBranchLines } = require('../jobs/expireStaleTickets');

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD.');
const closureSchema = z.object({
  branch_id: z.string().trim().min(1).max(36).nullable().optional(),
  kind: z.enum(['closure', 'outage']).default('closure'),
  reason: z.string().trim().min(3, 'Say why, in a few words.').max(255),
  starts_on: day,
  ends_on: day,
}).refine((b) => b.ends_on >= b.starts_on, { message: 'The last day cannot be before the first.' });

const PUSH_BODY = 'Your queue status has changed. Open Lyne for the details.';

const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

router.get('/', requireAuth, requireStaffRole('line_staff', 'supervisor', 'manager', 'executive'), async (req, res) => {
  try {
    const me = req.dbStaff;
    const [rows] = await pool.query(
      `SELECT c.id, c.kind, c.reason, c.branch_id, br.name AS branch_name,
              DATE_FORMAT(c.starts_on, '%Y-%m-%d') AS starts_on, DATE_FORMAT(c.ends_on, '%Y-%m-%d') AS ends_on,
              c.created_at, c.lifted_at, st.full_name AS created_by_name,
              CURDATE() BETWEEN c.starts_on AND c.ends_on AND c.lifted_at IS NULL AS in_force
         FROM branch_closures c
         LEFT JOIN branches br ON br.id = c.branch_id
         LEFT JOIN staff st ON st.id = c.created_by
        WHERE c.business_id = ? AND c.ends_on >= CURDATE() - INTERVAL 30 DAY
          ${me.branch_id ? 'AND (c.branch_id IS NULL OR c.branch_id = ?)' : ''}
        ORDER BY c.starts_on DESC LIMIT 50`,
      me.branch_id ? [me.business_id, me.branch_id] : [me.business_id]);
    res.json(rows);
  } catch (err) {
    console.error('closures list:', err);
    res.status(500).json({ error: 'Could not load closures.' });
  }
});

router.post('/', requireAuth, requireStaffRole('manager', 'executive'), auditLog('create_closure', 'branch_closure'), async (req, res) => {
  const parsed = closureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the closure details.' });
  const { kind, reason, starts_on: startsOn, ends_on: endsOn } = parsed.data;
  const me = req.dbStaff;
  const isExecutive = me.role_name === 'executive';

  /* A manager closes their own branch. Only an executive can close the whole
     organisation or reach another branch. */
  const branchId = isExecutive ? (parsed.data.branch_id || null) : me.branch_id;
  if (!isExecutive && !branchId) return res.status(403).json({ error: 'You are not assigned to a branch.' });

  try {
    const [branches] = await pool.query(
      `SELECT id, name FROM branches WHERE business_id = ? AND is_active = 1 ${branchId ? 'AND id = ?' : ''}`,
      branchId ? [me.business_id, branchId] : [me.business_id]);
    if (!branches.length) return res.status(404).json({ error: 'Branch not found.' });

    const id = uuidv4();
    await pool.query(
      `INSERT INTO branch_closures (id, business_id, branch_id, kind, reason, starts_on, ends_on, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, me.business_id, branchId, kind, reason, startsOn, endsOn, me.id]);

    const ids = branches.map((b) => b.id);
    const span = startsOn === endsOn ? longDate(startsOn) : `${longDate(startsOn)} to ${longDate(endsOn)}`;
    const where = branchId ? branches[0].name : 'All branches';
    const [[today]] = await pool.query('SELECT DATE_FORMAT(CURDATE(), \'%Y-%m-%d\') AS d');

    /* Lines open now end at once, each with the reason. */
    const startsNow = startsOn <= today.d && endsOn >= today.d;
    const cleared = startsNow ? await closeBranchLines(ids, kind) : 0;

    /* Everybody who works there, down the hierarchy. */
    const [staff] = await pool.query(
      `SELECT id FROM staff WHERE business_id = ? AND is_active = TRUE AND id <> ?
          AND (branch_id IS NULL OR branch_id IN (?))`, [me.business_id, me.id, ids]);
    const staffText = `${where} ${kind === 'outage' ? 'is out of service' : 'is closed'} for ${span}: ${reason}.`;
    if (staff.length) {
      await pool.query(
        `INSERT INTO notifications (id, user_id, staff_id, sent_by_staff_id, ticket_id, notification_type, channel, message, is_read, sent_at) VALUES ?`,
        [staff.map((s) => [uuidv4(), null, s.id, me.id, null, 'branch_closure', 'in_app', staffText, false, new Date()])]);
    }

    /* Anyone booked into those days, once each. */
    const [booked] = await pool.query(
      `SELECT DISTINCT r.user_id FROM session_registrations r JOIN scheduled_sessions ss ON ss.id = r.session_id
        WHERE ss.branch_id IN (?) AND ss.session_date BETWEEN ? AND ? AND r.status = 'registered' AND r.user_id IS NOT NULL`,
      [ids, startsOn, endsOn]);
    const clientText = `${where} ${kind === 'outage' ? 'is out of service' : 'will be closed'} for ${span}: ${reason}. Your booking in those days may be affected.`;
    for (const b of booked) {
      // eslint-disable-next-line no-await-in-loop
      await pool.query(
        `INSERT INTO notifications (id, user_id, ticket_id, notification_type, channel, message) VALUES (?, ?, NULL, 'queue_update', 'push', ?)`,
        [uuidv4(), b.user_id, clientText]);
      sendPushToUser(b.user_id, { userId: b.user_id, title: 'Your booking', body: PUSH_BODY, data: { type: 'queue_update' } }).catch(() => {});
    }

    res.status(201).json({ id, branches: ids.length, tickets_closed: cleared, staff_told: staff.length, bookings_told: booked.length });
  } catch (err) {
    console.error('closure create:', err);
    res.status(500).json({ error: 'Could not record the closure.' });
  }
});

/* ── National holidays close a branch by themselves; these keep one open. ── */
router.get('/holidays', requireAuth, requireStaffRole('line_staff', 'supervisor', 'manager', 'executive'), async (req, res) => {
  try {
    const me = req.dbStaff;
    const [[home]] = await pool.query(
      `SELECT COALESCE(br.country_code, (SELECT MIN(x.country_code) FROM branches x WHERE x.business_id = ?)) AS country
         FROM (SELECT 1) one LEFT JOIN branches br ON br.id = ?`, [me.business_id, me.branch_id || null]);
    const [rows] = await pool.query(
      `SELECT DATE_FORMAT(ph.holiday_date, '%Y-%m-%d') AS day, ph.name,
              (SELECT GROUP_CONCAT(COALESCE(br.name, 'Every branch') SEPARATOR ', ')
                 FROM holiday_openings o LEFT JOIN branches br ON br.id = o.branch_id
                WHERE o.business_id = ? AND o.holiday_date = ph.holiday_date
                  ${me.branch_id ? 'AND (o.branch_id IS NULL OR o.branch_id = ?)' : ''}) AS staying_open
         FROM public_holidays ph
        WHERE ph.country = ? AND ph.is_full_day = 1 AND ph.holiday_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 120 DAY
        ORDER BY ph.holiday_date`,
      me.branch_id ? [me.business_id, me.branch_id, home?.country] : [me.business_id, home?.country]);
    res.json(rows);
  } catch (err) {
    console.error('holidays list:', err);
    res.status(500).json({ error: 'Could not load holidays.' });
  }
});

/** Who this request is for: a manager only ever acts for their own branch. */
const holidayScope = (req) => (req.dbStaff.role_name === 'executive' ? (req.body?.branch_id || req.query.branch_id || null) : req.dbStaff.branch_id);

router.post('/holidays/:day/open', requireAuth, requireStaffRole('manager', 'executive'), auditLog('holiday_stay_open', 'holiday_opening'), async (req, res) => {
  try {
    const me = req.dbStaff;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(req.params.day)) return res.status(400).json({ error: 'Choose a date.' });
    const branchId = holidayScope(req);
    if (me.role_name !== 'executive' && !branchId) return res.status(403).json({ error: 'You are not assigned to a branch.' });
    const [existing] = await pool.query(
      'SELECT id FROM holiday_openings WHERE business_id = ? AND holiday_date = ? AND branch_id <=> ?', [me.business_id, req.params.day, branchId]);
    if (!existing.length) {
      await pool.query(
        'INSERT INTO holiday_openings (id, business_id, branch_id, holiday_date, created_by) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), me.business_id, branchId, req.params.day, me.id]);
    }
    res.status(201).json({ staying_open: true });
  } catch (err) {
    console.error('holiday open:', err);
    res.status(500).json({ error: 'Could not keep the branch open.' });
  }
});

router.delete('/holidays/:day/open', requireAuth, requireStaffRole('manager', 'executive'), auditLog('holiday_close_again', 'holiday_opening'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM holiday_openings WHERE business_id = ? AND holiday_date = ? AND branch_id <=> ?',
      [req.dbStaff.business_id, req.params.day, holidayScope(req)]);
    res.json({ staying_open: false });
  } catch (err) {
    console.error('holiday close:', err);
    res.status(500).json({ error: 'Could not change this holiday.' });
  }
});

router.post('/:id/lift', requireAuth, requireStaffRole('manager', 'executive'), auditLog('lift_closure', 'branch_closure'), async (req, res) => {
  try {
    const me = req.dbStaff;
    const [[c]] = await pool.query('SELECT id, business_id, branch_id FROM branch_closures WHERE id = ? AND lifted_at IS NULL', [req.params.id]);
    if (!c || c.business_id !== me.business_id) return res.status(404).json({ error: 'Closure not found.' });
    if (me.role_name !== 'executive' && c.branch_id !== me.branch_id) {
      return res.status(403).json({ error: 'Only an executive can lift this closure.' });
    }
    await pool.query('UPDATE branch_closures SET lifted_at = NOW(), lifted_by = ? WHERE id = ?', [me.id, c.id]);
    res.json({ lifted: true });
  } catch (err) {
    console.error('closure lift:', err);
    res.status(500).json({ error: 'Could not lift the closure.' });
  }
});

module.exports = router;

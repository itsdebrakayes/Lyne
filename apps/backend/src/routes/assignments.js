/**
 * assignments.js — Staff counter assignments
 *
 * GET  /api/assignments?branch_id=&date=  — get assignments for a branch/date
 * POST /api/assignments                   — create assignment (manager/executive)
 * DELETE /api/assignments/:id             — remove assignment (manager/executive)
 */

const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { openSitting, closeSitting } = require('../utils/counterSittings');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { auditLog } = require('../middleware/auditLog');
const {
  requireStaffRole,
  requireBranchAccess,
  scopedBranchId,
  assertBusinessAccess,
  assertBranchAccess,
  isPlatformAdmin,
} = require('../middleware/tenantAccess');

router.get('/', requireAuth, requireStaffRole('supervisor', 'manager', 'executive'), requireBranchAccess, async (req, res) => {
  try {
    const { branch_id, date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const conditions = ['sa.assignment_date = ?'];
    const params = [targetDate];

    if (!isPlatformAdmin(req)) {
      conditions.push('s.business_id = ?');
      params.push(req.dbStaff.business_id);
    }

    const scopedBranch = scopedBranchId(req, branch_id);
    if (scopedBranch) {
      conditions.push('c.branch_id = ?');
      params.push(scopedBranch);
    }

    const [rows] = await pool.query(
      `SELECT sa.*, s.full_name AS staff_name, s.staff_code, r.name AS role_name,
              c.label AS counter_label, c.counter_number, c.branch_id
       FROM staff_assignments sa
       JOIN staff s    ON sa.staff_id   = s.id
       JOIN roles r    ON s.role_id     = r.id
       JOIN counters c ON sa.counter_id = c.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY c.counter_number`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch assignments.' });
  }
});

router.post('/', requireAuth, requireStaffRole('supervisor', 'manager', 'executive'), auditLog('create_assignment', 'staff_assignment'), validate(schemas.createAssignment), async (req, res) => {
  try {
    const { staff_id, counter_id, assignment_date, shift_start, shift_end } = req.body;
    if (!staff_id || !counter_id) return res.status(400).json({ error: 'staff_id and counter_id are required.' });

    const date = assignment_date || new Date().toISOString().slice(0, 10);
    const [accessRows] = await pool.query(
      `SELECT s.business_id AS staff_business_id, s.branch_id AS staff_branch_id,
              b.business_id AS counter_business_id, c.branch_id AS counter_branch_id
       FROM staff s
       JOIN counters c ON c.id = ?
       JOIN branches b ON c.branch_id = b.id
       WHERE s.id = ?
       LIMIT 1`,
      [counter_id, staff_id]
    );
    if (!accessRows.length) return res.status(404).json({ error: 'Staff or counter not found.' });
    const access = accessRows[0];
    if (access.staff_business_id !== access.counter_business_id) {
      return res.status(400).json({ error: 'Staff and counter must belong to the same business.' });
    }
    if (!assertBusinessAccess(req, access.staff_business_id) || !assertBranchAccess(req, access.counter_branch_id)) {
      return res.status(403).json({ error: 'You do not have access to this assignment.' });
    }
    const id = uuidv4();

    await pool.query(
      `INSERT INTO staff_assignments (id, staff_id, counter_id, assignment_date, shift_start, shift_end, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE counter_id = VALUES(counter_id), shift_start = VALUES(shift_start), shift_end = VALUES(shift_end)`,
      [id, staff_id, counter_id, date, shift_start || null, shift_end || null, req.dbStaff?.id || null]
    );

    /* Moved while on shift: the person's desk changes now, the old counter closes
       unless somebody else is on it, and they are told, so nobody finds out by
       noticing the wrong line on their screen. */
    const [[now]] = await pool.query('SELECT ? = CURDATE() AS today', [date]);
    if (Number(now?.today) === 1) {
      const [open] = await pool.query(
        'SELECT id, counter_id, on_break_since FROM staff_shifts WHERE staff_id = ? AND clocked_out_at IS NULL LIMIT 1', [staff_id]);
      const shift = open?.[0];
      if (shift && shift.counter_id !== counter_id) {
        await closeSitting(pool, staff_id, 'moved');
        await pool.query('UPDATE staff_shifts SET counter_id = ? WHERE id = ?', [counter_id, shift.id]);
        if (!shift.on_break_since) await openSitting(pool, { counterId: counter_id, staffId: staff_id, shiftId: shift.id });
        const [[seat]] = await pool.query(
          `SELECT c.label, s.name AS service_name FROM counters c JOIN services s ON s.id = c.service_id WHERE c.id = ?`, [counter_id]);
        if (seat && staff_id !== req.dbStaff?.id) {
          await pool.query(
            `INSERT INTO notifications (id, user_id, staff_id, sent_by_staff_id, ticket_id, notification_type, channel, message, is_read, sent_at)
             VALUES (?, NULL, ?, ?, NULL, 'assignment_request', 'in_app', ?, FALSE, NOW())`,
            [uuidv4(), staff_id, req.dbStaff?.id || null, `You have been moved to ${seat.label} (${seat.service_name}).`]);
        }
      }
    }

    const [created] = await pool.query('SELECT * FROM staff_assignments WHERE staff_id = ? AND assignment_date = ?', [staff_id, date]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create assignment.' });
  }
});

router.delete('/:id', requireAuth, requireStaffRole('supervisor', 'manager', 'executive'), auditLog('delete_assignment', 'staff_assignment'), async (req, res) => {
  try {
    const [existing] = await pool.query(
      `SELECT b.business_id, c.branch_id
       FROM staff_assignments sa
       JOIN counters c ON sa.counter_id = c.id
       JOIN branches b ON c.branch_id = b.id
       WHERE sa.id = ?
       LIMIT 1`,
      [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Assignment not found.' });
    if (!assertBusinessAccess(req, existing[0].business_id) || !assertBranchAccess(req, existing[0].branch_id)) {
      return res.status(403).json({ error: 'You do not have access to this assignment.' });
    }
    const [[seat]] = await pool.query('SELECT staff_id, assignment_date = CURDATE() AS today FROM staff_assignments WHERE id = ?', [req.params.id]);
    await pool.query('DELETE FROM staff_assignments WHERE id = ?', [req.params.id]);
    if (Number(seat?.today) === 1) {
      await closeSitting(pool, seat.staff_id, 'unseated');
      await pool.query('UPDATE staff_shifts SET counter_id = NULL WHERE staff_id = ? AND clocked_out_at IS NULL', [seat.staff_id]);
    }
    res.json({ message: 'Assignment removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete assignment.' });
  }
});

module.exports = router;

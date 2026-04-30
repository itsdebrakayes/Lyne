/**
 * assignments.js — Staff counter assignments
 *
 * GET  /api/assignments?branch_id=&date=  — get assignments for a branch/date
 * POST /api/assignments                   — create assignment (manager/executive)
 * DELETE /api/assignments/:id             — remove assignment (manager/executive)
 */

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', requireAuth, requireRole('manager', 'executive'), async (req, res) => {
  try {
    const { branch_id, date } = req.query;
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const conditions = ['sa.assignment_date = ?'];
    const params = [targetDate];

    if (branch_id) {
      conditions.push('c.branch_id = ?');
      params.push(branch_id);
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

router.post('/', requireAuth, requireRole('manager', 'executive'), async (req, res) => {
  try {
    const { staff_id, counter_id, assignment_date, shift_start, shift_end } = req.body;
    if (!staff_id || !counter_id) return res.status(400).json({ error: 'staff_id and counter_id are required.' });

    const date = assignment_date || new Date().toISOString().slice(0, 10);
    const id = uuidv4();

    await pool.query(
      `INSERT INTO staff_assignments (id, staff_id, counter_id, assignment_date, shift_start, shift_end, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE counter_id = VALUES(counter_id), shift_start = VALUES(shift_start), shift_end = VALUES(shift_end)`,
      [id, staff_id, counter_id, date, shift_start || null, shift_end || null, req.dbStaff?.id || null]
    );

    const [created] = await pool.query('SELECT * FROM staff_assignments WHERE staff_id = ? AND assignment_date = ?', [staff_id, date]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create assignment.' });
  }
});

router.delete('/:id', requireAuth, requireRole('manager', 'executive'), async (req, res) => {
  try {
    await pool.query('DELETE FROM staff_assignments WHERE id = ?', [req.params.id]);
    res.json({ message: 'Assignment removed.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete assignment.' });
  }
});

module.exports = router;

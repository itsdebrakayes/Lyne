/**
 * services.js
 *
 * GET  /api/services?business_id=  — list services for a business (public)
 * GET  /api/services/:id           — get one service (public)
 * POST /api/services               — create (manager/executive)
 * PUT  /api/services/:id           — update (manager/executive)
 */

const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const { z } = require('zod');
const pool = require('../db/pool');
const { projectedWaitMinutes } = require('../utils/etaMath');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const {
  requireStaffRole,
  requireBusinessAccess,
  requireBranchAccess,
  scopedBusinessId,
  assertBusinessAccess,
  assertBranchAccess,
} = require('../middleware/tenantAccess');

const readinessItemSchema = z.object({
  id: z.string().max(64).optional(),
  kind: z.enum(['bring', 'prepare']),
  label: z.string().trim().min(1, 'Every checklist item needs a label.').max(140),
  detail: z.string().trim().max(400).optional().nullable(),
  is_mandatory: z.boolean().default(true),
  lead_minutes: z.number().int().min(0).max(10080).optional().nullable(),
});

const readinessListSchema = z.object({
  items: z.array(readinessItemSchema).max(30, 'A service can have up to 30 readiness items.'),
});

function validationMessage(error) {
  return error.issues?.[0]?.message || 'Invalid readiness checklist.';
}

function canAuthorReadiness(req, service) {
  if (!assertBusinessAccess(req, service.business_id)) return false;
  if (req.dbStaff?.role_name !== 'line_staff') return true;
  return req.dbStaff.assigned_service_id === service.id;
}

router.get('/', async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    const conditions = ['s.is_active = TRUE'];
    const params = [];
    if (business_id) { conditions.push('s.business_id = ?'); params.push(business_id); }
    if (branch_id) {
      conditions.push(`EXISTS (
        SELECT 1
        FROM counters c
        WHERE c.service_id = s.id
          AND c.branch_id = ?
          AND c.is_active = TRUE
      )`);
      params.push(branch_id);
    }
    const where = 'WHERE ' + conditions.join(' AND ');
    const branchWaitFilter = branch_id ? 'AND q.branch_id = ?' : '';
    const branchWaitParams = branch_id ? [branch_id] : [];
    // A projected wait only makes sense for one branch — counters and the live
    // line belong to a specific location. Browsing across branches keeps using
    // the historical average; a single branch gets the counter-aware estimate.
    const counterSelect = branch_id
      ? `(SELECT COUNT(*) FROM counters c WHERE c.service_id = s.id AND c.branch_id = ? AND c.is_active = TRUE)`
      : 'NULL';
    const counterParams = branch_id ? [branch_id] : [];

    const [rows] = await pool.query(
      `SELECT s.*,
              b.name AS business_name,
              (SELECT COUNT(*) FROM service_readiness sr
                WHERE sr.service_id = s.id AND sr.is_active = TRUE) AS readiness_count,
              -- live waiting count for this service across open queues
              COALESCE((
                SELECT COUNT(*)
                FROM queue_tickets qt
                JOIN queues q ON qt.queue_id = q.id
                WHERE q.service_id = s.id
                  AND q.is_active = TRUE
                  AND q.queue_date = CURDATE()
                  ${branchWaitFilter}
                  AND qt.status = 'waiting'
              ), 0) AS waiting_count,
              -- rolling avg wait from last 50 completed tickets
              COALESCE((
                SELECT AVG(TIMESTAMPDIFF(MINUTE, qt.joined_at, qt.completed_at))
                FROM queue_tickets qt
                JOIN queues q ON qt.queue_id = q.id
                WHERE q.service_id = s.id
                  ${branchWaitFilter}
                  AND qt.status = 'served'
                  AND qt.completed_at IS NOT NULL
                ORDER BY qt.completed_at DESC
                LIMIT 50
              ), s.base_avg_time_minutes) AS avg_wait_minutes,
              -- per-person SERVICE time (not the full experience), the input to
              -- the projected ETA — same expression the /queues/live join screen
              -- uses, so Branch and Join can never disagree.
              COALESCE((
                SELECT AVG(TIMESTAMPDIFF(MINUTE, COALESCE(qt.started_serving_at, qt.called_at, qt.joined_at), qt.completed_at))
                FROM queue_tickets qt
                JOIN queues q ON qt.queue_id = q.id
                WHERE q.service_id = s.id
                  ${branchWaitFilter}
                  AND q.queue_date = CURDATE()
                  AND qt.status = 'served'
                  AND qt.completed_at IS NOT NULL
              ), s.base_avg_time_minutes) AS service_minutes,
              ${counterSelect} AS active_counters
       FROM services s
       JOIN businesses b ON s.business_id = b.id
       ${where}
       ORDER BY s.name`,
      [...branchWaitParams, ...branchWaitParams, ...branchWaitParams, ...counterParams, ...params]
    );

    // Attach the counter-aware projected wait for branch-scoped requests.
    const withEta = rows.map((r) => ({
      ...r,
      estimated_wait_minutes: branch_id
        ? projectedWaitMinutes({ ahead: r.waiting_count, perServiceMinutes: r.service_minutes, counters: r.active_counters })
        : null,
    }));
    res.json(withEta);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch services.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.*, b.name AS business_name,
              COALESCE((
                SELECT AVG(TIMESTAMPDIFF(MINUTE, qt.joined_at, qt.completed_at))
                FROM queue_tickets qt
                JOIN queues q ON qt.queue_id = q.id
                WHERE q.service_id = s.id
                  AND qt.status = 'served'
                  AND qt.completed_at IS NOT NULL
                ORDER BY qt.completed_at DESC
                LIMIT 50
              ), s.base_avg_time_minutes) AS avg_wait_minutes
       FROM services s
       JOIN businesses b ON s.business_id = b.id
       WHERE s.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Service not found.' });
    const svc = rows[0];
    // Parse intake_schema if stored as JSON string
    if (svc.intake_schema && typeof svc.intake_schema === 'string') {
      try { svc.intake_schema = JSON.parse(svc.intake_schema); } catch { svc.intake_schema = []; }
    }
    if (svc.required_profile_fields && typeof svc.required_profile_fields === 'string') {
      try { svc.required_profile_fields = JSON.parse(svc.required_profile_fields); } catch { svc.required_profile_fields = []; }
    }
    const [readiness] = await pool.query(
      `SELECT id, service_id, kind, seq, label, detail, is_mandatory, lead_minutes
       FROM service_readiness
       WHERE service_id = ? AND is_active = TRUE
       ORDER BY is_mandatory DESC, kind, seq, created_at`,
      [req.params.id]
    );
    svc.readiness = readiness.map((item) => ({
      ...item,
      is_mandatory: Boolean(item.is_mandatory),
    }));
    svc.readiness_count = svc.readiness.length;
    res.json(svc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch service.' });
  }
});

// PUT /api/services/:id/readiness — atomically replace one service's checklist.
// Managers own service content across their business. Line staff may keep the
// checklist for the service they are assigned to current, but cannot edit a
// different desk's instructions.
router.put(
  '/:id/readiness',
  requireAuth,
  requireStaffRole('line_staff', 'supervisor', 'manager', 'executive'),
  async (req, res) => {
    const parsed = readinessListSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed.error) });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [services] = await conn.query(
        'SELECT id, business_id FROM services WHERE id = ? FOR UPDATE',
        [req.params.id]
      );
      if (!services.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Service not found.' });
      }
      if (!canAuthorReadiness(req, services[0])) {
        await conn.rollback();
        return res.status(403).json({ error: 'You can only edit readiness for your assigned service.' });
      }

      const [existingItems] = await conn.query(
        'SELECT id FROM service_readiness WHERE service_id = ?',
        [req.params.id]
      );
      const existingIds = new Set(existingItems.map((item) => item.id));

      // A full replacement makes ordering and deletion one atomic save. This
      // uses the exact table created by migration 025 and adds no competing
      // checklist representation.
      await conn.query('DELETE FROM service_readiness WHERE service_id = ?', [req.params.id]);
      for (let seq = 0; seq < parsed.data.items.length; seq += 1) {
        const item = parsed.data.items[seq];
        await conn.query(
          `INSERT INTO service_readiness
             (id, service_id, kind, seq, label, detail, is_mandatory, lead_minutes, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`,
          [
            item.id && existingIds.has(item.id) ? item.id : uuidv4(), req.params.id, item.kind, seq, item.label,
            item.detail || null, item.is_mandatory, item.kind === 'prepare' ? item.lead_minutes ?? null : null,
          ]
        );
      }

      const [saved] = await conn.query(
        `SELECT id, service_id, kind, seq, label, detail, is_mandatory, lead_minutes
         FROM service_readiness WHERE service_id = ? AND is_active = TRUE
         ORDER BY is_mandatory DESC, kind, seq, created_at`,
        [req.params.id]
      );
      await conn.commit();
      res.json(saved.map((item) => ({ ...item, is_mandatory: Boolean(item.is_mandatory) })));
    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: 'Failed to save readiness checklist.' });
    } finally {
      conn.release();
    }
  }
);

router.post('/', requireAuth, requireStaffRole('manager', 'executive'), requireBusinessAccess('body'), requireBranchAccess, validate(schemas.createService), async (req, res) => {
  try {
    const { business_id, name, description, ticket_prefix, base_avg_time_minutes } = req.body;
    if (!business_id || !name) return res.status(400).json({ error: 'business_id and name are required.' });
    const id = uuidv4();
    await pool.query(
      `INSERT INTO services (id, business_id, name, description, ticket_prefix, base_avg_time_minutes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, scopedBusinessId(req, business_id), name, description || null, ticket_prefix || null, base_avg_time_minutes || 15]
    );
    const [created] = await pool.query('SELECT * FROM services WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create service.' });
  }
});

router.put('/:id', requireAuth, requireStaffRole('manager', 'executive'), validate(schemas.updateService), async (req, res) => {
  try {
    const { name, description, ticket_prefix, base_avg_time_minutes, is_active } = req.body;
    const [existing] = await pool.query(
      `SELECT s.business_id, q.branch_id
       FROM services s
       LEFT JOIN queues q ON q.service_id = s.id AND q.queue_date = CURDATE()
       WHERE s.id = ?
       LIMIT 1`,
      [req.params.id]
    );
    if (!existing.length) return res.status(404).json({ error: 'Service not found.' });
    if (!assertBusinessAccess(req, existing[0].business_id) || !assertBranchAccess(req, existing[0].branch_id)) {
      return res.status(403).json({ error: 'You do not have access to this service.' });
    }
    await pool.query(
      `UPDATE services SET
         name                  = COALESCE(?, name),
         description           = COALESCE(?, description),
         ticket_prefix         = COALESCE(?, ticket_prefix),
         base_avg_time_minutes = COALESCE(?, base_avg_time_minutes),
         is_active             = COALESCE(?, is_active),
         updated_at            = NOW()
       WHERE id = ?`,
      [name, description, ticket_prefix, base_avg_time_minutes, is_active, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM services WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update service.' });
  }
});

module.exports = router;

/**
 * tenantAccess.js
 *
 * Shared RBAC and tenant isolation helpers for the MySQL data layer.
 * MySQL does not provide native app-aware RLS, so every protected route must
 * pass through these checks before trusting a caller supplied business_id,
 * branch_id, queue_id, ticket_id, staff_id, or assignment id.
 */

const pool = require('../db/pool');

function roleName(req) {
  return req.dbStaff?.role_name || req.dbStaff?.role || null;
}

function isPlatformAdmin(req) {
  return roleName(req) === 'platform_admin';
}

function requireUser(req, res, next) {
  if (!req.dbUser) return res.status(403).json({ error: 'User account required.' });
  next();
}

function requireStaffRole(...roles) {
  return (req, res, next) => {
    if (!req.dbStaff) return res.status(403).json({ error: 'Staff account required.' });
    const role = roleName(req);
    if (!roles.includes(role) && !isPlatformAdmin(req)) {
      return res.status(403).json({ error: `Requires one of: ${roles.join(', ')}.` });
    }
    next();
  };
}

function assertBusinessAccess(req, businessId) {
  if (!businessId) return false;
  if (isPlatformAdmin(req)) return true;
  if (!req.dbStaff) return false;
  return req.dbStaff.business_id === businessId;
}

function assertBranchAccess(req, branchId) {
  if (!branchId) return true;
  if (isPlatformAdmin(req)) return true;
  if (!req.dbStaff) return false;
  const role = roleName(req);
  if (role === 'executive') return true;
  // Managers / line staff are strictly branch-scoped. A null branch_id must NOT
  // grant all-branch access (defense-in-depth: only executives are company-wide),
  // so require an explicit branch match.
  return !!req.dbStaff.branch_id && req.dbStaff.branch_id === branchId;
}

async function assertLineStaffQueueAccess(req, queue) {
  if (roleName(req) !== 'line_staff') return true;
  if (!req.dbStaff || !queue?.service_id || !queue?.branch_id) return false;
  if (req.dbStaff.assigned_service_id === queue.service_id && req.dbStaff.branch_id === queue.branch_id) {
    return true;
  }
  const [assignments] = await pool.query(
    `SELECT 1
     FROM staff_assignments sa
     JOIN counters c ON sa.counter_id = c.id
     WHERE sa.staff_id = ?
       AND sa.assignment_date = CURDATE()
       AND c.branch_id = ?
       AND c.service_id = ?
       AND c.is_active = TRUE
     LIMIT 1`,
    [req.dbStaff.id, queue.branch_id, queue.service_id]
  );
  if (assignments.length > 0) return true;

  /* "Allow Overflow Onto Any Window" — the manager's Settings toggle, enforced.
     When a branch turns it on, a clerk rostered AT THAT BRANCH may call from any
     of its lines, not only the service they are assigned to. That is the whole
     point of the setting: a long queue and a free clerk should not be blocked by
     a roster row.

     Two limits are deliberate and must stay. It never crosses a BRANCH — the
     branch check above still applies, so this cannot become a back door into a
     sister branch. And it never applies to a clerk with no branch of their own,
     because an unscoped staff row is a provisioning mistake and must fail
     closed. */
  if (req.dbStaff.branch_id !== queue.branch_id) return false;
  const [settings] = await pool.query(
    'SELECT allow_overflow FROM branch_settings WHERE branch_id = ? LIMIT 1',
    [queue.branch_id]
  );
  return Boolean(settings[0]?.allow_overflow);
}

function requireBusinessAccess(source = 'query') {
  return (req, res, next) => {
    const businessId = req[source]?.business_id;
    if (!assertBusinessAccess(req, businessId)) {
      return res.status(403).json({ error: 'You do not have access to this business.' });
    }
    next();
  };
}

async function requireBranchAccess(req, res, next) {
  try {
    const branchId = req.query.branch_id || req.body.branch_id || req.params.branch_id;
    if (!branchId) return next();
    const [rows] = await pool.query('SELECT business_id FROM branches WHERE id = ? LIMIT 1', [branchId]);
    if (!rows.length) return res.status(404).json({ error: 'Branch not found.' });
    if (!assertBusinessAccess(req, rows[0].business_id) || !assertBranchAccess(req, branchId)) {
      return res.status(403).json({ error: 'You do not have access to this branch.' });
    }
    next();
  } catch (err) {
    console.error('[TenantAccess] branch check failed:', err.message);
    res.status(500).json({ error: 'Failed to verify branch access.' });
  }
}

async function requireQueueAccess(req, res, next) {
  try {
    const queueId = req.query.queue_id || req.body.queue_id || req.params.queue_id || req.params.id;
    if (!queueId) return next();
    const [rows] = await pool.query(
      `SELECT b.business_id, q.branch_id, q.service_id
       FROM queues q
       JOIN branches b ON q.branch_id = b.id
       WHERE q.id = ?
       LIMIT 1`,
      [queueId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Queue not found.' });
    if (!assertBusinessAccess(req, rows[0].business_id)
      || !assertBranchAccess(req, rows[0].branch_id)
      || !await assertLineStaffQueueAccess(req, rows[0])) {
      return res.status(403).json({ error: 'You do not have access to this queue.' });
    }
    next();
  } catch (err) {
    console.error('[TenantAccess] queue check failed:', err.message);
    res.status(500).json({ error: 'Failed to verify queue access.' });
  }
}

async function requireTicketAccess(req, res, next) {
  try {
    const ticketId = req.query.ticket_id || req.body.ticket_id || req.params.ticket_id || req.params.id;
    if (!ticketId) return next();
    const [rows] = await pool.query(
      `SELECT t.user_id, b.business_id, q.branch_id, q.service_id
       FROM queue_tickets t
       JOIN queues q ON t.queue_id = q.id
       JOIN branches b ON q.branch_id = b.id
       WHERE t.id = ?
       LIMIT 1`,
      [ticketId]
    );
    if (!rows.length) return res.status(404).json({ error: 'Ticket not found.' });

    if (req.dbUser) {
      if (rows[0].user_id !== req.dbUser.id) {
        return res.status(403).json({ error: 'You do not have access to this ticket.' });
      }
      return next();
    }

    if (!assertBusinessAccess(req, rows[0].business_id)
      || !assertBranchAccess(req, rows[0].branch_id)
      || !await assertLineStaffQueueAccess(req, rows[0])) {
      return res.status(403).json({ error: 'You do not have access to this ticket.' });
    }
    next();
  } catch (err) {
    console.error('[TenantAccess] ticket check failed:', err.message);
    res.status(500).json({ error: 'Failed to verify ticket access.' });
  }
}

function scopedBusinessId(req, requestedBusinessId) {
  if (isPlatformAdmin(req)) return requestedBusinessId;
  return req.dbStaff?.business_id || requestedBusinessId;
}

function scopedBranchId(req, requestedBranchId) {
  if (isPlatformAdmin(req)) return requestedBranchId;
  const role = roleName(req);
  if (role === 'line_staff') return req.dbStaff?.branch_id || requestedBranchId;
  // Managers and supervisors are locked to their own branch.
  if ((role === 'manager' || role === 'supervisor') && req.dbStaff?.branch_id) return req.dbStaff.branch_id;
  return requestedBranchId;
}

module.exports = {
  requireUser,
  requireStaffRole,
  requireBusinessAccess,
  requireBranchAccess,
  requireQueueAccess,
  requireTicketAccess,
  assertBusinessAccess,
  assertBranchAccess,
  assertLineStaffQueueAccess,
  scopedBusinessId,
  scopedBranchId,
  roleName,
  isPlatformAdmin,
};

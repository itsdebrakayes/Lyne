/**
 * sse.js — Server-Sent Events for live queue updates
 *
 * GET /api/sse/queue/:queue_id
 *   Open an SSE stream. The client receives an event every time the queue
 *   state changes (ticket joined, status changed, position changed).
 *   No auth required — ticket_id is used as a lightweight access token
 *   so customers can track their own position without logging in.
 *
 * GET /api/sse/queue/:queue_id/staff
 *   Staff-facing SSE stream — full queue state with user names.
 *   Requires requireAuth + line_staff/manager/executive role.
 *
 * Events emitted:
 *   type: "queue_state"   — full current queue snapshot
 *   type: "ticket_update" — a single ticket's status changed
 *   type: "heartbeat"     — keepalive every 25 seconds
 */

const router = require('express').Router();
const pool   = require('../db/pool');
const { requireAuth, requireRole } = require('../middleware/auth');

// In-memory subscriber registry: queue_id → Set<res>
const staffSubscribers   = new Map();
const publicSubscribers  = new Map();

function subscribe(map, queueId, res) {
  if (!map.has(queueId)) map.set(queueId, new Set());
  map.get(queueId).add(res);
}
function unsubscribe(map, queueId, res) {
  map.get(queueId)?.delete(res);
  if (map.get(queueId)?.size === 0) map.delete(queueId);
}

function sendEvent(res, type, data) {
  try {
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch { /* client disconnected */ }
}

async function fetchQueueSnapshot(queueId, includeNames = false) {
  const nameCol = includeNames
    ? ', u.full_name AS user_name, u.phone AS user_phone'
    : ", '***' AS user_name, NULL AS user_phone";

  const [tickets] = await pool.query(
    `SELECT t.id, t.ticket_number, t.position, t.status,
            t.estimated_wait_minutes, t.joined_at,
            t.called_at, t.started_serving_at, t.completed_at
            ${nameCol}
     FROM queue_tickets t
     ${includeNames ? 'LEFT JOIN users u ON t.user_id = u.id' : ''}
     WHERE t.queue_id = ?
       AND t.status IN ('waiting','in_service')
     ORDER BY t.position`,
    [queueId]
  );

  const [queueRows] = await pool.query(
    `SELECT q.*, s.name AS service_name, b.name AS branch_name
     FROM queues q
     JOIN services s ON q.service_id = s.id
     JOIN branches b ON q.branch_id  = b.id
     WHERE q.id = ?`,
    [queueId]
  );

  return {
    queue:   queueRows[0] || null,
    tickets,
    waiting_count:    tickets.filter(t => t.status === 'waiting').length,
    in_service_count: tickets.filter(t => t.status === 'in_service').length,
    snapshot_at:      new Date().toISOString(),
  };
}

// ── Public SSE stream — customer tracking ─────────────────────
router.get('/queue/:queue_id', async (req, res) => {
  const { queue_id } = req.params;

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  subscribe(publicSubscribers, queue_id, res);

  // Send initial snapshot
  try {
    const snapshot = await fetchQueueSnapshot(queue_id, false);
    sendEvent(res, 'queue_state', snapshot);
  } catch (err) {
    sendEvent(res, 'error', { message: 'Failed to load queue.' });
  }

  // Heartbeat — prevents proxies from closing idle connections
  const heartbeat = setInterval(() => sendEvent(res, 'heartbeat', { ts: Date.now() }), 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    unsubscribe(publicSubscribers, queue_id, res);
  });
});

// ── Staff SSE stream — full names and full state ───────────────
router.get('/queue/:queue_id/staff',
  requireAuth,
  requireRole('line_staff', 'manager', 'executive'),
  async (req, res) => {
    const { queue_id } = req.params;

    res.setHeader('Content-Type',  'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection',    'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    subscribe(staffSubscribers, queue_id, res);

    try {
      const snapshot = await fetchQueueSnapshot(queue_id, true);
      sendEvent(res, 'queue_state', snapshot);
    } catch (err) {
      sendEvent(res, 'error', { message: 'Failed to load queue.' });
    }

    const heartbeat = setInterval(() => sendEvent(res, 'heartbeat', { ts: Date.now() }), 25_000);

    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe(staffSubscribers, queue_id, res);
    });
  }
);

/**
 * broadcastQueueUpdate — call this from tickets.js after any status/position change.
 * Imported by the tickets route to push updates to all open streams.
 */
async function broadcastQueueUpdate(queueId, changedTicket = null) {
  const hasPublic = publicSubscribers.has(queueId) && publicSubscribers.get(queueId).size > 0;
  const hasStaff  = staffSubscribers.has(queueId)  && staffSubscribers.get(queueId).size > 0;

  if (!hasPublic && !hasStaff) return;

  try {
    const [publicSnapshot, staffSnapshot] = await Promise.all([
      hasPublic ? fetchQueueSnapshot(queueId, false) : null,
      hasStaff  ? fetchQueueSnapshot(queueId, true)  : null,
    ]);

    if (hasPublic && publicSnapshot) {
      for (const res of publicSubscribers.get(queueId)) {
        if (changedTicket) sendEvent(res, 'ticket_update', changedTicket);
        sendEvent(res, 'queue_state', publicSnapshot);
      }
    }
    if (hasStaff && staffSnapshot) {
      for (const res of staffSubscribers.get(queueId)) {
        if (changedTicket) sendEvent(res, 'ticket_update', changedTicket);
        sendEvent(res, 'queue_state', staffSnapshot);
      }
    }
  } catch (err) {
    console.error('[SSE] broadcastQueueUpdate error:', err.message);
  }
}

module.exports = router;
module.exports.broadcastQueueUpdate = broadcastQueueUpdate;

/**
 * lobbyDisplay.js — what a "Now Serving" screen shows (migration 052).
 *
 * Ticket numbers, counters and how many are waiting. NEVER a name, a phone
 * number or a reason for the visit: the link to a screen is its only
 * protection, and a screen hangs in a public room. Keep it that way; anything
 * added here is published to the waiting room.
 *
 * The same answer is served for CACHE_MS, so ten screens in one hall cost the
 * database one read every few seconds between them, not ten.
 */
const pool = require('../db/pool');

const CACHE_MS = 3000;
const SERVING_SHOWN = 10;
const NEXT_SHOWN = 3;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/;

const cache = new Map();

async function findDisplay(token, db = pool) {
  if (typeof token !== 'string' || !TOKEN_SHAPE.test(token)) return null;
  const [rows] = await db.query(
    `SELECT d.id, d.business_id, d.branch_id, d.service_id, d.name,
            b.name AS organisation, COALESCE(b.short_name, b.name) AS organisation_short,
            br.name AS branch
       FROM lobby_displays d
       JOIN businesses b ON b.id = d.business_id AND b.is_active = TRUE
       JOIN branches br ON br.id = d.branch_id AND br.is_active = TRUE
      WHERE d.token = ? AND d.revoked_at IS NULL
      LIMIT 1`,
    [token]
  );
  return rows[0] || null;
}

async function buildPayload(display, db = pool) {
  const scope = display.service_id ? 'AND q.service_id = ?' : '';
  const params = display.service_id ? [display.branch_id, display.service_id] : [display.branch_id];

  const [serving] = await db.query(
    `SELECT t.ticket_number, t.status, t.called_at, s.name AS service, c.label AS counter
       FROM queue_tickets t
       JOIN queues q ON q.id = t.queue_id
       JOIN services s ON s.id = q.service_id
       LEFT JOIN counters c ON c.id = t.served_at_counter_id
      WHERE q.branch_id = ? ${scope} AND q.queue_date = CURDATE() AND q.is_active = TRUE
        AND t.status IN ('called', 'in_service')
      ORDER BY t.called_at DESC
      LIMIT ${SERVING_SHOWN}`,
    params
  );

  const [waiting] = await db.query(
    `SELECT s.id AS service_id, s.name AS service, t.ticket_number
       FROM queues q
       JOIN services s ON s.id = q.service_id
       LEFT JOIN queue_tickets t ON t.queue_id = q.id AND t.status = 'waiting'
      WHERE q.branch_id = ? ${scope} AND q.queue_date = CURDATE() AND q.is_active = TRUE
      ORDER BY s.name, t.position`,
    params
  );
  const lines = new Map();
  for (const row of waiting) {
    if (!lines.has(row.service_id)) lines.set(row.service_id, { service: row.service, waiting: 0, next: [] });
    if (!row.ticket_number) continue;
    const line = lines.get(row.service_id);
    line.waiting += 1;
    if (line.next.length < NEXT_SHOWN) line.next.push(row.ticket_number);
  }

  return {
    organisation: display.organisation_short || display.organisation,
    branch: display.branch,
    screen: display.name,
    serving: serving.map((t) => ({
      ticket: t.ticket_number,
      service: t.service,
      counter: t.counter || null,
      state: t.status === 'called' ? 'called' : 'serving',
      called_at: t.called_at ? new Date(t.called_at).toISOString() : null,
    })),
    lines: [...lines.values()],
    server_time: new Date().toISOString(),
    refresh_seconds: 5,
  };
}

/** The payload for a screen's link, or null when the link is unknown or switched off. */
async function displayPayload(token, db = pool) {
  const hit = cache.get(token);
  if (hit && hit.expires > Date.now()) return hit.payload;
  const display = await findDisplay(token, db);
  if (!display) {
    cache.set(token, { payload: null, expires: Date.now() + CACHE_MS });
    return null;
  }
  const payload = await buildPayload(display, db);
  cache.set(token, { payload, expires: Date.now() + CACHE_MS });
  // Roughly when the screen was last on; never fatal, never awaited.
  db.query('UPDATE lobby_displays SET last_seen_at = NOW() WHERE id = ? AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL 1 MINUTE)', [display.id])
    .catch(() => {});
  if (cache.size > 2000) for (const [k, v] of cache) if (v.expires < Date.now()) cache.delete(k);
  return payload;
}

function forget(token) {
  if (token) cache.delete(token); else cache.clear();
}

module.exports = { displayPayload, findDisplay, buildPayload, forget, TOKEN_SHAPE, CACHE_MS };

/**
 * liveUpdates.js — keeps the ticket on the lock screen current while the app
 * is closed.
 *
 * Whenever a queue changes (a call, a service, someone leaving), every live
 * ticket in it has a new place in line. The app shows that while it is open;
 * this pushes it the rest of the time:
 *   - iOS: an ActivityKit update to the ticket's Live Activity (apnsSender.js)
 *   - Android: a silent data push the app turns into its ongoing ticket
 *     notification (mobile lib/liveTicketTask.ts)
 *
 * Changes are gathered per queue for a moment before sending, so a clerk
 * clearing three tickets in a row costs one update per customer, not three.
 * Nothing here can fail the queue change that triggered it.
 */
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { projectedWaitMinutes } = require('./etaMath');
const { sendLiveActivity, isConfigured } = require('./apnsSender');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const LIVE = new Set(['waiting', 'called', 'in_service']);
const DEBOUNCE_MS = 1500;

/**
 * The state the Live Activity and the Android notification draw. Field names
 * match LyneTicketAttributes.ContentState in the Swift widget exactly; a
 * mismatch decodes as nothing and the lock screen simply stops updating.
 */
function buildContentState(row) {
  const status = LIVE.has(row.status) ? row.status : 'ended';
  const ahead = status === 'waiting' ? Math.max(0, (Number(row.waiting_position) || 1) - 1) : 0;
  const waitMinutes = status === 'waiting'
    ? Math.max(0, Math.round(projectedWaitMinutes({ ahead, perServiceMinutes: row.service_minutes, counters: row.active_counters }) || 0))
    : 0;
  /* Position-based, so it only ever moves forward: of the people who were
     ahead when this person joined, the share who have since been dealt with. */
  const resolved = Math.max(0, Number(row.resolved_since_join) || 0);
  const aheadAtJoin = ahead + resolved;
  const progress = status === 'waiting'
    ? (aheadAtJoin > 0 ? Math.min(0.97, resolved / aheadAtJoin) : 0.97)
    : 1;
  return {
    status,
    ahead,
    waitMinutes,
    progress: Math.round(progress * 100) / 100,
    // Shown on the lock screen only once called, so they can walk straight up.
    code: status === 'called' ? row.verification_code || null : null,
  };
}

function buildApnsPayload(state, { event = 'update', ticketNumber, now = Math.floor(Date.now() / 1000) } = {}) {
  const aps = { timestamp: now, event, 'content-state': state };
  if (event === 'end') aps['dismissal-date'] = now + 5 * 60;
  else aps['stale-date'] = now + 20 * 60;
  if (event === 'update' && state.status === 'called') {
    aps.alert = { title: `${ticketNumber || 'Your ticket'}: it's your turn`, body: 'Head to the counter and show your code.' };
    aps.sound = 'default';
  }
  return { aps };
}

const LIVE_ROWS_SQL = `
  SELECT t.id, t.user_id, t.status, t.ticket_number, t.verification_code, t.position, t.joined_at,
         b.name AS branch_name,
         (SELECT COUNT(*) + 1 FROM queue_tickets t2
           WHERE t2.queue_id = t.queue_id AND t2.status = 'waiting' AND t2.position < t.position) AS waiting_position,
         (SELECT COUNT(*) FROM queue_tickets t5
           WHERE t5.queue_id = t.queue_id AND t5.position < t.position AND t5.status <> 'waiting'
             AND COALESCE(t5.completed_at, t5.started_serving_at, t5.called_at) >= t.joined_at) AS resolved_since_join,
         (SELECT COUNT(*) FROM counters c
           WHERE c.branch_id = q.branch_id AND c.service_id = q.service_id AND c.is_active = TRUE) AS active_counters,
         COALESCE((
           SELECT AVG(TIMESTAMPDIFF(MINUTE, COALESCE(t4.started_serving_at, t4.called_at, t4.joined_at), t4.completed_at))
             FROM queue_tickets t4
            WHERE t4.queue_id = t.queue_id AND t4.status = 'served' AND t4.completed_at IS NOT NULL
         ), s.base_avg_time_minutes) AS service_minutes
    FROM queue_tickets t
    JOIN queues q   ON q.id = t.queue_id
    JOIN branches b ON b.id = q.branch_id
    JOIN services s ON s.id = q.service_id
   WHERE t.queue_id = ? AND t.user_id IS NOT NULL
     AND (t.status IN ('waiting', 'called', 'in_service') OR t.id IN (?))`;

async function sendAndroidData(rows) {
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  if (!userIds.length) return;
  const [tokens] = await pool.query(
    `SELECT user_id, expo_push_token FROM device_push_tokens
      WHERE is_active = TRUE AND platform = 'android' AND user_id IN (?)`,
    [userIds]
  );
  if (!tokens.length) return;
  const byUser = new Map(rows.map((r) => [r.user_id, r]));
  const messages = tokens.map((tok) => {
    const row = byUser.get(tok.user_id);
    return {
      to: tok.expo_push_token,
      priority: 'normal',
      _contentAvailable: true,
      data: {
        type: 'live-ticket',
        ticketId: row.id,
        ticketNumber: row.ticket_number,
        branchName: row.branch_name,
        ...buildContentState(row),
      },
    };
  });
  await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  }).catch(() => {});
}

async function sendIos(rows) {
  if (!isConfigured()) return;
  const [tokens] = await pool.query(
    'SELECT id, ticket_id, push_token FROM live_activity_tokens WHERE ticket_id IN (?)',
    [rows.map((r) => r.id)]
  );
  const byTicket = new Map(rows.map((r) => [r.id, r]));
  await Promise.all(tokens.map(async (tok) => {
    const row = byTicket.get(tok.ticket_id);
    const state = buildContentState(row);
    const ended = state.status === 'ended';
    const result = await sendLiveActivity(
      tok.push_token,
      buildApnsPayload(state, { event: ended ? 'end' : 'update', ticketNumber: row.ticket_number }),
      { priority: state.status === 'called' ? 10 : 5 },
    );
    // Ended, or Apple says the activity is gone: the token is finished either way.
    if (ended || result.status === 410 || result.reason === 'BadDeviceToken') {
      await pool.query('DELETE FROM live_activity_tokens WHERE id = ?', [tok.id]).catch(() => {});
    }
  }));
}

async function refreshQueue(queueId, changedTicketIds) {
  const [rows] = await pool.query(LIVE_ROWS_SQL, [queueId, changedTicketIds.length ? changedTicketIds : ['']]);
  if (!rows.length) return;
  await Promise.all([sendIos(rows), sendAndroidData(rows)]);
}

const pending = new Map();

/** Called after any change to a queue. Never throws, never waits. */
function scheduleQueueRefresh(queueId, changedTicket) {
  if (!queueId || process.env.NODE_ENV === 'test') return;
  const entry = pending.get(queueId) || { ids: new Set(), timer: null };
  if (changedTicket?.id) entry.ids.add(changedTicket.id);
  if (!entry.timer) {
    entry.timer = setTimeout(() => {
      pending.delete(queueId);
      refreshQueue(queueId, [...entry.ids]).catch((err) => console.error('[live] refresh failed:', err.message));
    }, DEBOUNCE_MS);
    entry.timer.unref?.();
  }
  pending.set(queueId, entry);
}

async function registerLiveActivityToken({ ticketId, userId, pushToken }) {
  await pool.query(
    `INSERT INTO live_activity_tokens (id, ticket_id, user_id, push_token)
     VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE created_at = created_at`,
    [randomUUID(), ticketId, userId, pushToken]
  );
}

module.exports = { buildContentState, buildApnsPayload, scheduleQueueRefresh, registerLiveActivityToken, refreshQueue };

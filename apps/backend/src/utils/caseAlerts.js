/**
 * caseAlerts.js — telling a supervisor what is happening with a case.
 *
 * A supervisor watching a client's case hears when that person joins a line, when
 * their visit ends, and when a flag changes. A client flagged Priority or Watch
 * with nobody looking after them is told to the branch's supervisors when they
 * join, because that is the moment somebody needs to know.
 *
 * Staff bell only: nothing here ever reaches the client, whose flag may be about
 * them. Best-effort and after the commit, so an alert can never cost a person
 * their place in a line.
 */
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');

const FLAG_LABEL = { priority: 'Priority', watch: 'Watch' };
const REASON_LABEL = {
  wrong_documents: 'wrong or missing documents', wrong_service: 'in the wrong line', referred_elsewhere: 'referred elsewhere',
  system_issue: 'a system issue', day_ended: 'the day ended before it finished', customer_left: 'they left before it finished',
  branch_closed_before_called: 'the branch closed before they were called', branch_closed_after_called: 'the branch closed before they came forward',
  service_not_finalised: 'the branch closed before the visit was finished', branch_closure: 'the branch closed during the day',
};

const ordinal = (n) => { const v = n % 100; return `${n}${['th', 'st', 'nd', 'rd'][(v - 20) % 10] || ['th', 'st', 'nd', 'rd'][v] || 'th'}`; };

/** How the visit ended, in words, or null if it ended well. */
function missedOutcome(v) {
  if (v.status === 'served') return v.closed_reason && v.closed_reason !== 'transferred' ? `the visit was not finished: ${REASON_LABEL[v.closed_reason] || 'no reason given'}` : null;
  if (v.status === 'no_show') return v.closed_reason ? REASON_LABEL[v.closed_reason] || 'they did not come forward when called' : 'they did not come forward when called';
  if (v.status === 'left') return 'they left before being called';
  return v.closed_reason ? REASON_LABEL[v.closed_reason] || 'their ticket was cancelled' : 'their ticket was cancelled';
}

function joinMessage(v) {
  const where = ['kiosk', 'walk_in'].includes(v.channel) ? 'is at the branch and has joined' : v.channel === 'web' ? 'has checked in to' : 'has joined from the app, in';
  const parts = [`${v.client} ${where} the ${v.service} line at ${v.branch} (${v.ticket_number}, ${v.ahead} ahead).`];
  if (v.missed_before > 0) {
    parts.push(`This is their ${ordinal(v.missed_before + 1)} try at this service${v.last_reason ? `; last time, ${v.last_reason}` : ''}.`);
  }
  if (v.flags.length) parts.push(`Flagged ${v.flags.map((f) => `${FLAG_LABEL[f.flag] || f.flag}${f.note ? ` (${f.note})` : ''}`).join(', ')}.`);
  return parts.join(' ');
}

function endMessage(v) {
  const missed = missedOutcome(v);
  if (!missed) return `${v.client} was served at ${v.service}${v.served_by ? ` by ${v.served_by}` : ''} (${v.ticket_number}).`;
  return `${v.client} was not served${v.missed_before > 0 ? ' again' : ''} at ${v.service} (${v.ticket_number}): ${missed}.${v.missed_before > 0 ? ` That is ${v.missed_before + 1} unfinished visits for this service.` : ''}`;
}

/** Everything the messages need, from one ticket. */
async function visitFacts(ticketId) {
  const [[v]] = await pool.query(
    `SELECT t.id, t.user_id, t.status, t.closed_reason, t.channel, t.ticket_number, t.queue_id, q.service_id, q.branch_id, q.queue_date,
            s.name AS service, br.name AS branch, br.business_id, u.full_name AS client, st.full_name AS served_by,
            (SELECT COUNT(*) FROM queue_tickets x WHERE x.queue_id = t.queue_id AND x.status = 'waiting' AND x.position < t.position) AS ahead
       FROM queue_tickets t JOIN queues q ON q.id = t.queue_id JOIN services s ON s.id = q.service_id
       JOIN branches br ON br.id = q.branch_id JOIN users u ON u.id = t.user_id
       LEFT JOIN staff st ON st.id = t.served_by_staff_id
      WHERE t.id = ?`, [ticketId]);
  if (!v) return null;
  const [before] = await pool.query(
    `SELECT t.status, t.closed_reason FROM queue_tickets t JOIN queues q ON q.id = t.queue_id
      WHERE t.user_id = ? AND q.service_id = ? AND t.id <> ? AND q.queue_date >= CURDATE() - INTERVAL 90 DAY
        AND t.status IN ('served','left','cancelled','no_show')
      ORDER BY t.joined_at DESC LIMIT 50`, [v.user_id, v.service_id, ticketId]);
  const missed = before.filter((b) => missedOutcome(b));
  const [flags] = await pool.query(
    'SELECT flag, note FROM patient_flags WHERE user_id = ? AND business_id = ? AND cleared_at IS NULL', [v.user_id, v.business_id]);
  return { ...v, missed_before: missed.length, last_reason: missed[0] ? missedOutcome(missed[0]) : null, flags };
}

async function watcherOf(businessId, userId) {
  const [rows] = await pool.query(
    'SELECT supervisor_id FROM case_watches WHERE business_id = ? AND user_id = ? AND ended_at IS NULL LIMIT 1', [businessId, userId]);
  return rows[0]?.supervisor_id || null;
}

async function branchSupervisors(branchId) {
  const [rows] = await pool.query(
    `SELECT s.id FROM staff s JOIN roles r ON r.id = s.role_id
      WHERE r.name = 'supervisor' AND s.is_active = TRUE AND s.branch_id = ?`, [branchId]);
  return rows.map((r) => r.id);
}

async function tell(staffIds, ticketId, message, by = null) {
  const to = staffIds.filter((id) => id && id !== by);
  if (!to.length) return;
  await pool.query(
    `INSERT INTO notifications (id, user_id, staff_id, sent_by_staff_id, ticket_id, notification_type, channel, message, is_read, sent_at) VALUES ?`,
    [to.map((id) => [uuidv4(), null, id, by, ticketId, 'case_update', 'in_app', message, false, new Date()])]);
}

const quietly = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (err) {
    console.error('[CaseAlerts]', err.message);
    return null;
  }
};

/** A signed-in client took a place in a line. */
const visitStarted = quietly(async (ticketId) => {
  const v = await visitFacts(ticketId);
  if (!v) return;
  const watcher = await watcherOf(v.business_id, v.user_id);
  const to = watcher ? [watcher] : v.flags.length ? await branchSupervisors(v.branch_id) : [];
  await tell(to, v.id, joinMessage(v));
});

/** A client's visit ended, however it ended. Only the watcher hears. */
const visitEnded = quietly(async (ticketId) => {
  const v = await visitFacts(ticketId);
  if (!v) return;
  const watcher = await watcherOf(v.business_id, v.user_id);
  if (watcher) await tell([watcher], v.id, endMessage(v));
});

/** A flag went on or came off. Whoever changed it does not need telling. */
const flagChanged = quietly(async (businessId, userId, flag, action, staff) => {
  const watcher = await watcherOf(businessId, userId);
  if (!watcher) return;
  const [[u]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [userId]);
  await tell([watcher], null, `${staff?.full_name || 'Staff'} ${action === 'set' ? 'added' : 'cleared'} a ${FLAG_LABEL[flag] || 'case'} flag on ${u?.full_name || 'a client'}'s case.`, staff?.id || null);
});

module.exports = { visitStarted, visitEnded, flagChanged, joinMessage, endMessage, missedOutcome };

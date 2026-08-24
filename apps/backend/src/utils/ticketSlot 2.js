/**
 * ticketSlot.js — the four facts every new queue ticket needs, computed once.
 *
 * There are now three doors into the same line: the customer app (POST /tickets),
 * a kiosk clerk adding a walk-in (POST /tickets/walk-in), and checking in against
 * a scheduled session (POST /sessions/:id/check-in). They differ in who is
 * allowed through and what is recorded — but the moment somebody is through,
 * they must all produce IDENTICAL arithmetic: the same daily numbering, the same
 * counter-aware estimate, the same kind of verification code.
 *
 * Two of those doors already existed as copy-and-paste of each other, and a
 * third would have made drift inevitable. When the daily-reset rule was fixed
 * (PAY-904 → TRN-006) it had to be fixed twice; the next such fix would have
 * been missed in one place and nobody would have noticed until a customer was
 * holding a ticket whose number disagreed with the board.
 *
 * So: the rules live here, and callers own only their own admission policy.
 */
const crypto = require('crypto');
const { projectedWaitMinutes } = require('./etaMath');
const { estimateWaitMinutes } = require('./waitEstimator');

/**
 * A six-digit numeric code, read off a phone or a printed ticket and typed at
 * the counter. Digits rather than hex because it is read aloud across a desk,
 * typed on a numeric keypad, and never has to survive "is that a B or an 8".
 *
 * Six digits is 900,000 values, which is not enough to stay unique across every
 * ticket a branch will ever issue — so uniqueness is scoped to the queue (one
 * service, one day) by migration 019. Collisions inside that window are
 * retried at insert.
 */
function createVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

/**
 * Position, number, ETA and verification code for the next ticket in a queue.
 *
 * `conn` must be the caller's transaction connection, not the pool — the
 * position read has to see the caller's own uncommitted work and be serialised
 * against a concurrent join by the row lock the caller already holds.
 *
 * `waitingAhead` is how many people are actually WAITING, which the caller has
 * usually just counted for its capacity check. It is not the same as `position`
 * (which counts served and abandoned tickets too), and using position here was
 * the bug that produced frozen 245-minute estimates.
 */
async function issueTicketSlot(conn, { queueId, branchId, serviceId, prefix, avgTimeMinutes, waitingAhead }) {
  /* Ticket numbers restart each day. Scoping by queue_id ALONE assumed one queue
     row per day, which production guarantees (ensureQueuesForToday creates a
     fresh row) but the demo does not — it re-dates a fixed row, so MAX(position)
     kept climbing and a customer seventh in line was handed ticket PAY-904.
     Daily numbering is also just the universal convention: A-001 each morning. */
  const [posRows] = await conn.query(
    `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
       FROM queue_tickets
      WHERE queue_id = ? AND DATE(joined_at) = CURDATE()`,
    [queueId]
  );
  const position = posRows[0].next_pos;

  const [counterRows] = await conn.query(
    'SELECT COUNT(*) AS cnt FROM counters WHERE branch_id = ? AND service_id = ? AND is_active = TRUE',
    [branchId, serviceId]
  );

  // Prefer the model-based ETA (wait_eta_grid); fall back to a counter-aware
  // estimate — people already WAITING ahead of this ticket, split across the
  // open counters.
  const modelWait = await estimateWaitMinutes({
    branchId,
    serviceId,
    position,
    hour: new Date().getHours(),
  });
  const estimatedWait = modelWait ?? projectedWaitMinutes({
    ahead: waitingAhead,
    perServiceMinutes: avgTimeMinutes || 15,
    counters: counterRows[0].cnt,
  });

  return {
    position,
    ticketNumber: `${prefix || 'Q'}-${String(position).padStart(3, '0')}`,
    estimatedWait,
    verificationCode: createVerificationCode(),
  };
}

module.exports = { issueTicketSlot, createVerificationCode };

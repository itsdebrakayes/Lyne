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
 * A six-character code, read off a phone or a printed ticket and typed at the
 * counter.
 *
 * This was six digits, and the reasoning for digits was that a code gets read
 * aloud across a desk and should never have to survive "is that a B or an 8".
 * That argument is answered by the alphabet rather than by dropping letters:
 * 0/O, 1/I/L, 2/Z, 5/S and 8/B are simply not in it, so no two characters in
 * the set look or sound alike. What is left is 25 characters.
 *
 * The reason to change was the other side of it. Six digits is 900,000 values
 * and a generator walks that in seconds; 25^6 is 244 million — about 270 times
 * the work, for the same six boxes on screen and the same effort for the person
 * reading it out. The code is the only thing standing between a queue position
 * and whoever claims it, so a free 270-fold is worth taking.
 *
 * Still not unique across every ticket a branch will ever issue — uniqueness is
 * scoped to the queue (one service, one day) by migration 019, and collisions
 * inside that window are retried at insert.
 *
 * randomInt, not Math.random: this is a credential, and it is drawn without
 * modulo bias because the alphabet size is passed to the generator itself.
 */
const CODE_ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679';
const CODE_LENGTH = 6;

function createVerificationCode() {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return out;
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
     Daily numbering is also just the universal convention: A-001 each morning.

     The second clause is what keeps that restart honest. Scoping to CURDATE()
     alone means the count of live tickets is irrelevant to the number handed
     out, so a queue that still holds anyone from yesterday restarts at 1 ON TOP
     of them: two tickets share position 1, both are told "you're next", and
     whoever just walked in is ranked ahead of someone who waited overnight.
     waiting_position counts every waiting ticket regardless of date, so the
     allocator has to respect the same set the consumer reads.

     Nothing guarantees the queue is empty at rollover. expireStaleTickets
     clears it, but only for branches that have a closing_time recorded, only
     when TICKET_EXPIRY_ENABLED is not false, and only if the job actually ran.
     A person's place in line should not depend on a cleanup job having
     succeeded, so the ordering is made self-enforcing here instead: never issue
     a position at or below one that is still live. On a queue that WAS tidied,
     no live tickets remain, nothing matches the second clause, and numbering
     restarts at 1 exactly as before. */
  const [posRows] = await conn.query(
    `SELECT COALESCE(MAX(position), 0) + 1 AS next_pos
       FROM queue_tickets
      WHERE queue_id = ?
        AND (DATE(joined_at) = CURDATE()
             OR status IN ('waiting', 'called', 'in_service'))`,
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

module.exports = {
  CODE_ALPHABET,
  CODE_LENGTH, issueTicketSlot, createVerificationCode };

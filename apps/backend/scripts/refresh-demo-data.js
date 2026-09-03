#!/usr/bin/env node

/**
 * Refreshes the demo branch's living sandbox data.
 *
 * This keeps today's queues, waiting tickets, timers, assignments, analytics,
 * and predictions populated without requiring a Docker volume reset.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/* Load the environment BEFORE anything that reads it at module scope.
   `src/db/pool` calls mysql.createPool() the moment it is required, reading
   MYSQL_USER/PASSWORD there and then. It used to be required on the line above
   these two, so the pool was built from an empty environment and connected as
   root with no password — the documented command in README.demo.md failed with
   "Access denied for user 'root'@... (using password: NO)" every time, on a
   clean checkout, for everybody. Keep the pool require below this block. */
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

const pool = require('../src/db/pool');

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to refresh demo data while NODE_ENV=production.');
  process.exit(1);
}

function splitStatements(sql) {
  const statements = [];
  let current = '';
  let quote = null;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (!quote && char === '-' && next === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      current += '\n';
      continue;
    }

    if (!quote && char === '/' && next === '*') {
      i += 2;
      while (i < sql.length && !(sql[i] === '*' && sql[i + 1] === '/')) i += 1;
      i += 1;
      current += '\n';
      continue;
    }

    if ((char === '\'' || char === '"') && sql[i - 1] !== '\\') {
      quote = quote === char ? null : quote || char;
    }

    if (!quote && char === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      continue;
    }

    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

// Run from the repo the path is relative to the script; run inside the API
// container only the app directory is copied in, so the seed is bind-mounted
// and its location comes from the environment.
const SEED_PATH = process.env.DEMO_SEED_PATH
  || path.resolve(__dirname, '../../../database/demo_active_seed.sql');
const CREDIT_UNION_SEED_PATH = process.env.DEMO_CREDIT_UNION_SEED_PATH
  || path.resolve(__dirname, '../../../database/demo_credit_union_seed.sql');
/* The sector accounts — Traffic Court, UWI, UTech, First Heritage. These were
   seeded once and then left out of the daily roll-over, so their queues kept
   the date they were first written and every service under them read "not open
   right now" from the next morning onwards. Four of the eight demo businesses
   were dead on any day but the day they were seeded, and they are precisely the
   ones the sector pivot demos. */
const SECTOR_SEED_PATH = process.env.DEMO_SECTOR_SEED_PATH
  || path.resolve(__dirname, '../../../database/demo_sector_seed.sql');

/* Seed-authored tickets on today's queues, and nothing else.
 *
 * The seeds re-date a fixed set of queue rows rather than creating a new row
 * each morning, so a queue carries whatever was written into it before. Two
 * seed generations then coexist in one line: 298 ticket numbers appeared twice,
 * and 158 slots in First Heritage alone had two live tickets claiming the same
 * position — the staff list showed LDR-001 twice, one in service and one still
 * waiting.
 *
 * Deleting by id shape rather than by "everything on this queue" is the whole
 * point. Seeds mint readable ids (t-, tsec-, pt-); the API mints UUIDs. Anything
 * UUID-shaped was created by a real person going through the product — a test
 * account holding a place, a walk-in issued at a kiosk — and a demo refresh has
 * no business deleting it.
 *
 * queue_events, ticket_ratings, visit_history and wait_time_records cascade;
 * notifications and session_registrations null out. That is correct here: these
 * rows are being replaced by the same seed a moment later, and leaving the old
 * history attached to a ticket number that now belongs to somebody else is how
 * the analytics got double-counted in the first place.
 */
const UUID_SHAPED = '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

async function clearSeedTickets(connection) {
  const [result] = await connection.query(
    /* served_by_staff_id is only ever written by a real desk action, so a row
       carrying one is no longer seed data no matter what its id looks like. It
       stays. Without this, a clerk's completed visit was deleted two hours
       later and re-created as 'in_service' — the work saved correctly and then
       vanished, which reads as the product forgetting. */
    `DELETE t FROM queue_tickets t
       JOIN queues q ON q.id = t.queue_id
      WHERE q.queue_date = CURDATE()
        AND t.id NOT REGEXP ?
        AND t.served_by_staff_id IS NULL`,
    [UUID_SHAPED]
  );
  return result.affectedRows || 0;
}

/**
 * Absorb a runtime-created queue into the seed's own row for the same line.
 *
 * The seeds re-date a fixed set of queue rows onto CURDATE() rather than
 * opening a new line each morning. That is fine until somebody uses the product
 * before the day's first refresh: the API finds no queue open for that
 * branch+service today and correctly opens one, with a UUID id. The refresh then
 * tries to move its own row onto the same day and hits uk_queue_day
 * (branch, service, date) — one line per service per day, which is right.
 *
 * ON DUPLICATE KEY UPDATE cannot absorb it, for the same reason documented in
 * sync-demo-test-accounts.js: the incoming row matches the PRIMARY key of the
 * seed's stale row first, and it is the resulting UPDATE that collides. So the
 * whole refresh aborted — which is how it was found. A session check-in opened
 * a court line at 11:40, and every refresh after that failed with a duplicate
 * key on a date nobody had typed.
 *
 * Deleting either row is wrong. The runtime row holds real tickets — somebody
 * actually joined that line. The seed row's id is referenced literally in
 * seed.sql and demo_credit_union_seed.sql, so dropping it breaks those inserts.
 * Merge instead: move the real tickets onto the seed's id, drop the now-empty
 * runtime row, and let the seed have its line back. Nothing a person did is
 * lost and the day ends with exactly one queue per service, as the key intends.
 *
 * The tickets move before the delete, not after: queue_tickets cascades on
 * queue delete, so the other order silently destroys the very rows this exists
 * to protect.
 */
async function absorbRuntimeQueues(connection) {
  const [pairs] = await connection.query(
    `SELECT live.id AS liveId,
            (SELECT seed.id
               FROM queues seed
              WHERE seed.branch_id = live.branch_id
                AND seed.service_id = live.service_id
                AND seed.id <> live.id
                AND seed.id NOT REGEXP ?
                AND seed.queue_date <> CURDATE()
              ORDER BY seed.queue_date DESC
              LIMIT 1) AS seedId
       FROM queues live
      WHERE live.queue_date = CURDATE()
        AND live.id REGEXP ?`,
    [UUID_SHAPED, UUID_SHAPED]
  );

  let absorbed = 0;
  for (const { liveId, seedId } of pairs) {
    // No seed row for this line — the API opened a service the seeds never
    // cover. Nothing to collide with, so leave it exactly where it is.
    if (!seedId) continue;

    /* verification_code is unique per queue, so a seeded code could in
       principle already occupy an arriving one. Yield to the real ticket: the
       seed rewrites its own a moment later, and a person holding a code they
       were shown must keep it. */
    await connection.query(
      `DELETE seeded FROM queue_tickets seeded
         JOIN queue_tickets arriving
           ON arriving.verification_code = seeded.verification_code
        WHERE seeded.queue_id = ?
          AND arriving.queue_id = ?
          AND seeded.id NOT REGEXP ?`,
      [seedId, liveId, UUID_SHAPED]
    );

    await connection.query('UPDATE queue_tickets SET queue_id = ? WHERE queue_id = ?', [seedId, liveId]);
    await connection.query('DELETE FROM queues WHERE id = ?', [liveId]);
    await connection.query(
      'UPDATE queues SET queue_date = CURDATE(), is_active = TRUE WHERE id = ?',
      [seedId]
    );
    absorbed += 1;
  }

  return absorbed;
}

/**
 * Put the rostered staff on shift.
 *
 * Attendance became real today: a window counts as open when the person on it
 * has clocked in and is not on a break. That is the right rule, and it meant a
 * demo box read "0 of 12 windows open" at every branch, because the seed
 * rosters people onto counters and nobody had ever pressed Clock In.
 *
 * So the demo day starts with its staff present, the way a branch does at
 * opening. Anyone who has clocked themselves in or out since is left alone —
 * the point of the feature is that the person decides, and a re-seed that
 * clocked somebody back in after they went home would be the seeder overruling
 * a human again.
 */
async function openShiftsForRosteredStaff(connection) {
  const [result] = await connection.query(
    `INSERT INTO staff_shifts (id, staff_id, branch_id, counter_id, clocked_in_at)
     SELECT UUID(), sa.staff_id, s.branch_id, sa.counter_id,
            /* Opening time rather than now, so the shift length on screen is a
               morning's work and not four seconds. */
            TIMESTAMP(CURDATE(), '08:30:00')
       FROM staff_assignments sa
       JOIN staff s ON s.id = sa.staff_id AND s.is_active = TRUE
      WHERE sa.assignment_date = CURDATE()
        AND NOT EXISTS (
          SELECT 1 FROM staff_shifts sh
           WHERE sh.staff_id = sa.staff_id
             AND sh.clocked_in_at >= TIMESTAMP(CURDATE(), '00:00:00')
        )`
  );
  return result.affectedRows || 0;
}

async function refreshDemoData(connection = pool) {
  const seedPaths = [SEED_PATH, CREDIT_UNION_SEED_PATH, SECTOR_SEED_PATH]
    .filter(seedPath => fs.existsSync(seedPath));
  const stranded = await closeOutStrandedTickets(connection);
  if (stranded) console.log(`Closed out ${stranded} ticket(s) stranded from a previous day.`);
  const cleared = await clearSeedTickets(connection);
  if (cleared) console.log(`Cleared ${cleared} seed-authored ticket(s) before reseeding.`);
  const absorbed = await absorbRuntimeQueues(connection);
  if (absorbed) console.log(`Absorbed ${absorbed} live-opened queue(s) into the seed's own line.`);
  const onShift = await openShiftsForRosteredStaff(connection);
  if (onShift) console.log(`Clocked in ${onShift} rostered staff for today.`);
  const statements = seedPaths.flatMap(seedPath => splitStatements(fs.readFileSync(seedPath, 'utf8')));

  for (const statement of statements) {
    await connection.query(statement);
  }

  await normaliseHistoryPositions(connection);
  await enforceOneLiveTicketPerPerson(connection);
  await clearRevivedTicketResidue(connection);

  return statements.length;
}

/**
 * A live ticket may not carry the remains of a finished one.
 *
 * The seeds now clear this themselves on re-seed, so nothing new arrives in
 * this state. This exists for the boxes that already have it: 460 tickets sat
 * `waiting` while holding a completed_at three days older than their own
 * joined_at, and a closed_reason from a sweep that had genuinely closed them
 * before a re-seed flipped the status back.
 *
 * Two things came out of that, and both were visible to staff. Every average
 * that touched those rows was poisoned by a negative wait. And on the counter
 * screen a called customer showed the previous occupant's timings — the "stale
 * prior information" the line staff reported.
 *
 * A ticket that is waiting, called or in service has not completed and has not
 * been closed. `called` additionally needs an expiry, or the no-show countdown
 * has nothing to count to and renders empty; it is derived from called_at and
 * the ticket's own timeout so a revived row gets a timer that means something.
 */
async function clearRevivedTicketResidue(connection) {
  const [cleared] = await connection.query(
    `UPDATE queue_tickets
        SET completed_at = NULL,
            closed_reason = NULL
      WHERE status IN ('waiting', 'called', 'in_service')
        AND (completed_at IS NOT NULL OR closed_reason IS NOT NULL)`
  );
  if (cleared.affectedRows) {
    console.log(`Cleared completion residue from ${cleared.affectedRows} live ticket(s).`);
  }

  const [expiries] = await connection.query(
    `UPDATE queue_tickets
        SET called_at = COALESCE(called_at, NOW()),
            call_expires_at = DATE_ADD(COALESCE(called_at, NOW()),
                                       INTERVAL COALESCE(call_timeout_seconds, 120) SECOND)
      WHERE status = 'called'
        AND call_expires_at IS NULL`
  );
  if (expiries.affectedRows) {
    console.log(`Gave ${expiries.affectedRows} called ticket(s) a no-show expiry.`);
  }
}

/**
 * One live ticket per person, which is the rule the product itself enforces.
 *
 * POST /api/tickets refuses to put somebody in a second line while they are
 * still standing in the first — "You are already in line (MEM-004)". The seeds
 * write rows directly and never meet that check, so a pool of ten demo
 * customers was spread across every queue in the country: usr-demo-04 held 29
 * live tickets at once. Nobody can sign in as those accounts, so it was never
 * visible in the app, but it is data that contradicts a rule the same database
 * enforces a few tables away — and the integrity checker is right to fail on
 * it rather than be taught to ignore it.
 *
 * The earliest ticket keeps the person; the rest become walk-ins. Deliberately
 * NOT deleted: those rows are what make a line look like a line, and the demo
 * needs the queue depth. `channel` is left alone, so the app-versus-walk-in mix
 * the seeds construct for the channel card survives — a ticket with no user_id
 * is exactly how a guest join is already stored.
 */
async function enforceOneLiveTicketPerPerson(connection) {
  const [result] = await connection.query(`
    UPDATE queue_tickets tgt
    JOIN (
      SELECT id FROM (
        /* ROW_NUMBER, not MIN(joined_at). The seeds stamp arrival times from
           NOW() minus a whole number of minutes, so two of a person's tickets
           routinely land on the identical second — and "later than the earliest"
           then excludes neither of them. Ranking with id as the tie-break leaves
           exactly one row per person however the timestamps fall. */
        SELECT t.id,
               ROW_NUMBER() OVER (PARTITION BY t.user_id ORDER BY t.joined_at, t.id) AS rn
          FROM queue_tickets t
         WHERE t.status IN ('waiting','called','in_service')
           AND t.user_id IS NOT NULL
      ) ranked WHERE ranked.rn > 1
    ) extra ON extra.id = tgt.id
    SET tgt.user_id = NULL
  `);
  const freed = result.affectedRows || 0;
  if (freed) console.log(`Released ${freed} duplicate live ticket(s) to walk-in.`);
  return freed;
}


/**
 * Close out anyone left standing in a line the refresh is about to re-date.
 *
 * The seeds re-date a fixed set of queue rows rather than opening a new one
 * each morning, so a queue whose date moves forward drags yesterday's live
 * tickets into today with it. Their joined_at still says yesterday; their
 * queue_date now says today. They are live, so they hold positions, feed
 * waiting_position, and inflate every ETA on that line.
 *
 * expireStaleTickets cannot help, and the reason is worth stating: it expires
 * a ticket sixty minutes after ITS QUEUE'S closing time. Once the row is
 * re-dated to today, that moment is tonight — and for the four tenants whose
 * closing_time is the 23:59:59 placeholder, it is 00:59:59 TOMORROW. So the
 * stragglers survive an entire business day, which is exactly the fault the
 * daily sweep exists to prevent, arriving by a different road.
 *
 * They are closed the same way the sweep closes them — cancelled, with a reason
 * — so the history stays honest rather than the rows being deleted.
 */
async function closeOutStrandedTickets(connection) {
  const [result] = await connection.query(
    `UPDATE queue_tickets
        SET status = 'cancelled',
            closed_reason = 'branch_closed_before_called',
            completed_at = COALESCE(completed_at, joined_at)
      WHERE status IN ('waiting', 'called', 'in_service')
        AND DATE(joined_at) < CURDATE()`
  );
  return result.affectedRows || 0;
}

/**
 * Pull the seeds' reserved position bands back into the real sequence.
 *
 * Both seeds park served history in bands well clear of the live tickets — the
 * credit-union file writes 101, 102, 103 by hand and the active file generates
 * 900 + n — so that history cannot collide with the people still in line. It
 * works for that, and it breaks the thing downstream of it: the allocator hands
 * out MAX(position) + 1 over today's tickets, and history counts, so a customer
 * joining a nine-person line was issued MEM-904. That is the exact symptom the
 * comment in utils/ticketSlot.js was written about, and it survived the
 * CURDATE() scoping because the seeds date this history to today on purpose —
 * it is what makes "served today" mean anything on the dashboards.
 *
 * Renumbering after the fact fixes it without touching either seed's authored
 * rows. History is stacked immediately above whoever is still live, in the
 * order it was served, so the sequence reads continuously and the next real
 * join gets a number a human would expect. The positions of served tickets
 * carry no meaning of their own — nobody is standing in them — so moving them
 * costs nothing.
 */
async function normaliseHistoryPositions(connection) {
  const [result] = await connection.query(`
    UPDATE queue_tickets tgt
    JOIN (
      SELECT t.id,
             COALESCE(live.live_max, 0)
               + ROW_NUMBER() OVER (PARTITION BY t.queue_id ORDER BY t.joined_at, t.id) AS new_pos
        FROM queue_tickets t
        JOIN queues q ON q.id = t.queue_id
        LEFT JOIN (
          SELECT queue_id, MAX(position) AS live_max
            FROM queue_tickets
           WHERE status IN ('waiting', 'called', 'in_service')
           GROUP BY queue_id
        ) live ON live.queue_id = t.queue_id
       WHERE q.queue_date = CURDATE()
         AND t.status NOT IN ('waiting', 'called', 'in_service')
         AND t.position >= 100
    ) ren ON ren.id = tgt.id
    SET tgt.position = ren.new_pos
  `);
  const moved = result.affectedRows || 0;
  if (moved) console.log(`Pulled ${moved} history ticket(s) out of the reserved position bands.`);
  return moved;
}

if (require.main === module) {
  refreshDemoData()
    .then(async (count) => {
      console.log(`Refreshed demo data with ${count} SQL statements.`);
      await pool.end();
    })
    .catch(async (error) => {
      if (Array.isArray(error.errors) && error.errors.length) {
        console.error(error.errors.map((item) => item.stack || item.message || String(item)).join('\n'));
      } else {
        console.error(error.stack || error.message || String(error));
      }
      await pool.end();
      process.exit(1);
    });
}

module.exports = { refreshDemoData, clearSeedTickets, normaliseHistoryPositions, enforceOneLiveTicketPerPerson, closeOutStrandedTickets };

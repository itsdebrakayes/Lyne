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
    `DELETE t FROM queue_tickets t
       JOIN queues q ON q.id = t.queue_id
      WHERE q.queue_date = CURDATE()
        AND t.id NOT REGEXP ?`,
    [UUID_SHAPED]
  );
  return result.affectedRows || 0;
}

async function refreshDemoData(connection = pool) {
  const seedPaths = [SEED_PATH, CREDIT_UNION_SEED_PATH, SECTOR_SEED_PATH]
    .filter(seedPath => fs.existsSync(seedPath));
  const cleared = await clearSeedTickets(connection);
  if (cleared) console.log(`Cleared ${cleared} seed-authored ticket(s) before reseeding.`);
  const statements = seedPaths.flatMap(seedPath => splitStatements(fs.readFileSync(seedPath, 'utf8')));

  for (const statement of statements) {
    await connection.query(statement);
  }

  return statements.length;
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

module.exports = { refreshDemoData, clearSeedTickets };

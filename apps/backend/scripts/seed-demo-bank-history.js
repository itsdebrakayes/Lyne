#!/usr/bin/env node
/**
 * seed-demo-bank-history.js — 90 days of ordinary traffic at Lignum Bank. DEMO ONLY.
 *
 *   ALLOW_DEMO_BANK_HISTORY=true MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 node scripts/seed-demo-bank-history.js
 *
 * Run after database/demo_bank_seed.sql. The SQL seed builds the bank, today's
 * lines and the registered clients behind Client Cases; this builds the volume
 * every pattern screen needs and the SQL seed cannot: busy times by hour and
 * weekday, the manager's "through the day", the executive's branch comparison,
 * and the history the forecasting models learn from. Those screens read
 * wait_time_records, which the system writes as each visit ends and which must
 * point at a real ticket, so this writes both, the way the hospital demo
 * (seed-demo-healthcare.js) does.
 *
 * Shaped like a Jamaican retail bank: weekdays only, busier late morning and at
 * lunch, Fridays and Mondays heavier, and peaks on payday (the 25th) and the
 * last two working days of the month. Half Way Tree is the flagship and stays
 * open to 4. Walk-ins are guests (no account), as most are.
 *
 * Deterministic for a given day. Re-running replaces everything it wrote (every
 * id starts with "lgbv-"). Today gets the visits that would already have
 * finished by now, so the Today cards (served by hour, where the queue leaks,
 * staff seen) have a morning behind them. They join the SQL seed's lines for
 * today and are numbered from 500 so they never collide with its tickets.
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run: NODE_ENV=production. Demo database only.');
  process.exit(1);
}
if (process.env.ALLOW_DEMO_BANK_HISTORY !== 'true') {
  console.error('Set ALLOW_DEMO_BANK_HISTORY=true to confirm this is the demo database.');
  process.exit(1);
}

const pool = require('../src/db/pool');

const DAYS = 90;
const BIZ = 'biz-lgb-001';

function mulberry32(seed) {
  return function rand() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Daily arrivals on an ordinary weekday, per desk, and who serves there. */
const DESKS = [
  { branch: 'br-lgb-hwt', service: 'svc-lgb-teller', prefix: 'TEL', daily: 140, mins: 5,  staff: [['stf-review-demo-ln1', 'ctr-lgb-hwt-tel-1'], ['stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-2'], ['stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-3']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-acct',   prefix: 'ACC', daily: 18,  mins: 32, staff: [['stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct'], ['stf-review-demo-ln2', 'ctr-lgb-hwt-acct']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-card',   prefix: 'CRD', daily: 22,  mins: 12, staff: [['stf-lgb-hwt-card', 'ctr-lgb-hwt-card']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-loan',   prefix: 'LON', daily: 8,   mins: 38, staff: [['stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-enq',    prefix: 'ENQ', daily: 25,  mins: 14, staff: [['stf-lgb-hwt-pbo', 'ctr-lgb-hwt-enq']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-teller', prefix: 'TEL', daily: 95,  mins: 5,  staff: [['stf-review-demo-ln3', 'ctr-lgb-nkg-tel-1'], ['stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-2']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-acct',   prefix: 'ACC', daily: 10,  mins: 32, staff: [['stf-lgb-nkg-pbo', 'ctr-lgb-nkg-acct']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-loan',   prefix: 'LON', daily: 5,   mins: 38, staff: [['stf-lgb-nkg-lend', 'ctr-lgb-nkg-loan']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-biz',    prefix: 'BIZ', daily: 20,  mins: 18, staff: [['stf-lgb-nkg-biz', 'ctr-lgb-nkg-biz']] },
  { branch: 'br-lgb-mob', service: 'svc-lgb-teller', prefix: 'TEL', daily: 45,  mins: 5,  staff: [['stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1']] },
  { branch: 'br-lgb-mob', service: 'svc-lgb-acct',   prefix: 'ACC', daily: 6,   mins: 32, staff: [['stf-lgb-mob-pbo', 'ctr-lgb-mob-acct']] },
];

/* Share of the day's arrivals by opening hour. Lunch is the peak. */
const HOURS_STD  = { 8: 0.07, 9: 0.13, 10: 0.17, 11: 0.19, 12: 0.22, 13: 0.15, 14: 0.07 };
const HOURS_HWT  = { 8: 0.06, 9: 0.11, 10: 0.15, 11: 0.17, 12: 0.2, 13: 0.14, 14: 0.1, 15: 0.07 };

function dayFactor(d) {
  const dow = d.getDay();
  let f = dow === 5 ? 1.25 : dow === 1 ? 1.15 : 1;
  const dom = d.getDate();
  if (dom >= 24 && dom <= 26) f *= 1.8;                       // payday
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (dom >= last - 2) f *= 1.6;                              // month-end
  return f;
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dt = (d) => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const ALPH = 'ACDEFGHJKMNPQRTUVWXY34679';

async function insertMany(conn, table, cols, rows, chunk = 800) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    await conn.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ?`, [part]);
  }
}

async function main() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rand = mulberry32(Number(ymd(today).replace(/-/g, '')));
  const conn = await pool.getConnection();
  try {
    const [[biz]] = await conn.query('SELECT id FROM businesses WHERE id = ?', [BIZ]);
    if (!biz) throw new Error('Lignum Bank is not in this database. Load database/demo_bank_seed.sql first.');

    await conn.beginTransaction();
    await conn.query("DELETE FROM wait_time_records WHERE ticket_id LIKE 'lgbv-%'");
    await conn.query("DELETE FROM queue_tickets WHERE id LIKE 'lgbv-%'");
    await conn.query("DELETE FROM queues WHERE id LIKE 'lgbv-%' AND NOT EXISTS (SELECT 1 FROM queue_tickets x WHERE x.queue_id = queues.id)");

    const queues = []; const tickets = []; const waits = [];
    let n = 0;
    const now = new Date();
    for (let back = DAYS; back >= 0; back -= 1) {
      const day = new Date(today); day.setDate(day.getDate() - back);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;
      const factor = dayFactor(day);

      for (const desk of DESKS) {
        // Reuse a line that already exists for this desk and day (the client
        // history in the SQL seed, or one the server opened); else make one.
        const [[existing]] = await conn.query(
          'SELECT id FROM queues WHERE branch_id = ? AND service_id = ? AND queue_date = ?',
          [desk.branch, desk.service, ymd(day)]
        );
        let queueId = existing?.id;
        if (!queueId) {
          queueId = `lgbv-q-${desk.branch.slice(7)}-${desk.service.slice(8)}-${ymd(day).replace(/-/g, '')}`;
          queues.push([queueId, desk.branch, desk.service, ymd(day), 400, 0]);
        }

        const hours = desk.branch === 'br-lgb-hwt' ? HOURS_HWT : HOURS_STD;
        const total = Math.round(desk.daily * factor * (0.85 + rand() * 0.3));
        let pos = 0;
        const codes = new Set();
        for (const [hourStr, share] of Object.entries(hours)) {
          const hour = Number(hourStr);
          const arrivals = Math.round(total * share);
          // Waits grow with how busy that hour is against the desk's capacity.
          const load = (arrivals * desk.mins) / (60 * desk.staff.length);
          for (let i = 0; i < arrivals; i += 1) {
            n += 1; pos += 1;
            const minute = hour === 8 ? 30 + Math.floor(rand() * 30) : Math.floor(rand() * 60);
            const joined = new Date(day); joined.setHours(hour, minute, Math.floor(rand() * 60), 0);
            const wait = Math.max(1, Math.round(load * 9 * (0.6 + rand() * 0.9) + rand() * 4));
            const svcMin = Math.max(2, Math.round(desk.mins * (0.7 + rand() * 0.7)));
            const r = rand();
            const status = r < 0.05 ? 'no_show' : r < 0.08 ? 'left' : 'served';
            const [staff, counter] = desk.staff[Math.floor(rand() * desk.staff.length)];
            const called = new Date(joined.getTime() + wait * 60000);
            const started = status === 'no_show' ? null : new Date(called.getTime() + 60000);
            const done = new Date(called.getTime() + (status === 'served' ? svcMin + 1 : status === 'left' ? 3 : 5) * 60000);
            // Today: only what would already be over. The rest is the live line.
            if (back === 0 && done > now) continue;
            const c = rand();
            const channel = c < 0.35 ? 'app' : c < 0.8 ? 'walk_in' : 'kiosk';
            let code;
            do { code = Array.from({ length: 6 }, () => ALPH[Math.floor(rand() * ALPH.length)]).join(''); } while (codes.has(code));
            codes.add(code);
            const id = `lgbv-${ymd(day).replace(/-/g, '')}-${n}`;
            tickets.push([id, queueId, null, `${desk.prefix}-${String(back === 0 ? 500 + pos : pos).padStart(3, '0')}`,
              code, 3000 + pos, status, wait, dt(joined), dt(called), started ? dt(started) : null, dt(done), channel,
              status === 'no_show' ? null : staff, status === 'no_show' ? null : counter,
              status === 'left' ? 'customer_left' : null]);
            waits.push([id, id, BIZ, desk.branch, desk.service, ymd(day), dow, hour, day.getMonth() + 1,
              wait, status === 'served' ? svcMin : null, status, channel, desk.staff.length,
              Math.max(0, Math.round(load * 3 + rand() * 4)), desk.staff.length]);
          }
        }
      }
    }

    await insertMany(conn, 'queues', ['id', 'branch_id', 'service_id', 'queue_date', 'max_capacity', 'is_active'], queues);
    await insertMany(conn, 'queue_tickets',
      ['id', 'queue_id', 'user_id', 'ticket_number', 'verification_code', 'position', 'status', 'estimated_wait_minutes',
       'joined_at', 'called_at', 'started_serving_at', 'completed_at', 'channel', 'served_by_staff_id',
       'served_at_counter_id', 'closed_reason'], tickets);
    await insertMany(conn, 'wait_time_records',
      ['id', 'ticket_id', 'business_id', 'branch_id', 'service_id', 'visit_date', 'day_of_week', 'hour_of_day',
       'month_of_year', 'wait_time_minutes', 'service_time_minutes', 'status', 'channel', 'staff_count_at_time',
       'queue_length_at_time', 'active_counters_at_time'], waits);
    await conn.commit();
    console.log(`Lignum Bank: ${tickets.length} visits over the last ${DAYS} days (${queues.length} new lines).`);
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Nothing was changed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end().catch(() => {});
  }
}

main();

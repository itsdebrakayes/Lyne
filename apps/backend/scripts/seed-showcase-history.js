#!/usr/bin/env node
/**
 * seed-showcase-history.js — writes the SQL for Lignum Bank's past visits.
 *
 *   node scripts/seed-showcase-history.js > lignum-history.sql
 *
 * Lignum Bank is a fictional showcase organisation in the live app. On the
 * owner's say-so (November 2026) it also carries invented past visits, so its
 * dashboards, Busy Times, forecasts and reports have something to show when the
 * bank is demonstrated on production.
 *
 * Unlike the demo seeds this may run on production, because everything in it is
 * invented and stays inside Lignum:
 *   - staff rows with NO login: supabase_uid and password_hash stay empty, and
 *     staff can only sign in through supabase_uid, so nobody can sign in as one;
 *   - walk-in visits with no account and no name, so there are no people;
 *   - every visit id starts "lgbv-", and every staff id "stf-lgb-".
 *
 * It connects to nothing: it prints SQL, which is loaded as one transaction.
 * Rerunning replaces every "lgbv-" row, so running it again the day before a demo
 * brings the history up to yesterday. Today is left alone: it belongs to the live
 * lines. A line the server already opened for a past day is reused rather than
 * duplicated.
 *
 * Afterwards rebuild the daily rollup for Lignum:
 *   refreshAnalyticsSummaries(92, { businessId: 'biz-lgb-001' })
 */
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

const STAFF = [
  ['stf-lgb-exec', null, 'role-exec-001', 'LGB-EX1', 'Lorraine Gordon', 'lorraine', null],
  ['stf-lgb-hwt-mgr', 'br-lgb-hwt', 'role-mgr-001', 'LGB-BM1', 'Dwayne Pottinger', 'dwayne', null],
  ['stf-lgb-hwt-sup', 'br-lgb-hwt', 'role-supervisor-001', 'LGB-SV1', 'Kimberley Hylton', 'kimberley', null],
  ['stf-lgb-hwt-tel1', 'br-lgb-hwt', 'role-staff-001', 'LGB-T01', 'Shauna Edwards', 'shauna', 'svc-lgb-teller'],
  ['stf-lgb-hwt-tel2', 'br-lgb-hwt', 'role-staff-001', 'LGB-T02', 'Omar Francis', 'omar', 'svc-lgb-teller'],
  ['stf-lgb-hwt-tel3', 'br-lgb-hwt', 'role-staff-001', 'LGB-T03', 'Jermaine Wright', 'jermaine', 'svc-lgb-teller'],
  ['stf-lgb-hwt-pbo', 'br-lgb-hwt', 'role-staff-001', 'LGB-P01', 'Natalie Brooks', 'natalie', 'svc-lgb-acct'],
  ['stf-lgb-hwt-pbo2', 'br-lgb-hwt', 'role-staff-001', 'LGB-P02', 'Kadian Stewart', 'kadian', 'svc-lgb-acct'],
  ['stf-lgb-hwt-lend', 'br-lgb-hwt', 'role-staff-001', 'LGB-L01', 'Christopher Lyn', 'christopher', 'svc-lgb-loan'],
  ['stf-lgb-hwt-card', 'br-lgb-hwt', 'role-staff-001', 'LGB-C01', 'Tamika Reid', 'tamika', 'svc-lgb-card'],
  ['stf-lgb-nkg-mgr', 'br-lgb-nkg', 'role-mgr-001', 'LGB-BM2', 'Paulette Grant', 'paulette', null],
  ['stf-lgb-nkg-tel1', 'br-lgb-nkg', 'role-staff-001', 'LGB-T11', 'Javon Thompson', 'javon', 'svc-lgb-teller'],
  ['stf-lgb-nkg-tel2', 'br-lgb-nkg', 'role-staff-001', 'LGB-T12', 'Kerry-Ann Campbell', 'kerryann', 'svc-lgb-teller'],
  ['stf-lgb-nkg-tel3', 'br-lgb-nkg', 'role-staff-001', 'LGB-T13', 'Dane Richards', 'dane', 'svc-lgb-teller'],
  ['stf-lgb-nkg-pbo', 'br-lgb-nkg', 'role-staff-001', 'LGB-P11', 'Sheldon Morgan', 'sheldon', 'svc-lgb-acct'],
  ['stf-lgb-nkg-biz', 'br-lgb-nkg', 'role-staff-001', 'LGB-B11', 'Renee Clarke', 'renee', 'svc-lgb-biz'],
  ['stf-lgb-nkg-lend', 'br-lgb-nkg', 'role-staff-001', 'LGB-L11', 'Garfield Bailey', 'garfield', 'svc-lgb-loan'],
  ['stf-lgb-mob-mgr', 'br-lgb-mob', 'role-mgr-001', 'LGB-BM3', 'Andrea Walters', 'andrea', null],
  ['stf-lgb-mob-tel1', 'br-lgb-mob', 'role-staff-001', 'LGB-T21', 'Ricardo Henry', 'ricardo', 'svc-lgb-teller'],
  ['stf-lgb-mob-pbo', 'br-lgb-mob', 'role-staff-001', 'LGB-P21', 'Simone Barrett', 'simone', 'svc-lgb-acct'],
];

/* Daily arrivals on an ordinary weekday, per desk, and who serves there. */
const DESKS = [
  { branch: 'br-lgb-hwt', service: 'svc-lgb-teller', prefix: 'TEL', daily: 140, mins: 5, staff: [['stf-lgb-hwt-tel3', 'ctr-lgb-hwt-tel-1'], ['stf-lgb-hwt-tel1', 'ctr-lgb-hwt-tel-2'], ['stf-lgb-hwt-tel2', 'ctr-lgb-hwt-tel-3']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-acct', prefix: 'ACC', daily: 18, mins: 32, staff: [['stf-lgb-hwt-pbo', 'ctr-lgb-hwt-acct'], ['stf-lgb-hwt-pbo2', 'ctr-lgb-hwt-acct']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-card', prefix: 'CRD', daily: 22, mins: 12, staff: [['stf-lgb-hwt-card', 'ctr-lgb-hwt-card']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-loan', prefix: 'LON', daily: 8, mins: 38, staff: [['stf-lgb-hwt-lend', 'ctr-lgb-hwt-loan']] },
  { branch: 'br-lgb-hwt', service: 'svc-lgb-enq', prefix: 'ENQ', daily: 25, mins: 14, staff: [['stf-lgb-hwt-pbo', 'ctr-lgb-hwt-enq']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-teller', prefix: 'TEL', daily: 95, mins: 5, staff: [['stf-lgb-nkg-tel3', 'ctr-lgb-nkg-tel-1'], ['stf-lgb-nkg-tel1', 'ctr-lgb-nkg-tel-2']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-acct', prefix: 'ACC', daily: 10, mins: 32, staff: [['stf-lgb-nkg-pbo', 'ctr-lgb-nkg-acct']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-loan', prefix: 'LON', daily: 5, mins: 38, staff: [['stf-lgb-nkg-lend', 'ctr-lgb-nkg-loan']] },
  { branch: 'br-lgb-nkg', service: 'svc-lgb-biz', prefix: 'BIZ', daily: 20, mins: 18, staff: [['stf-lgb-nkg-biz', 'ctr-lgb-nkg-biz']] },
  { branch: 'br-lgb-mob', service: 'svc-lgb-teller', prefix: 'TEL', daily: 45, mins: 5, staff: [['stf-lgb-mob-tel1', 'ctr-lgb-mob-tel-1']] },
  { branch: 'br-lgb-mob', service: 'svc-lgb-acct', prefix: 'ACC', daily: 6, mins: 32, staff: [['stf-lgb-mob-pbo', 'ctr-lgb-mob-acct']] },
];

/* Share of the day's arrivals by opening hour. Lunch is the peak. */
const HOURS_STD = { 8: 0.07, 9: 0.13, 10: 0.17, 11: 0.19, 12: 0.22, 13: 0.15, 14: 0.07 };
const HOURS_HWT = { 8: 0.06, 9: 0.11, 10: 0.15, 11: 0.17, 12: 0.2, 13: 0.14, 14: 0.1, 15: 0.07 };

function dayFactor(d) {
  const dow = d.getDay();
  let f = dow === 5 ? 1.25 : dow === 1 ? 1.15 : 1;
  const dom = d.getDate();
  if (dom >= 24 && dom <= 26) f *= 1.8; // payday
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  if (dom >= last - 2) f *= 1.6; // month-end
  return f;
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dt = (d) => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const ALPH = 'ACDEFGHJKMNPQRTUVWXY34679';
const sql = (v) => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const out = (s) => process.stdout.write(`${s}\n`);

function insert(table, cols, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    out(`INSERT INTO ${table} (${cols.join(', ')}) VALUES`);
    out(`${rows.slice(i, i + chunk).map((r) => `(${r.map(sql).join(',')})`).join(',\n')};`);
  }
}

function main() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rand = mulberry32(Number(ymd(today).replace(/-/g, '')));
  const queues = []; const tickets = []; const waits = [];
  let n = 0;

  for (let back = DAYS; back >= 1; back -= 1) {
    const day = new Date(today); day.setDate(day.getDate() - back);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    const factor = dayFactor(day);
    const stamp = ymd(day).replace(/-/g, '');

    for (const desk of DESKS) {
      const queueId = `lgbv-q-${desk.branch.slice(7)}-${desk.service.slice(8)}-${stamp}`;
      queues.push([queueId, desk.branch, desk.service, ymd(day), 400, 0]);
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
          const c = rand();
          const channel = c < 0.35 ? 'app' : c < 0.8 ? 'walk_in' : 'kiosk';
          let code;
          do { code = Array.from({ length: 6 }, () => ALPH[Math.floor(rand() * ALPH.length)]).join(''); } while (codes.has(code));
          codes.add(code);
          const id = `lgbv-${stamp}-${n}`;
          tickets.push([id, queueId, `${desk.prefix}-${String(pos).padStart(3, '0')}`, code, 3000 + pos, status, wait,
            dt(joined), dt(called), started ? dt(started) : null, dt(done), channel,
            status === 'no_show' ? null : staff, status === 'no_show' ? null : counter,
            status === 'left' ? 'customer_left' : null]);
          waits.push([id, id, BIZ, desk.branch, desk.service, ymd(day), dow, hour, day.getMonth() + 1,
            wait, status === 'served' ? svcMin : null, status, channel, desk.staff.length,
            Math.max(0, Math.round(load * 3 + rand() * 4)), desk.staff.length]);
        }
      }
    }
  }

  const TICKET_COLS = ['id', 'queue_id', 'ticket_number', 'verification_code', 'position', 'status', 'estimated_wait_minutes',
    'joined_at', 'called_at', 'started_serving_at', 'completed_at', 'channel', 'served_by_staff_id',
    'served_at_counter_id', 'closed_reason'];

  out('-- Generated by apps/backend/scripts/seed-showcase-history.js. Fictional. Lignum Bank only.');
  out('SET NAMES utf8mb4;');
  out('START TRANSACTION;');
  out("DELETE FROM wait_time_records WHERE ticket_id LIKE 'lgbv-%';");
  out("DELETE FROM queue_tickets WHERE id LIKE 'lgbv-%';");
  out("DELETE q FROM queues q LEFT JOIN queue_tickets t ON t.queue_id = q.id WHERE q.id LIKE 'lgbv-%' AND t.id IS NULL;");

  out(`INSERT INTO staff (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status) VALUES`);
  out(`${STAFF.map(([id, branch, role, code, name, mail, svc]) => `(${[id, BIZ, branch, role, code, name, `${mail}@lignumbank.demo`, svc].map(sql).join(',')},TRUE,'active')`).join(',\n')}`);
  out('ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), branch_id = VALUES(branch_id), assigned_service_id = VALUES(assigned_service_id);');

  // Lines are matched on branch, service and day, so one the server already
  // opened for a past day keeps its id and the visits go into it.
  out('CREATE TEMPORARY TABLE lgbv_lines (id VARCHAR(64) PRIMARY KEY, branch_id CHAR(36), service_id CHAR(36), queue_date DATE);');
  insert('lgbv_lines', ['id', 'branch_id', 'service_id', 'queue_date'], queues.map((q) => q.slice(0, 4)));
  out(`INSERT IGNORE INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
SELECT id, branch_id, service_id, queue_date, 400, 0 FROM lgbv_lines;`);
  out(`CREATE TEMPORARY TABLE lgbv_tickets (${TICKET_COLS.map((c) => (c === 'queue_id' ? 'queue_id VARCHAR(64)' : `${c} VARCHAR(64)`)).join(', ')});`);
  insert('lgbv_tickets', TICKET_COLS, tickets);
  out(`INSERT INTO queue_tickets (${TICKET_COLS.join(', ')})
SELECT ${TICKET_COLS.map((c) => (c === 'queue_id' ? 'q.id' : `t.${c}`)).join(', ')}
  FROM lgbv_tickets t
  JOIN lgbv_lines l ON l.id = t.queue_id
  JOIN queues q ON q.branch_id = l.branch_id AND q.service_id = l.service_id AND q.queue_date = l.queue_date;`);
  insert('wait_time_records',
    ['id', 'ticket_id', 'business_id', 'branch_id', 'service_id', 'visit_date', 'day_of_week', 'hour_of_day',
      'month_of_year', 'wait_time_minutes', 'service_time_minutes', 'status', 'channel', 'staff_count_at_time',
      'queue_length_at_time', 'active_counters_at_time'], waits);
  out('COMMIT;');
  process.stderr.write(`${tickets.length} visits over ${queues.length} lines, ending ${ymd(new Date(today.getTime() - 864e5))}\n`);
}

main();

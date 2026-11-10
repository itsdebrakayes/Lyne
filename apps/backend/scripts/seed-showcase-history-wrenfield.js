#!/usr/bin/env node
/**
 * seed-showcase-history-wrenfield.js — writes the SQL for Wrenfield Health's past visits.
 *
 *   node scripts/seed-showcase-history-wrenfield.js > wrenfield-history.sql
 *
 * Wrenfield Health is a fictional showcase hospital system in the live app
 * (database/showcase/wrenfield_health.sql). On the owner's say-so (9 November
 * 2026, for a hospital demonstration) it carries invented past visits, so its
 * dashboards, Busy Times, forecasts and branch reports have something to show.
 * The Lignum Bank equivalent is seed-showcase-history.js; this follows it.
 *
 * Production-safe for the same reasons:
 *   - staff rows with NO login (supabase_uid and password_hash stay empty, and
 *     staff sign in only through supabase_uid), so nobody can sign in as one;
 *   - walk-in visits with no account and no name, so there are no patients;
 *   - every visit, line, shift and sitting id starts "wfv-", every staff id
 *     "stf-wfh-". The three real demo logins (stf-wf-*) are never touched.
 *
 * Hospitals are open every day, so there are weekend visits (fewer outpatients,
 * a busier emergency department). Some patients are TRANSFERRED between
 * departments the way the desk does it (migration 049): the first visit ends as
 * served with closed_reason 'transferred', and a linked visit opens in the next
 * department, placed by when the patient first arrived.
 *
 * It connects to nothing: it prints SQL, loaded as one transaction. Rerunning
 * replaces every "wfv-" row, so running it again the day before a demo brings
 * the history up to yesterday. Today is left alone: it belongs to the live lines.
 *
 * Afterwards rebuild the daily rollup for Wrenfield:
 *   refreshAnalyticsSummaries(92, { businessId: 'wf-biz-0001' })
 */
const DAYS = 90;
const BIZ = 'wf-biz-0001';
const EMAIL_DOMAIN = 'wrenfield.example';

function mulberry32(seed) {
  return function rand() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PREFIX = { ed: 'ED', urg: 'UC', pcp: 'PC', rad: 'RAD', lab: 'LAB', rx: 'RX', ped: 'PD', vax: 'VX', mam: 'MAM', obg: 'OB', onc: 'ONC' };

/* Branch leadership, no logins. */
const LEADS = [
  ['stf-wfh-exec', null, 'role-exec-001', 'WFH-EX1', 'Margaret Okafor', 'margaret.okafor'],
  ['stf-wfh-brn-mgr', 'wf-brn-brannock', 'role-mgr-001', 'WFH-BM1', 'Daniel Whitcombe', 'daniel.whitcombe'],
  ['stf-wfh-brn-sup', 'wf-brn-brannock', 'role-supervisor-001', 'WFH-SV1', 'Priya Raman', 'priya.raman'],
  ['stf-wfh-ell-mgr', 'wf-brn-ellery', 'role-mgr-001', 'WFH-BM2', 'Celeste Moreau', 'celeste.moreau'],
  ['stf-wfh-twf-mgr', 'wf-brn-twinfords', 'role-mgr-001', 'WFH-BM3', 'Tobias Grant', 'tobias.grant'],
];

/* Daily arrivals on an ordinary weekday, minutes at the desk, and who sits where
   ([staff key, full name, counter id]). The first person works the early shift,
   the second the late one. */
const DESKS = [
  // Wrenfield Regional Hospital (Brannock), the demonstration branch
  { branch: 'wf-brn-brannock', svc: 'ed', daily: 55, mins: 12, staff: [['brn-ed1', 'Hannah Brooks', 'wf-ctr-4f7254c78dc3c7c40dfa3c71'], ['brn-ed2', 'Marcus Ellison', 'wf-ctr-b1ba3fcfc35b60be8a7f4a8a']] },
  { branch: 'wf-brn-brannock', svc: 'urg', daily: 70, mins: 16, staff: [['brn-uc1', 'Sofia Alvarez', 'wf-ctr-fce55e4007e903b89b3d3b34'], ['brn-uc2', 'Jerome Pettiford', 'wf-ctr-faf129a0648e02d00e1b55b6']] },
  { branch: 'wf-brn-brannock', svc: 'pcp', daily: 48, mins: 18, staff: [['brn-pc1', 'Naomi Feldman', 'wf-ctr-459ecbbcb23bd6c021fc0e90'], ['brn-pc2', 'Victor Osei', 'wf-ctr-870eefaf269fb945b7f06804']] },
  { branch: 'wf-brn-brannock', svc: 'rad', daily: 26, mins: 18, staff: [['brn-rad1', 'Ingrid Halvorsen', 'wf-ctr-3044b1ee445586dc6b488c2f'], ['brn-rad2', 'Samuel Achebe', 'wf-ctr-af975459620aeb0280a7ba64']] },
  { branch: 'wf-brn-brannock', svc: 'lab', daily: 80, mins: 6, staff: [['brn-lab1', 'Grace Lindqvist', 'wf-ctr-0c33a331198c3f58d0dd22d5'], ['brn-lab2', 'Omar Haddad', 'wf-ctr-8235e2888c2db87e76fbe15d']] },
  { branch: 'wf-brn-brannock', svc: 'rx', daily: 95, mins: 4, staff: [['brn-rx1', 'Lena Kowalski', 'wf-ctr-79f1c1886cec8bfcf776e75b'], ['brn-rx2', 'Andre Baptiste', 'wf-ctr-2b2330f7da4343fe68fd4e03']] },
  { branch: 'wf-brn-brannock', svc: 'ped', daily: 28, mins: 17, staff: [['brn-pd1', 'Rosa Delgado', 'wf-ctr-768c037034d7010ce3fc4e43']] },
  { branch: 'wf-brn-brannock', svc: 'vax', daily: 22, mins: 6, staff: [['brn-vx1', 'Felix Nakamura', 'wf-ctr-4a4867cb3f354ea65a7cb919']] },
  // Wrenfield Medical Center (Ellery Bay)
  { branch: 'wf-brn-ellery', svc: 'ed', daily: 45, mins: 12, staff: [['ell-ed1', 'Theo Marchetti', 'wf-ctr-5ef8fa2c36d12665603c1e08'], ['ell-ed2', 'Ruth Abernathy', 'wf-ctr-c386e28c323d8b5f60c31ade']] },
  { branch: 'wf-brn-ellery', svc: 'pcp', daily: 40, mins: 18, staff: [['ell-pc1', 'Mei Lin Zhou', 'wf-ctr-6b66e9a66213eb35b7afe1d3'], ['ell-pc2', 'Caleb Whitfield', 'wf-ctr-aab63746ca88ece7fa11a5c5']] },
  { branch: 'wf-brn-ellery', svc: 'lab', daily: 60, mins: 6, staff: [['ell-lab1', 'Adaeze Nwosu', 'wf-ctr-c55db8a5e08d707d8ba9b9b0'], ['ell-lab2', 'Peter Sandoval', 'wf-ctr-819f5cd4c1292931b58fa096']] },
  { branch: 'wf-brn-ellery', svc: 'rx', daily: 70, mins: 4, staff: [['ell-rx1', 'Hollis Carver', 'wf-ctr-c46885d27adfa75c7eec3874']] },
  { branch: 'wf-brn-ellery', svc: 'rad', daily: 22, mins: 18, staff: [['ell-rad1', 'Annika Berg', 'wf-ctr-ccafb62c95a3af886c214c21']] },
  { branch: 'wf-brn-ellery', svc: 'mam', daily: 14, mins: 15, staff: [['ell-mam1', 'Josephine Tate', 'wf-ctr-2370096c2357a8163af47d6c']] },
  { branch: 'wf-brn-ellery', svc: 'obg', daily: 18, mins: 22, staff: [['ell-ob1', 'Leila Haddadi', 'wf-ctr-0d16e25d98742049da1d68fb']] },
  { branch: 'wf-brn-ellery', svc: 'onc', daily: 10, mins: 40, staff: [['ell-onc1', 'Gordon Pryce', 'wf-ctr-74db9d674a786f0add89c0eb']] },
  { branch: 'wf-brn-ellery', svc: 'ped', daily: 24, mins: 17, staff: [['ell-pd1', 'Imani Brooks-Hale', 'wf-ctr-f068ad46a44b55e61ec4e93d']] },
  { branch: 'wf-brn-ellery', svc: 'vax', daily: 18, mins: 6, staff: [['ell-vx1', 'Ezra Holloway', 'wf-ctr-44c75231384d125085ad488f']] },
  // Wrenfield Valley Hospital (Twin Fords)
  { branch: 'wf-brn-twinfords', svc: 'ed', daily: 30, mins: 12, staff: [['twf-ed1', 'Clara Jennings', 'wf-ctr-1ef2bf8f4b9c5c54f40686ba']] },
  { branch: 'wf-brn-twinfords', svc: 'urg', daily: 40, mins: 16, staff: [['twf-uc1', 'Rafael Ortega', 'wf-ctr-9df3787a57645f858943f20e']] },
  { branch: 'wf-brn-twinfords', svc: 'pcp', daily: 28, mins: 18, staff: [['twf-pc1', 'Bethany Cole', 'wf-ctr-c5e86eaf95be6d8cde10c1d4']] },
  { branch: 'wf-brn-twinfords', svc: 'lab', daily: 35, mins: 6, staff: [['twf-lab1', 'Desmond Fairley', 'wf-ctr-aa64733d78900270135a9663']] },
  { branch: 'wf-brn-twinfords', svc: 'rx', daily: 45, mins: 4, staff: [['twf-rx1', 'Yusuf Rahman', 'wf-ctr-1cf102ef043d37935ac23a53']] },
  { branch: 'wf-brn-twinfords', svc: 'rad', daily: 12, mins: 18, staff: [['twf-rad1', 'Noelle Fontaine', 'wf-ctr-3266f7731f6799bd5464474c']] },
];

/* Where a desk sends some of the people it sees, inside the same hospital. */
const TRANSFERS = {
  urg: [['rad', 0.10], ['lab', 0.07]],
  ed: [['rad', 0.12], ['lab', 0.08]],
  pcp: [['lab', 0.12], ['rad', 0.05]],
  ped: [['vax', 0.10]],
  obg: [['lab', 0.08]],
};

/* Share of the day's arrivals by hour. Mornings are busiest for outpatients;
   urgent and emergency care stay busy into the evening. */
const HOURS_OUT = { 7: 0.06, 8: 0.11, 9: 0.13, 10: 0.13, 11: 0.12, 12: 0.09, 13: 0.09, 14: 0.09, 15: 0.08, 16: 0.06, 17: 0.04 };
const HOURS_ACUTE = { 7: 0.05, 8: 0.07, 9: 0.08, 10: 0.09, 11: 0.09, 12: 0.08, 13: 0.08, 14: 0.08, 15: 0.08, 16: 0.08, 17: 0.08, 18: 0.07, 19: 0.07 };
const ACUTE = new Set(['ed', 'urg']);
const SHIFTS_AT = { early: [[7, 0], [15, 15]], late: [[11, 45], [20, 0]], solo: [[7, 0], [18, 30]] };

function dayFactor(d, svc) {
  const dow = d.getDay();
  if (ACUTE.has(svc)) return dow === 0 || dow === 6 ? 1.15 : dow === 1 ? 1.1 : 1;
  if (dow === 0) return 0.3;
  if (dow === 6) return 0.5;
  return dow === 1 ? 1.2 : dow === 5 ? 0.9 : 1;
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dt = (d) => `${ymd(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const ALPH = 'ACDEFGHJKMNPQRTUVWXY34679';
const sql = (v) => (v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const out = (s) => process.stdout.write(`${s}\n`);
const svcId = (svc) => `wf-svc-${svc}`;
const staffId = (key) => `stf-wfh-${key}`;

function insert(table, cols, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    out(`INSERT INTO ${table} (${cols.join(', ')}) VALUES`);
    out(`${rows.slice(i, i + chunk).map((r) => `(${r.map(sql).join(',')})`).join(',\n')};`);
  }
}

/** Who is at the desk at this hour: the early or late person, or the only one. */
function onShift(desk, hour, rand) {
  if (desk.staff.length === 1) return desk.staff[0];
  const early = hour < 12; const late = hour >= 15;
  if (early) return desk.staff[0];
  if (late) return desk.staff[1];
  return desk.staff[Math.floor(rand() * 2)];
}

function main() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rand = mulberry32(Number(ymd(today).replace(/-/g, '')) ^ 0x5eed);
  const deskOf = new Map(DESKS.map((d) => [`${d.branch}|${d.svc}`, d]));
  const queues = []; const tickets = []; const waits = []; const SHIFTS = []; const SITTINGS = [];
  let n = 0; let transferCount = 0;

  for (let back = DAYS; back >= 1; back -= 1) {
    const day = new Date(today); day.setDate(day.getDate() - back);
    const dow = day.getDay();
    const stamp = ymd(day).replace(/-/g, '');
    /* Visits per desk for the day, before numbering: each {joined, ...}. */
    const byDesk = new Map(DESKS.map((d) => [d, []]));

    const visit = (desk, joined, extra = {}) => {
      n += 1;
      const hour = joined.getHours();
      const hours = ACUTE.has(desk.svc) ? HOURS_ACUTE : HOURS_OUT;
      const load = ((desk.daily * (hours[hour] || 0.04)) * desk.mins) / (60 * desk.staff.length);
      const base = Math.max(1, Math.round(load * 8 * (0.6 + rand() * 0.9) + rand() * 5));
      const wait = extra.fromId ? Math.max(1, Math.round(base * 0.5)) : base;
      const svcMin = Math.max(2, Math.round(desk.mins * (0.7 + rand() * 0.7)));
      const r = rand();
      const status = extra.fromId ? (r < 0.02 ? 'left' : 'served') : r < 0.04 ? 'no_show' : r < 0.08 ? 'left' : 'served';
      const v = { id: `wfv-${stamp}-${n}`, desk, joined, wait, svcMin, status, hour, ...extra };
      byDesk.get(desk).push(v);
      return v;
    };

    for (const desk of DESKS) {
      const hours = ACUTE.has(desk.svc) ? HOURS_ACUTE : HOURS_OUT;
      const total = Math.round(desk.daily * dayFactor(day, desk.svc) * (0.85 + rand() * 0.3));
      for (const [hourStr, share] of Object.entries(hours)) {
        const arrivals = Math.round(total * share);
        for (let i = 0; i < arrivals; i += 1) {
          const joined = new Date(day); joined.setHours(Number(hourStr), Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
          visit(desk, joined);
        }
      }
    }

    /* Transfers: some served visits continue in another department. Chains of
       two (urgent care, then radiology) are enough to show the journey. */
    for (const desk of DESKS) {
      const rules = TRANSFERS[desk.svc] || [];
      for (const v of [...byDesk.get(desk)]) {
        if (v.status !== 'served' || v.fromId) continue;
        const r = rand(); let acc = 0;
        for (const [to, share] of rules) {
          acc += share;
          if (r >= acc) continue;
          const target = deskOf.get(`${desk.branch}|${to}`);
          if (!target) break;
          const done = new Date(v.joined.getTime() + (v.wait + 1 + v.svcMin) * 60000);
          if (done.getHours() >= 21) break;
          const next = visit(target, done, { fromId: v.id, journey: v.joined });
          v.toId = next.id; v.closed = 'transferred';
          transferCount += 1;
          break;
        }
      }
    }

    for (const desk of DESKS) {
      const queueId = `wfv-q-${desk.branch.slice(7)}-${desk.svc}-${stamp}`;
      queues.push([queueId, desk.branch, svcId(desk.svc), ymd(day)]);
      const codes = new Set();
      const list = byDesk.get(desk).sort((a, b) => a.joined - b.joined);
      list.forEach((v, i) => {
        const pos = i + 1;
        const [key, , counter] = onShift(desk, v.hour, rand);
        const called = new Date(v.joined.getTime() + v.wait * 60000);
        const started = v.status === 'no_show' ? null : new Date(called.getTime() + 60000);
        const done = new Date(called.getTime() + (v.status === 'served' ? v.svcMin + 1 : v.status === 'left' ? 3 : 5) * 60000);
        const c = rand();
        const channel = v.fromId ? 'walk_in' : c < 0.4 ? 'app' : c < 0.85 ? 'walk_in' : 'kiosk';
        let code;
        do { code = Array.from({ length: 6 }, () => ALPH[Math.floor(rand() * ALPH.length)]).join(''); } while (codes.has(code));
        codes.add(code);
        const served = v.status === 'no_show' ? null : staffId(key);
        tickets.push([v.id, queueId, `${PREFIX[desk.svc]}-${String(pos).padStart(3, '0')}`, code, 3000 + pos, v.status, v.wait,
          dt(v.joined), dt(called), started ? dt(started) : null, dt(done), channel,
          served, v.status === 'no_show' ? null : counter,
          v.closed || (v.status === 'left' ? 'customer_left' : null),
          v.fromId || null, v.toId || null, v.journey ? dt(v.journey) : null]);
        waits.push([v.id, v.id, BIZ, desk.branch, svcId(desk.svc), ymd(day), dow, v.hour, day.getMonth() + 1,
          v.wait, v.status === 'served' ? v.svcMin : null, v.status, channel, desk.staff.length,
          Math.max(0, Math.round(v.wait / Math.max(1, desk.mins) * desk.staff.length)), desk.staff.length]);
      });
    }

    for (const desk of DESKS) {
      desk.staff.forEach(([key, , counter], i) => {
        const kind = desk.staff.length === 1 ? 'solo' : i === 0 ? 'early' : 'late';
        const [[h1, m1], [h2, m2]] = SHIFTS_AT[kind];
        const at = (h, m) => { const d = new Date(day); d.setHours(h, m + Math.floor(rand() * 6), 0, 0); return dt(d); };
        const id = `${stamp}-${key}`;
        const start = at(h1, m1); const end = at(h2, m2);
        const breakFrom = at(h1 + 4, 0); const breakTo = at(h1 + 4, 40);
        SHIFTS.push([`wfv-s-${id}`, staffId(key), desk.branch, counter, start, end, 2400]);
        SITTINGS.push([`wfv-a-${id}`, counter, staffId(key), `wfv-s-${id}`, start, breakFrom, 'break']);
        SITTINGS.push([`wfv-b-${id}`, counter, staffId(key), `wfv-s-${id}`, breakTo, end, 'clock_out']);
      });
    }
  }

  const TICKET_COLS = ['id', 'queue_id', 'ticket_number', 'verification_code', 'position', 'status', 'estimated_wait_minutes',
    'joined_at', 'called_at', 'started_serving_at', 'completed_at', 'channel', 'served_by_staff_id',
    'served_at_counter_id', 'closed_reason', 'transferred_from_ticket_id', 'transferred_to_ticket_id', 'journey_started_at'];
  const STAFF = [
    ...LEADS.map(([id, branch, role, code, name, mail]) => [id, branch, role, code, name, mail, null]),
    ...DESKS.flatMap((d) => d.staff.map(([key, name]) => [staffId(key), d.branch, 'role-staff-001',
      `WFH-${key.toUpperCase().replace(/-/g, '')}`, name, name.toLowerCase().replace(/[^a-z]+/g, '.'), svcId(d.svc)])),
  ];

  out('-- Generated by apps/backend/scripts/seed-showcase-history-wrenfield.js. Fictional. Wrenfield Health only.');
  out('SET NAMES utf8mb4;');
  out('START TRANSACTION;');
  out("DELETE FROM counter_sittings WHERE id LIKE 'wfv-%';");
  out("DELETE FROM staff_shifts WHERE id LIKE 'wfv-%';");
  out("DELETE FROM wait_time_records WHERE ticket_id LIKE 'wfv-%';");
  out("DELETE FROM queue_tickets WHERE id LIKE 'wfv-%';");
  out("DELETE q FROM queues q LEFT JOIN queue_tickets t ON t.queue_id = q.id WHERE q.id LIKE 'wfv-%' AND t.id IS NULL;");

  out('INSERT INTO staff (id, business_id, branch_id, role_id, staff_code, full_name, email, assigned_service_id, is_active, availability_status) VALUES');
  out(`${STAFF.map(([id, branch, role, code, name, mail, svc]) => `(${[id, BIZ, branch, role, code, name, `${mail}@${EMAIL_DOMAIN}`, svc].map(sql).join(',')},TRUE,'active')`).join(',\n')}`);
  out('ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), branch_id = VALUES(branch_id), assigned_service_id = VALUES(assigned_service_id);');

  out('CREATE TEMPORARY TABLE wfv_lines (id VARCHAR(64) PRIMARY KEY, branch_id CHAR(36), service_id CHAR(36), queue_date DATE);');
  insert('wfv_lines', ['id', 'branch_id', 'service_id', 'queue_date'], queues);
  out(`INSERT IGNORE INTO queues (id, branch_id, service_id, queue_date, max_capacity, is_active)
SELECT id, branch_id, service_id, queue_date, 400, 0 FROM wfv_lines;`);
  out(`CREATE TEMPORARY TABLE wfv_tickets (${TICKET_COLS.map((c) => (c === 'id' ? 'id VARCHAR(64) PRIMARY KEY' : `${c} VARCHAR(64)`)).join(', ')});`);
  insert('wfv_tickets', TICKET_COLS, tickets);
  out(`INSERT INTO queue_tickets (${TICKET_COLS.join(', ')})
SELECT ${TICKET_COLS.map((c) => (c === 'queue_id' ? 'q.id' : `t.${c}`)).join(', ')}
  FROM wfv_tickets t
  JOIN wfv_lines l ON l.id = t.queue_id
  JOIN queues q ON q.branch_id = l.branch_id AND q.service_id = l.service_id AND q.queue_date = l.queue_date;`);
  insert('wait_time_records',
    ['id', 'ticket_id', 'business_id', 'branch_id', 'service_id', 'visit_date', 'day_of_week', 'hour_of_day',
      'month_of_year', 'wait_time_minutes', 'service_time_minutes', 'status', 'channel', 'staff_count_at_time',
      'queue_length_at_time', 'active_counters_at_time'], waits);
  insert('staff_shifts', ['id', 'staff_id', 'branch_id', 'counter_id', 'clocked_in_at', 'clocked_out_at', 'break_seconds'], SHIFTS);
  insert('counter_sittings', ['id', 'counter_id', 'staff_id', 'shift_id', 'opened_at', 'closed_at', 'end_reason'], SITTINGS);
  out('COMMIT;');
  process.stderr.write(`${tickets.length} visits (${transferCount} transfers) over ${queues.length} lines, ${STAFF.length} staff, ending ${ymd(new Date(today.getTime() - 864e5))}\n`);
}

main();

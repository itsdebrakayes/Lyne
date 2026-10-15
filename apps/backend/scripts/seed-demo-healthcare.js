#!/usr/bin/env node
/**
 * seed-demo-healthcare.js — the Wrenfield Health hospital demo. DEMO ONLY.
 *
 *   ALLOW_DEMO_HEALTHCARE_SEED=true node scripts/seed-demo-healthcare.js
 *
 * Everything here is fictional: the health system, its three hospitals, the
 * two states they sit in (Calloway and Westmarch, "the 51st and 52nd"), the
 * streets, the staff and every patient. "Wrenfield Health" was checked against
 * real US hospitals and health systems before use. Map coordinates are in an
 * empty stretch of desert so no real town appears under them.
 *
 * It builds, relative to TODAY, so it can be re-run the morning of a demo:
 *   - the organisation, three hospitals and their departments;
 *   - triage questions and "bring with you" lists per department;
 *   - front-desk, supervisor, manager and executive staff;
 *   - ~900 patients and 90 days of visits shaped like real hospital traffic
 *     (Emergency peaks late morning to evening and on Mondays; clinics run
 *     weekday office hours; flu season is building);
 *   - frequent visitors, repeat unresolved visits and staff flags for Cases;
 *   - today's live lines, with possibly-urgent and flagged patients waiting;
 *   - flu shot clinic days patients register for.
 *
 * Deterministic: the same day gives the same data. Re-running replaces all of
 * it (every row id starts with "wf-").
 */
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo healthcare data while NODE_ENV=production.');
  process.exit(1);
}
if (process.env.ALLOW_DEMO_HEALTHCARE_SEED !== 'true') {
  console.error('Set ALLOW_DEMO_HEALTHCARE_SEED=true to confirm this demo-only step.');
  process.exit(1);
}

const pool = require('../src/db/pool');

/* ── deterministic randomness ─────────────────────────────────────────── */
function mulberry32(seed) {
  return function rand() {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261014);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + rand() * (b - a);
const chance = (p) => rand() < p;
const hid = (...parts) => crypto.createHash('md5').update(parts.join(':')).digest('hex');
const code6 = (...parts) => hid('code', ...parts).slice(0, 6).toUpperCase();

const BIZ = 'wf-biz-0001';
const pad2 = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const dt = (d) => `${ymd(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

/* ── the system ───────────────────────────────────────────────────────── */
const HOSPITALS = [
  {
    id: 'wf-brn-ellery', name: 'Wrenfield Medical Center', address: '1200 Harlan Avenue',
    city: 'Ellery Bay', state: 'Calloway (CW)', phone: '(555) 010-1200',
    lat: 39.500000, lng: -117.200000, scale: 1.0, main: true,
    depts: ['ed', 'rad', 'lab', 'rx', 'obg', 'onc', 'pcp', 'ped', 'vax', 'mam'],
  },
  {
    id: 'wf-brn-twinfords', name: 'Wrenfield Valley Hospital', address: '300 Line Street',
    city: 'Twin Fords', state: 'Calloway / Westmarch state line', phone: '(555) 010-0300',
    lat: 39.500000, lng: -116.700000, scale: 0.55, main: false,
    depts: ['ed', 'urg', 'rad', 'lab', 'rx', 'obg', 'pcp'],
  },
  {
    id: 'wf-brn-brannock', name: 'Wrenfield Regional Hospital', address: '45 Corliss Road',
    city: 'Brannock', state: 'Westmarch (WM)', phone: '(555) 010-0045',
    lat: 39.500000, lng: -116.200000, scale: 0.8, main: false,
    depts: ['ed', 'urg', 'rad', 'lab', 'rx', 'pcp', 'ped', 'vax'],
  },
];

/* Department: prefix, minutes at the desk, base daily volume at the flagship,
   wait profile, open hours, weekdays. */
const DEPTS = {
  ed:  { name: 'Emergency Department', prefix: 'ED', svc: 25, daily: 52, wait: [25, 95], hours: [0, 24], days: [0, 1, 2, 3, 4, 5, 6], counters: ['Triage 1', 'Triage 2', 'Registration 1'],
         desc: 'For serious illness or injury. If this is a life-threatening emergency, call 911.' },
  urg: { name: 'Urgent Care', prefix: 'UC', svc: 18, daily: 34, wait: [15, 60], hours: [8, 20], days: [0, 1, 2, 3, 4, 5, 6], counters: ['Desk 1', 'Desk 2'],
         desc: 'Same-day care for illnesses and minor injuries that are not emergencies.' },
  pcp: { name: 'Primary Care', prefix: 'PC', svc: 20, daily: 20, wait: [10, 35], hours: [8, 17], days: [1, 2, 3, 4, 5], counters: ['Check-In 1', 'Check-In 2'],
         desc: 'Check-ups, ongoing conditions and same-day sick visits with a primary care clinician.' },
  ped: { name: 'Pediatrics', prefix: 'PD', svc: 18, daily: 14, wait: [10, 30], hours: [8, 17], days: [1, 2, 3, 4, 5], counters: ['Check-In 1'],
         desc: 'Care for babies, children and teens.' },
  obg: { name: "Women's Health (OB/GYN)", prefix: 'OB', svc: 25, daily: 12, wait: [10, 35], hours: [8, 17], days: [1, 2, 3, 4, 5], counters: ['Check-In 1'],
         desc: 'Prenatal visits, gynecology and women’s health.' },
  rad: { name: 'Radiology & Imaging', prefix: 'RAD', svc: 20, daily: 26, wait: [15, 50], hours: [7, 19], days: [1, 2, 3, 4, 5, 6], counters: ['Imaging Desk 1', 'Imaging Desk 2'],
         desc: 'X-ray, CT, MRI and ultrasound. Most exams need an order from your clinician.' },
  lab: { name: 'Laboratory (Blood Draw)', prefix: 'LAB', svc: 7, daily: 40, wait: [8, 30], hours: [7, 19], days: [1, 2, 3, 4, 5, 6], counters: ['Draw Station 1', 'Draw Station 2', 'Draw Station 3'],
         desc: 'Blood draws and specimen drop-off. Bring your lab order.' },
  onc: { name: 'Oncology Infusion Center', prefix: 'ONC', svc: 45, daily: 8, wait: [10, 40], hours: [8, 17], days: [1, 2, 3, 4, 5], counters: ['Check-In 1'],
         desc: 'Infusion and oncology visits for patients under the care of a Wrenfield oncologist.' },
  rx:  { name: 'Outpatient Pharmacy', prefix: 'RX', svc: 5, daily: 30, wait: [5, 25], hours: [8, 20], days: [0, 1, 2, 3, 4, 5, 6], counters: ['Window 1', 'Window 2'],
         desc: 'Prescription pick-up and pharmacist questions.' },
  vax: { name: 'Vaccinations & Immunizations', prefix: 'VX', svc: 6, daily: 10, wait: [5, 20], hours: [8, 16], days: [1, 2, 3, 4, 5], counters: ['Station 1'],
         desc: 'Flu shots, COVID-19 vaccines and routine immunizations.' },
  mam: { name: 'Mammography', prefix: 'MAM', svc: 15, daily: 8, wait: [10, 30], hours: [8, 17], days: [1, 2, 3, 4, 5], counters: ['Check-In 1'],
         desc: 'Screening and diagnostic mammograms.' },
};
const svcId = (key) => `wf-svc-${key}`;

/* Triage questions. A "yes" to a red-flag question tags the patient
   "possibly urgent" for staff review; it never moves anyone by itself.
   General red flags, not clinical criteria. */
const TRIAGE = {
  ed: [
    ['Do you have chest pain or pressure?', null, true],
    ['Are you having trouble breathing?', null, true],
    ['Have you hit your head in the last 24 hours?', null, true],
    ['Did you pass out or lose consciousness?', null, true],
    ['Have you had a seizure today?', null, true],
    ['Is there bleeding that will not stop?', null, true],
    ['Sudden weakness or numbness, a drooping face, or trouble speaking?', 'Possible signs of stroke.', true],
    ['A fever of 103°F (39.4°C) or higher, or a fever for more than 3 days?', null, true],
    ['Have you tested positive for COVID-19 or flu in the last 5 days and are getting worse?', null, true],
    ['Are you pregnant?', 'Helps the team plan your care.', false],
  ],
  urg: [
    ['Do you have chest pain or pressure?', null, true],
    ['Are you having trouble breathing?', null, true],
    ['Have you hit your head in the last 24 hours?', null, true],
    ['A fever for more than 3 days?', null, true],
    ['Have you tested positive for COVID-19 or flu in the last 5 days?', null, true],
  ],
  pcp: [
    ['Do you have chest pain or trouble breathing right now?', null, true],
    ['A fever for more than 3 days?', null, true],
    ['Is this a follow-up visit?', null, false],
  ],
  ped: [
    ['Is your child under 3 months old and has a fever of 100.4°F (38°C) or higher?', null, true],
    ['Is your child having trouble breathing?', null, true],
    ['Is your child unusually sleepy or hard to wake?', null, true],
    ['Has your child had fewer wet diapers or stopped drinking?', null, true],
    ['Has your child had a seizure?', null, true],
  ],
  obg: [
    ['Are you pregnant?', null, false],
    ['If pregnant: are you bleeding, or leaking fluid?', null, true],
    ['If pregnant: a severe headache or changes in your vision?', null, true],
    ['If pregnant: is the baby moving less than usual?', null, true],
  ],
  rad: [
    ['Could you be pregnant?', 'Some imaging uses radiation.', false],
    ['Do you have a pacemaker or any metal implant?', 'Important for MRI.', false],
    ['Have you had a reaction to contrast dye before?', null, false],
  ],
  lab: [
    ['Do you feel faint or dizzy right now?', null, true],
    ['Have you been fasting as instructed?', null, false],
  ],
  onc: [
    ['A temperature of 100.4°F (38°C) or higher since your last treatment?', 'Fever during treatment needs prompt review.', true],
    ['New shortness of breath?', null, true],
    ['New bleeding or bruising?', null, true],
  ],
  vax: [
    ['Do you have a fever today?', 'You may be asked to come back another day.', false],
    ['Have you had a serious allergic reaction to a vaccine before?', null, false],
  ],
  mam: [
    ['Do you have breast implants?', null, false],
  ],
  rx: [],
};

/* "Have these ready". is_mandatory = false is "preferred": nice to have,
   never a barrier to joining. */
const READY = {
  ed:  [['Photo ID', null, false], ['Insurance card', null, false], ['A list of your current medications', null, false]],
  urg: [['Photo ID', null, false], ['Insurance card', null, false], ['A list of your current medications', null, false]],
  pcp: [['Insurance card', null, true], ['A list of your current medications', null, false]],
  ped: [['Insurance card', null, true], ["Your child's immunization record", null, false]],
  obg: [['Insurance card', null, true], ['The date of your last menstrual period, and recent period history', null, false], ['Prenatal records from another provider, if any', null, false]],
  rad: [['Imaging order from your clinician', 'Most X-ray, CT and MRI exams need one.', true], ['Photo ID and insurance card', null, true], ['Prior imaging (CD or portal access) if done elsewhere', null, false]],
  lab: [['Lab order from your clinician', null, true], ['Insurance card', null, false]],
  onc: [['Referral from your physician', 'If this is your first visit.', false], ['Recent test results', null, false], ['A list of your current medications', null, false]],
  rx:  [['Prescription or Rx number', null, true], ['Insurance card', null, false]],
  vax: [['Vaccination card or record', null, false], ['Insurance card', null, false]],
  mam: [['Order from your clinician, if this is a diagnostic mammogram', null, false], ['Prior mammograms if done elsewhere', null, false]],
};

/* Hour-by-hour shape of arrivals (index = hour). */
function hourWeight(key, h) {
  if (key === 'ed') {
    // Low overnight, climbing from 8am, highest 11am-9pm.
    return [0.35, 0.3, 0.25, 0.22, 0.2, 0.22, 0.3, 0.45, 0.7, 0.9, 1.05, 1.15, 1.2, 1.2, 1.15, 1.15, 1.2, 1.25, 1.25, 1.2, 1.1, 0.95, 0.75, 0.5][h];
  }
  const [open, close] = DEPTS[key].hours;
  if (h < open || h >= close) return 0;
  const t = (h - open) / Math.max(1, close - open);
  // Morning rush, a lunch dip, a smaller late-afternoon bump.
  return 0.6 + 0.9 * Math.exp(-((t - 0.2) ** 2) / 0.02) + 0.4 * Math.exp(-((t - 0.75) ** 2) / 0.02);
}
const DOW = [0.85, 1.25, 1.05, 0.95, 0.95, 1.0, 0.8]; // Sun..Sat; Monday heaviest

/* ── people ───────────────────────────────────────────────────────────── */
const FIRST = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Carlos', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy', 'Anthony', 'Betty', 'Mark', 'Sandra', 'Andre', 'Ashley', 'Steven', 'Kimberly', 'Kevin', 'Emily', 'Brian', 'Donna', 'Luis', 'Michelle', 'Jamal', 'Carol', 'Wei', 'Amanda', 'Priya', 'Melissa', 'Omar', 'Deborah', 'Hector', 'Stephanie', 'Tyrone', 'Rebecca', 'Aaliyah', 'Laura', 'Diego', 'Sharon', 'Keisha', 'Cynthia', 'Mei', 'Kathleen', 'Ahmed', 'Angela'];
const LAST = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Okafor', 'Patel', 'Kim', 'Chen', 'Haddad'];

const PATIENTS = 900;
const patients = [];
for (let i = 1; i <= PATIENTS; i++) {
  const first = pick(FIRST); const last = pick(LAST);
  patients.push({
    id: `wf-usr-${String(i).padStart(4, '0')}`,
    name: `${first} ${last}`,
    email: `patient${String(i).padStart(4, '0')}@wrenfield.example`,
    phone: `(555) 01${String(i % 10)}-${String(1000 + i).slice(-4)}`,
    dob: `${1940 + Math.floor(rand() * 75)}-${pad2(1 + Math.floor(rand() * 12))}-${pad2(1 + Math.floor(rand() * 28))}`,
    home: pick(HOSPITALS).id,
  });
}

/* People the Cases screen should find. */
const FREQUENT_ED = patients.slice(0, 5);        // several ED visits this week
const REPEAT_UNRESOLVED = patients.slice(5, 9);  // keep coming back without the thing
const FLAGGED = [
  { p: patients[1], flag: 'priority', note: 'Sickle cell disease. See promptly for pain crises per care plan.' },
  { p: patients[9], flag: 'priority', note: 'COPD on home oxygen. Escalate breathing complaints.' },
  { p: patients[3], flag: 'watch', note: 'Frequent ED visits. Case management and social work referral in progress.' },
];

const STAFF_FIRST = ['Renee', 'Marcus', 'Tasha', 'Gregory', 'Alicia', 'Victor', 'Monique', 'Darnell', 'Erin', 'Felix', 'Gloria', 'Ian', 'Janelle', 'Kurt', 'Lena', 'Nolan', 'Odette', 'Pedro', 'Quinn', 'Rosa', 'Simon', 'Talia', 'Uriel', 'Vanessa'];
const STAFF_LAST = ['Abbott', 'Benson', 'Coleman', 'Dalton', 'Ellison', 'Fowler', 'Grayson', 'Holloway', 'Ingram', 'Jennings', 'Keller', 'Lambert', 'Mercer', 'Norris', 'Osborne', 'Pruitt', 'Ramsey', 'Sutton', 'Tate', 'Vaughn'];

/* ── batched insert ───────────────────────────────────────────────────── */
async function insertMany(conn, table, cols, rows, chunk = 800) {
  for (let i = 0; i < rows.length; i += chunk) {
    const part = rows.slice(i, i + chunk);
    const ph = part.map(() => `(${cols.map(() => '?').join(',')})`).join(',');
    await conn.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${ph}`, part.flat());
  }
}

async function main() {
  const conn = await pool.getConnection();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const now = new Date();
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('Removing any earlier Wrenfield data…');
    await conn.query(`DELETE FROM wait_time_records WHERE business_id = ?`, [BIZ]);
    await conn.query(`DELETE e FROM queue_events e JOIN queue_tickets t ON t.id = e.ticket_id WHERE t.id LIKE 'wf-%'`);
    await conn.query(`DELETE FROM session_registrations WHERE id LIKE 'wf-%'`);
    await conn.query(`DELETE FROM scheduled_sessions WHERE business_id = ?`, [BIZ]);
    await conn.query(`DELETE FROM queue_tickets WHERE id LIKE 'wf-%'`);
    await conn.query(`DELETE FROM queues WHERE id LIKE 'wf-%'`);
    await conn.query(`DELETE FROM patient_flags WHERE business_id = ?`, [BIZ]);
    await conn.query(`DELETE FROM staff_assignments WHERE id LIKE 'wf-%'`);
    await conn.query(`DELETE FROM counters WHERE id LIKE 'wf-%'`);
    await conn.query(`DELETE FROM service_triage_questions WHERE id LIKE 'wf-%'`);
    await conn.query(`DELETE FROM service_readiness WHERE id LIKE 'wf-%'`);
    await conn.query(`DELETE FROM branch_targets WHERE business_id = ?`, [BIZ]);
    await conn.query(`DELETE FROM business_targets WHERE business_id = ?`, [BIZ]);
    await conn.query(`DELETE FROM staff WHERE id LIKE 'wf-%' AND supabase_uid IS NULL`);
    // Seeded patients only: never a login (the patient-*@test.com accounts
    // share the wf-usr- prefix and are linked to Supabase).
    await conn.query(`DELETE FROM users WHERE id LIKE 'wf-usr-%' AND supabase_uid IS NULL`);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Organisation, hospitals and departments…');
    await conn.query(
      `INSERT INTO businesses (id, name, slug, sector, description, phone, email, subscription_tier_id, is_active,
                               default_opening_time, default_closing_time)
       VALUES (?, 'Wrenfield Health', 'wrenfield', 'healthcare',
               'A three-hospital health system serving Calloway and Westmarch. Fictional, for demonstration.',
               '(555) 010-1000', 'patientaccess@wrenfield.example', 'tier-exec-001', TRUE, '00:00:00', '23:59:00')
       ON DUPLICATE KEY UPDATE name = VALUES(name), sector = 'healthcare', is_active = TRUE`, [BIZ]);

    for (const h of HOSPITALS) {
      await conn.query(
        `INSERT INTO branches (id, business_id, name, address, city, parish, phone, latitude, longitude,
                               opening_time, closing_time, open_days, line_helper_enabled, is_main_branch, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '00:00:00', '23:59:00', '0,1,2,3,4,5,6', TRUE, ?, TRUE)
         ON DUPLICATE KEY UPDATE name = VALUES(name), address = VALUES(address), city = VALUES(city),
           parish = VALUES(parish), latitude = VALUES(latitude), longitude = VALUES(longitude), is_active = TRUE`,
        [h.id, BIZ, h.name, h.address, h.city, h.state, h.phone, h.lat, h.lng, h.main]);
    }
    // A US system: without this the app treats the hospitals as Jamaican
    // (migration 039's default) and never lists them as near a US patient.
    await conn.query(`UPDATE branches SET country_code = 'US' WHERE business_id = ?`, [BIZ]);

    for (const [key, d] of Object.entries(DEPTS)) {
      await conn.query(
        `INSERT INTO services (id, business_id, name, description, ticket_prefix, base_avg_time_minutes, is_active)
         VALUES (?, ?, ?, ?, ?, ?, TRUE)
         ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description),
           ticket_prefix = VALUES(ticket_prefix), base_avg_time_minutes = VALUES(base_avg_time_minutes), is_active = TRUE`,
        [svcId(key), BIZ, d.name, d.desc, d.prefix, d.svc]);
      const tq = (TRIAGE[key] || []).map(([q, detail, red], i) => [`wf-tq-${key}-${i}`, svcId(key), i, q, detail, red, true]);
      if (tq.length) await insertMany(conn, 'service_triage_questions', ['id', 'service_id', 'seq', 'question', 'detail', 'red_flag', 'is_active'], tq);
      const rd = (READY[key] || []).map(([label, detail, mand], i) => [`wf-rd-${key}-${i}`, svcId(key), 'bring', i, label, detail, mand, true]);
      if (rd.length) await insertMany(conn, 'service_readiness', ['id', 'service_id', 'kind', 'seq', 'label', 'detail', 'is_mandatory', 'is_active'], rd);
    }

    const counters = [];
    for (const h of HOSPITALS) {
      let n = 1;
      for (const key of h.depts) {
        for (const label of DEPTS[key].counters) {
          counters.push({ id: `wf-ctr-${hid(h.id, key, label).slice(0, 24)}`, branch: h.id, key, label, number: n++ });
        }
      }
    }
    await insertMany(conn, 'counters', ['id', 'branch_id', 'service_id', 'counter_number', 'label', 'is_active'],
      counters.map((c) => [c.id, c.branch, svcId(c.key), c.number, c.label, true]));

    console.log('Staff…');
    const staff = [];
    let s = 0;
    const staffName = () => `${STAFF_FIRST[s % STAFF_FIRST.length]} ${STAFF_LAST[(s * 7) % STAFF_LAST.length]}`;
    staff.push({ id: 'wf-stf-exec', branch: null, role: 'role-exec-001', name: 'Dr. Helena Marsh', code: 'WF-EXEC-1', title: 'Chief Operating Officer' });
    for (const h of HOSPITALS) {
      const tag = h.id.replace('wf-brn-', '');
      staff.push({ id: `wf-stf-${tag}-mgr`, branch: h.id, role: 'role-mgr-001', name: (s++, staffName()), code: `WF-${tag.toUpperCase()}-MGR` });
      staff.push({ id: `wf-stf-${tag}-sup`, branch: h.id, role: 'role-supervisor-001', name: (s++, staffName()), code: `WF-${tag.toUpperCase()}-SUP` });
      // The front-desk iPad at each hospital signs in as this kiosk account.
      staff.push({ id: `wf-stf-${tag}-kiosk`, branch: h.id, role: 'role-kiosk-001', name: `${h.name} Front Desk`, code: `WF-${tag.toUpperCase()}-KIOSK` });
      const desks = Math.max(4, Math.round(8 * h.scale));
      for (let i = 1; i <= desks; i++) {
        staff.push({ id: `wf-stf-${tag}-${i}`, branch: h.id, role: 'role-staff-001', name: (s++, staffName()), code: `WF-${tag.toUpperCase()}-${pad2(i)}` });
      }
    }
    for (const st of staff) {
      await conn.query(
        `INSERT INTO staff (id, business_id, branch_id, role_id, staff_code, full_name, email, availability_status, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active', TRUE)
         ON DUPLICATE KEY UPDATE business_id = VALUES(business_id), branch_id = VALUES(branch_id), role_id = VALUES(role_id),
           full_name = VALUES(full_name), is_active = TRUE`,
        [st.id, BIZ, st.branch, st.role, st.code, st.name, `${st.code.toLowerCase()}@wrenfield.example`]);
    }
    const desksAt = (branch) => staff.filter((x) => x.branch === branch && x.role === 'role-staff-001');

    // Today's desks.
    const assignments = [];
    for (const h of HOSPITALS) {
      const desks = desksAt(h.id);
      // One desk per person per day; any counter beyond the staff on shift stays closed.
      counters.filter((c) => c.branch === h.id).forEach((c, i) => {
        if (i >= desks.length) return;
        const who = desks[i];
        assignments.push([`wf-asg-${hid(c.id, ymd(today)).slice(0, 24)}`, who.id, c.id, ymd(today), '07:00:00', '19:00:00']);
      });
    }
    await insertMany(conn, 'staff_assignments', ['id', 'staff_id', 'counter_id', 'assignment_date', 'shift_start', 'shift_end'], assignments);

    console.log('Patients…');
    await insertMany(conn, 'users', ['id', 'email', 'full_name', 'phone', 'date_of_birth'],
      patients.map((p) => [p.id, p.email, p.name, p.phone, p.dob]));

    console.log('90 days of visits…');
    const queues = [];
    const tickets = [];
    const waits = [];
    const events = [];
    const ended = (st) => ['served', 'left', 'cancelled', 'no_show'].includes(st);

    const answersFor = (key, urgent) => {
      const qs = TRIAGE[key] || [];
      if (!qs.length) return { json: null, flag: 'none' };
      const redIdx = qs.map((q, i) => (q[2] ? i : -1)).filter((i) => i >= 0);
      const yes = urgent && redIdx.length ? pick(redIdx) : -1;
      const arr = qs.map((q, i) => ({ question_id: `wf-tq-${key}-${i}`, question: q[0], red_flag: q[2], answer: i === yes || (!q[2] && chance(0.2)) }));
      return { json: JSON.stringify(arr), flag: yes >= 0 ? 'possibly_urgent' : 'none' };
    };

    const frequentDays = [1, 2, 3, 4, 6, 7, 8, 9, 10];
    for (let back = 90; back >= 0; back--) {
      const day = new Date(today); day.setDate(day.getDate() - back);
      const dow = day.getDay();
      const fluBoost = 1 + (90 - back) / 90 * 0.6; // flu season building through October
      for (const h of HOSPITALS) {
        for (const key of h.depts) {
          const d = DEPTS[key];
          if (!d.days.includes(dow)) continue;
          const qid = `wf-q-${hid(h.id, key, ymd(day)).slice(0, 30)}`;
          const isToday = back === 0;
          queues.push([qid, h.id, svcId(key), ymd(day), 300, isToday]);
          const desks = desksAt(h.id);
          const volume = d.daily * h.scale * DOW[dow] * (key === 'vax' ? fluBoost * 1.4 : 1) * (key === 'ed' || key === 'urg' ? (1 + (fluBoost - 1) * 0.5) : 1);
          const totalWeight = Array.from({ length: 24 }, (_, x) => hourWeight(key, x)).reduce((a, b) => a + b, 0);
          let n = 0;
          const lastHour = isToday ? now.getHours() : 23;
          for (let hr = 0; hr <= lastHour; hr++) {
            const w = hourWeight(key, hr);
            if (!w) continue;
            const expected = volume * w / totalWeight;
            const count = Math.floor(expected) + (chance(expected % 1) ? 1 : 0);
            for (let k = 0; k < count; k++) {
              n++;
              const joined = new Date(day); joined.setHours(hr, Math.floor(rand() * 60), Math.floor(rand() * 60));
              if (isToday && joined > now) continue;
              const busy = w / 1.2;
              // Waits follow volume: busier hours and busier weekdays wait longer.
              const wait = Math.round(between(d.wait[0], d.wait[1]) * (0.6 + busy * 0.6) * (0.7 + 0.35 * DOW[dow]));
              const svcMin = Math.max(2, Math.round(d.svc * between(0.7, 1.3)));
              const urgent = (key === 'ed' && chance(0.14)) || (['urg', 'ped', 'onc'].includes(key) && chance(0.06));
              const tri = answersFor(key, urgent);
              const effWait = tri.flag === 'possibly_urgent' ? Math.round(wait * 0.4) : wait;

              // Outcome
              let status = 'served'; let reason = null; let readiness = 'not_checked';
              const r = rand();
              if (key === 'ed') {
                if (r < 0.05) { status = 'left'; reason = 'wait_too_long'; }
                else if (r < 0.07) { status = 'no_show'; }
                else if (r < 0.10) { reason = 'needs_test_first'; }
                else if (r < 0.12) { reason = 'referred_elsewhere'; }
              } else if (['rad', 'lab'].includes(key)) {
                if (r < 0.04) { reason = 'wrong_documents'; readiness = 'incomplete'; }
                else if (r < 0.06) { reason = 'rescheduled'; }
                else if (r < 0.09) { status = 'left'; reason = 'wait_too_long'; }
                else if (r < 0.11) { status = 'no_show'; }
                else readiness = 'ready';
              } else {
                if (r < 0.03) { reason = 'rescheduled'; }
                else if (r < 0.05) { reason = 'referred_elsewhere'; }
                else if (r < 0.08) { status = 'left'; reason = key === 'urg' ? 'wait_too_long' : 'came_back_later'; }
                else if (r < 0.10) { status = 'no_show'; }
              }

              const called = new Date(joined.getTime() + effWait * 60000);
              const started = new Date(called.getTime() + Math.round(between(1, 4)) * 60000);
              const done = new Date(started.getTime() + svcMin * 60000);
              let finalStatus = status;
              // Today: anything not finished yet is still live.
              if (isToday) {
                if (now < called) finalStatus = 'waiting';
                else if (now < started) finalStatus = status === 'served' ? 'called' : status;
                else if (now < done) finalStatus = status === 'served' ? 'in_service' : status;
              }
              const user = chance(0.75) ? pick(patients) : null;
              const tid = `wf-t-${hid(qid, n).slice(0, 30)}`;
              const staffer = desks.length ? desks[n % desks.length] : null;
              tickets.push({
                id: tid, queue: qid, user: user ? user.id : null,
                guest: user ? null : `${pick(FIRST)} ${pick(LAST)[0]}.`,
                number: `${d.prefix}-${String(n).padStart(3, '0')}`, code: code6(tid), pos: n,
                status: finalStatus, wait: effWait, joined,
                called: ['waiting'].includes(finalStatus) ? null : called,
                started: ['waiting', 'called'].includes(finalStatus) || status !== 'served' ? null : started,
                done: ended(finalStatus) ? (status === 'served' ? done : called) : null,
                channel: user ? (chance(0.7) ? 'app' : 'kiosk') : 'walk_in',
                staff: status === 'served' ? staffer?.id : null,
                readiness, reason: ended(finalStatus) ? reason : null,
                triage: tri.json, flag: tri.flag,
              });
              if (ended(finalStatus)) {
                waits.push([crypto.randomUUID(), tid, BIZ, h.id, svcId(key), ymd(day), dow, hr, day.getMonth() + 1,
                  effWait, status === 'served' ? svcMin : null, finalStatus, user ? 'app' : 'walk_in',
                  desks.length, Math.max(1, Math.round(effWait / Math.max(3, d.svc / 2))), d.counters.length]);
              }
            }
          }
        }
      }
    }

    // Frequent ED visitors: three to five ended ED visits in the last week.
    const flagshipEdQueue = (back) => {
      const day = new Date(today); day.setDate(day.getDate() - back);
      return `wf-q-${hid('wf-brn-ellery', 'ed', ymd(day)).slice(0, 30)}`;
    };
    FREQUENT_ED.forEach((p, i) => {
      const visits = 3 + (i % 3);
      for (let v = 0; v < visits; v++) {
        const back = frequentDays[(i + v * 2) % frequentDays.length] % 7 || 1;
        const day = new Date(today); day.setDate(day.getDate() - back);
        const joined = new Date(day); joined.setHours(9 + ((i + v) * 3) % 12, (v * 17) % 60);
        const left = v % 2 === 1;
        const tid = `wf-t-freq-${i}-${v}`;
        const wait = 40 + v * 7;
        tickets.push({
          id: tid, queue: flagshipEdQueue(back), user: p.id, guest: null, number: `ED-F${i}${v}`, code: code6(tid), pos: 900 + v,
          status: left ? 'left' : 'served', wait, joined,
          called: left ? null : new Date(joined.getTime() + wait * 60000),
          started: left ? null : new Date(joined.getTime() + (wait + 2) * 60000),
          done: new Date(joined.getTime() + (wait + 30) * 60000), channel: 'app',
          staff: left ? null : 'wf-stf-ellery-1', readiness: 'not_checked',
          reason: left ? 'wait_too_long' : (v === 0 ? 'needs_test_first' : null),
          triage: answersFor('ed', v === visits - 1).json, flag: v === visits - 1 ? 'possibly_urgent' : 'none',
        });
      }
    });
    // Repeat unresolved: imaging and lab without the order, then needing a test first.
    REPEAT_UNRESOLVED.forEach((p, i) => {
      const key = i % 2 ? 'lab' : 'rad';
      for (let v = 0; v < 3; v++) {
        const back = 4 + v * 6 + i;
        const day = new Date(today); day.setDate(day.getDate() - back);
        if (!DEPTS[key].days.includes(day.getDay())) day.setDate(day.getDate() - 1);
        const qid = `wf-q-${hid('wf-brn-ellery', key, ymd(day)).slice(0, 30)}`;
        const joined = new Date(day); joined.setHours(9 + v, 15);
        const tid = `wf-t-rep-${i}-${v}`;
        tickets.push({
          id: tid, queue: qid, user: p.id, guest: null, number: `${DEPTS[key].prefix}-R${i}${v}`, code: code6(tid), pos: 950 + v,
          status: 'served', wait: 22, joined, called: new Date(joined.getTime() + 22 * 60000),
          started: new Date(joined.getTime() + 24 * 60000), done: new Date(joined.getTime() + 30 * 60000), channel: 'app',
          staff: 'wf-stf-ellery-2', readiness: v < 2 ? 'incomplete' : 'not_checked',
          reason: v < 2 ? 'wrong_documents' : 'needs_test_first', triage: answersFor(key, false).json, flag: 'none',
        });
      }
    });

    // Today's live ED line at the flagship: make sure the people the demo is
    // about are waiting in it.
    const todayEd = flagshipEdQueue(0);
    const waitingNow = tickets.filter((t) => t.queue === todayEd && t.status === 'waiting');
    const showcase = [
      { user: patients[1].id, urgent: true },   // priority flag + possibly urgent
      { user: patients[0].id, urgent: false },  // frequent visitor
      { user: patients[9].id, urgent: false },  // priority flag (COPD)
      { user: patients[3].id, urgent: false },  // watch flag
      { user: null, urgent: true },             // walk-in, possibly urgent
    ];
    showcase.forEach((sc, i) => {
      const joined = new Date(now.getTime() - (6 + i * 7) * 60000);
      const tid = `wf-t-live-${i}`;
      const tri = answersFor('ed', sc.urgent);
      tickets.push({
        id: tid, queue: todayEd, user: sc.user, guest: sc.user ? null : 'Walk-in patient',
        number: `ED-L${i + 1}`, code: code6(tid), pos: 1000 + i * 2, status: 'waiting', wait: 45, joined,
        called: null, started: null, done: null, channel: sc.user ? 'app' : 'walk_in', staff: null,
        readiness: 'not_checked', reason: null, triage: tri.json, flag: tri.flag,
      });
    });
    // Every department open right now has people waiting: a demo opened
    // mid-morning should not show empty clinic lines.
    for (const h of HOSPITALS) {
      for (const key of h.depts) {
        const d = DEPTS[key];
        if (key === 'ed' || !d.days.includes(now.getDay())) continue;
        if (now.getHours() < d.hours[0] || now.getHours() >= d.hours[1]) continue;
        const qid = `wf-q-${hid(h.id, key, ymd(today)).slice(0, 30)}`;
        const count = Math.max(2, Math.round(2 + 5 * h.scale * hourWeight(key, now.getHours()) / 1.5));
        for (let i = 0; i < count; i++) {
          const tid = `wf-t-now-${hid(qid, i).slice(0, 24)}`;
          const user = chance(0.8) ? pick(patients) : null;
          const urgent = ['urg', 'ped', 'onc'].includes(key) && i === 1;
          const tri = answersFor(key, urgent);
          tickets.push({
            id: tid, queue: qid, user: user ? user.id : null, guest: user ? null : `${pick(FIRST)} ${pick(LAST)[0]}.`,
            number: `${d.prefix}-N${i + 1}`, code: code6(tid), pos: 3000 + i, status: 'waiting',
            wait: Math.round(between(d.wait[0], d.wait[1])), joined: new Date(now.getTime() - (3 + i * 5) * 60000),
            called: null, started: null, done: null, channel: user ? 'app' : 'walk_in', staff: null,
            readiness: 'not_checked', reason: null, triage: tri.json, flag: tri.flag,
          });
        }
      }
    }

    // Renumber today's waiting ED tickets by join time so places read 1, 2, 3…
    const live = tickets.filter((t) => t.queue === todayEd && ['waiting', 'called', 'in_service'].includes(t.status))
      .sort((a, b) => a.joined - b.joined);
    live.forEach((t, i) => { t.pos = 2000 + i; });

    await insertMany(conn, 'queues', ['id', 'branch_id', 'service_id', 'queue_date', 'max_capacity', 'is_active'], queues);
    await insertMany(conn, 'queue_tickets',
      ['id', 'queue_id', 'user_id', 'guest_name', 'ticket_number', 'verification_code', 'position', 'status',
       'estimated_wait_minutes', 'joined_at', 'called_at', 'started_serving_at', 'completed_at', 'channel',
       'served_by_staff_id', 'readiness_outcome', 'closed_reason', 'triage_answers', 'triage_flag'],
      tickets.map((t) => [t.id, t.queue, t.user, t.guest, t.number, t.code, t.pos, t.status, t.wait,
        dt(t.joined), t.called ? dt(t.called) : null, t.started ? dt(t.started) : null, t.done ? dt(t.done) : null,
        t.channel, t.staff, t.readiness, t.reason, t.triage, t.flag]), 500);
    await insertMany(conn, 'wait_time_records',
      ['id', 'ticket_id', 'business_id', 'branch_id', 'service_id', 'visit_date', 'day_of_week', 'hour_of_day',
       'month_of_year', 'wait_time_minutes', 'service_time_minutes', 'status', 'channel', 'staff_count_at_time',
       'queue_length_at_time', 'active_counters_at_time'], waits);
    // One event per ticket so call counts and audit history read sensibly.
    for (const t of tickets) {
      events.push([crypto.randomUUID(), t.id, null, 'waiting', dt(t.joined)]);
      if (t.called) events.push([crypto.randomUUID(), t.id, 'waiting', 'called', dt(t.called)]);
    }
    await insertMany(conn, 'queue_events', ['id', 'ticket_id', 'previous_status', 'new_status', 'event_timestamp'], events, 1000);

    console.log('Flags, targets and flu clinics…');
    await insertMany(conn, 'patient_flags', ['id', 'business_id', 'user_id', 'flag', 'note', 'set_by_staff_id'],
      FLAGGED.map((f, i) => [`wf-flag-${i}`, BIZ, f.p.id, f.flag, f.note, 'wf-stf-ellery-sup']));
    await conn.query(
      `INSERT INTO business_targets (business_id, target_wait_minutes, target_completion_rate, target_no_show_rate, note, set_by_staff_id)
       VALUES (?, 30, 90, 5, 'Door-to-provider and left-without-being-seen goals for FY2027', 'wf-stf-exec')`, [BIZ]);

    const sat = new Date(today); sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7));
    const clinics = [
      { id: 'wf-ses-flu-ellery', branch: 'wf-brn-ellery', name: 'Community Flu Shot Clinic — Ellery Bay', date: sat, cap: 250, reg: 140 },
      { id: 'wf-ses-flu-brannock', branch: 'wf-brn-brannock', name: 'Community Flu Shot Clinic — Brannock', date: sat, cap: 150, reg: 70 },
      { id: 'wf-ses-flu-today', branch: 'wf-brn-ellery', name: 'Staff & Family Flu Shot Morning', date: today, cap: 80, reg: 46 },
    ];
    for (const c of clinics) {
      await conn.query(
        `INSERT INTO scheduled_sessions (id, business_id, branch_id, service_id, name, description, venue_name, venue_address,
                                         session_date, starts_at, ends_at, capacity, registration_opens_at, arrive_minutes_before, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '08:00:00', '14:00:00', ?, ?, 15, ?)`,
        [c.id, BIZ, c.branch, svcId('vax'), c.name,
          'Register ahead, then join the line from your phone on the day. Free for adults and children over 6 months.',
          HOSPITALS.find((h) => h.id === c.branch).name, HOSPITALS.find((h) => h.id === c.branch).address,
          ymd(c.date), c.cap, dt(new Date(today.getTime() - 14 * 86400000)), c.date.getTime() === today.getTime() ? 'in_progress' : 'open']);
      const regs = [];
      for (let i = 0; i < c.reg; i++) {
        const p = patients[(i * 7 + 11) % patients.length];
        regs.push([`wf-reg-${hid(c.id, i).slice(0, 26)}`, c.id, p.id, code6(c.id, i),
          c.date.getTime() === today.getTime() && i < 20 ? 'checked_in' : 'registered']);
      }
      await insertMany(conn, 'session_registrations', ['id', 'session_id', 'user_id', 'registration_code', 'status'], regs);
    }

    console.log(`Done: ${HOSPITALS.length} hospitals, ${Object.keys(DEPTS).length} departments, ${staff.length} staff,`
      + ` ${patients.length} patients, ${queues.length} daily lines, ${tickets.length} visits.`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});

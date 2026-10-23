#!/usr/bin/env node
/**
 * demo-switch.js — point the seven demo.*@uselyne.com accounts at the
 * organisation the next demo is about. DEMO DATABASE ONLY.
 *
 *   ALLOW_DEMO_SWITCH=true MYSQL_HOST=127.0.0.1 MYSQL_PORT=3308 node scripts/demo-switch.js bank
 *   (or: bash scripts/demo-switch.sh bank)
 *
 * Profiles: bank, creditunion, court, hospital, blueharbour.
 *
 * WHY THIS EXISTS. The seven demo logins (secrets/staff-logins.txt) were made
 * so a demo can open the real admin app and sign in as each role. On
 * production they belong to Blue Harbour Civic Centre, the fictional review
 * organisation, and must stay there: production may not hold the demo
 * organisations (CLAUDE.md rule 4 and 6). On the demo database they are
 * personas: the same seven staff rows, with the same ids as production,
 * reassigned to Lignum Bank before a bank demo, the court before a court demo,
 * and so on. `blueharbour` puts them back exactly as production has them.
 *
 * What it does, all in one transaction:
 *   1. finds each account's Supabase login by email (the server only ever
 *      matches staff by that id, never by email);
 *   2. writes the seven staff rows for the chosen organisation: role, branch,
 *      service, a name that fits it, and the login link;
 *   3. seats the three officers at a counter of their service for TODAY.
 *
 * Seating is per day. Run it again on the morning of the demo (or after
 * refresh-demo-data), so the officers are at their desks.
 */
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env'), override: false });

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run: NODE_ENV=production. This is for the demo database only.');
  process.exit(1);
}
if (process.env.ALLOW_DEMO_SWITCH !== 'true') {
  console.error('Set ALLOW_DEMO_SWITCH=true to confirm this is the demo database (scripts/demo-switch.sh does).');
  process.exit(1);
}

/* The seven personas. Ids and emails are production's (review_tenant_seed.sql
   and the step-11 accounts), so one set of logins means the same seven people
   everywhere. */
const PERSONAS = [
  { key: 'officer1',    id: 'stf-review-demo-ln1', email: 'demo.officer@uselyne.com',      code: 'DEMO-STAFF-001', role: 'role-staff-001' },
  { key: 'officer2',    id: 'stf-review-demo-ln2', email: 'demo.officer2@uselyne.com',     code: 'DEMO-STAFF-002', role: 'role-staff-001' },
  { key: 'officer3',    id: 'stf-review-demo-ln3', email: 'demo.officer3@uselyne.com',     code: 'DEMO-STAFF-003', role: 'role-staff-001' },
  { key: 'supervisor1', id: 'stf-review-demo-sup', email: 'demo.supervisor@uselyne.com',   code: 'DEMO-SUP-001',   role: 'role-supervisor-001' },
  { key: 'supervisor2', id: 'stf-review-demo-sp2', email: 'demo.supervisor2@uselyne.com',  code: 'DEMO-SUP-002',   role: 'role-supervisor-001' },
  { key: 'manager',     id: 'stf-review-demo-mgr', email: 'demo.manager@uselyne.com',      code: 'DEMO-MGR-001',   role: 'role-mgr-001' },
  { key: 'executive',   id: 'stf-review-demo-exe', email: 'demo.executive@uselyne.com',    code: 'DEMO-EXEC-001',  role: 'role-exec-001' },
  /* The front-desk kiosk (the iPad). Its own row, so the hospital seed's
     kiosk rows are never repurposed; the login is the one the kiosk iPad is
     already signed in with. */
  { key: 'kiosk',       id: 'stf-demo-kiosk',      email: 'kiosk-hospital@test.com',       code: 'DEMO-KIOSK-001', role: 'role-kiosk-001' },
];

/* Per organisation: where each persona sits, what they serve, and a name that
   reads naturally in that demo. branch null = organisation-wide. */
const PROFILES = {
  bank: {
    label: 'Lignum Bank (bank demos)',
    business: 'biz-lgb-001',
    officer1:    { name: 'Shanelle Grant',    branch: 'br-lgb-hwt', service: 'svc-lgb-teller' },
    officer2:    { name: 'Marcus Walters',    branch: 'br-lgb-hwt', service: 'svc-lgb-acct' },
    officer3:    { name: 'Alicia Bryan',      branch: 'br-lgb-nkg', service: 'svc-lgb-teller' },
    // Two supervisors at one branch, each running a different section.
    supervisor1: { name: 'Kimberly Facey',    branch: 'br-lgb-hwt', service: 'svc-lgb-teller', section: 'sec-lgb-hwt-teller' },
    supervisor2: { name: 'Damion Richards',   branch: 'br-lgb-hwt', service: 'svc-lgb-acct',   section: 'sec-lgb-hwt-personal' },
    manager:     { name: 'Andrea Henry',      branch: 'br-lgb-hwt', service: null },
    executive:   { name: 'Michelle Tomlinson', branch: null,        service: null },
    kiosk:       { name: 'Half Way Tree Front Desk', branch: 'br-lgb-hwt', service: null },
  },
  creditunion: {
    label: 'Community First Credit Union',
    business: 'biz-cfcu-001',
    officer1:    { name: 'Tashana Reid',      branch: 'br-cfcu-hwt', service: 'svc-cfcu-member' },
    officer2:    { name: 'Janelle Morgan',    branch: 'br-cfcu-hwt', service: 'svc-cfcu-loan' },
    officer3:    { name: 'Shanice Clarke',    branch: 'br-cfcu-por', service: 'svc-cfcu-loan' },
    supervisor1: { name: 'Ricardo Bent',      branch: 'br-cfcu-hwt', service: 'svc-cfcu-member' },
    supervisor2: { name: 'Damion Reid',       branch: 'br-cfcu-por', service: 'svc-cfcu-loan' },
    manager:     { name: 'Suzette Clarke',    branch: 'br-cfcu-hwt', service: null },
    executive:   { name: 'Michael Aarons',    branch: null,          service: null },
    kiosk:       { name: 'Member Centre Front Desk', branch: 'br-cfcu-hwt', service: null },
  },
  court: {
    label: 'Traffic Court',
    business: 'biz-court-001',
    officer1:    { name: 'Sasha-Gay Lawrence', branch: 'br-court-camp', service: 'svc-court-pay' },
    officer2:    { name: 'Kevin Duncan',       branch: 'br-court-camp', service: 'svc-court-plea' },
    officer3:    { name: 'Nicole Brown',       branch: 'br-court-camp', service: 'svc-court-summ' },
    supervisor1: { name: 'Georgia Palmer',     branch: 'br-court-camp', service: 'svc-court-pay' },
    supervisor2: { name: 'Owen Campbell',      branch: 'br-court-melb', service: 'svc-court-pay' },
    manager:     { name: 'Everton Brissett',   branch: 'br-court-camp', service: null },
    executive:   { name: 'Carlton Bailey',     branch: null,            service: null },
    kiosk:       { name: 'Camp Road Front Desk', branch: 'br-court-camp', service: null },
  },
  hospital: {
    label: 'Wrenfield Health (hospital demos)',
    business: 'wf-biz-0001',
    officer1:    { name: 'Renee Abbott',      branch: 'wf-brn-ellery',   service: 'wf-svc-ed' },
    officer2:    { name: 'Lauren Price',      branch: 'wf-brn-ellery',   service: 'wf-svc-pcp' },
    officer3:    { name: 'Marcus Hill',       branch: 'wf-brn-ellery',   service: 'wf-svc-lab' },
    supervisor1: { name: 'Tasha Coleman, RN', branch: 'wf-brn-ellery',   service: 'wf-svc-ed' },
    supervisor2: { name: 'Dana Whitfield',    branch: 'wf-brn-brannock', service: 'wf-svc-ed' },
    manager:     { name: 'Gregory Dalton',    branch: 'wf-brn-ellery',   service: null },
    executive:   { name: 'Dr. Helena Marsh',  branch: null,              service: null },
    kiosk:       { name: 'Medical Center Front Desk', branch: 'wf-brn-ellery', service: null },
  },
  /* Exactly production. */
  blueharbour: {
    label: 'Blue Harbour Civic Centre (as on production)',
    business: 'biz-review-demo-0001',
    officer1:    { name: 'Officer One (Enquiries)',    branch: 'brn-review-demo-0001', service: 'svc-review-demo-gen' },
    officer2:    { name: 'Officer Two (Collections)',  branch: 'brn-review-demo-0001', service: 'svc-review-demo-doc' },
    officer3:    { name: 'Officer Three (Payments)',   branch: 'brn-review-demo-0001', service: 'svc-review-demo-pay' },
    supervisor1: { name: 'Supervisor One (Enquiries)', branch: 'brn-review-demo-0001', service: 'svc-review-demo-gen' },
    supervisor2: { name: 'Supervisor Two (Collections and Payments)', branch: 'brn-review-demo-0001', service: 'svc-review-demo-doc' },
    manager:     { name: 'Branch Manager',             branch: 'brn-review-demo-0001', service: null },
    executive:   { name: 'Executive',                  branch: null,                   service: null },
    kiosk:       { name: 'Main Office Front Desk', branch: 'brn-review-demo-0001', service: null },
  },
};

async function main() {
  const profileName = String(process.argv[2] || '').toLowerCase();
  const profile = PROFILES[profileName];
  if (!profile) {
    console.error(`Usage: demo-switch <${Object.keys(PROFILES).join('|')}>`);
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY in .env.');
    process.exit(1);
  }

  // Logins first: nothing is written unless all seven are found.
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  const uidFor = new Map(users.map((u) => [String(u.email || '').toLowerCase(), u.id]));
  const missing = PERSONAS.filter((p) => !uidFor.get(p.email));
  if (missing.length) {
    console.error(`These demo logins do not exist in Supabase: ${missing.map((p) => p.email).join(', ')}. Nothing was changed.`);
    process.exit(1);
  }

  const pool = require('../src/db/pool');
  const conn = await pool.getConnection();
  try {
    const [[biz]] = await conn.query('SELECT id, name FROM businesses WHERE id = ?', [profile.business]);
    if (!biz) {
      console.error(`${profile.label} is not in this database. Load its demo seed first. Nothing was changed.`);
      process.exit(1);
    }

    await conn.beginTransaction();
    const ids = PERSONAS.map((p) => p.id);
    const uids = PERSONAS.map((p) => uidFor.get(p.email));

    // A login can belong to one staff row only. Free these seven from any
    // other row that holds them (an earlier experiment, a hand edit).
    await conn.query(
      `UPDATE staff SET supabase_uid = NULL WHERE supabase_uid IN (?) AND id NOT IN (?)`,
      [uids, ids]
    );

    for (const persona of PERSONAS) {
      const seat = profile[persona.key];
      await conn.query(
        `INSERT INTO staff
           (id, business_id, branch_id, section_id, role_id, supabase_uid, staff_code, full_name, email,
            phone, assigned_service_id, availability_status, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '+1-876-000-0000', ?, 'active', TRUE)
         ON DUPLICATE KEY UPDATE
           business_id = VALUES(business_id), branch_id = VALUES(branch_id), section_id = VALUES(section_id),
           role_id = VALUES(role_id), supabase_uid = VALUES(supabase_uid),
           full_name = VALUES(full_name), assigned_service_id = VALUES(assigned_service_id),
           availability_status = 'active', is_active = TRUE`,
        // A section only for a supervisor whose profile names one (migration 043).
        [persona.id, profile.business, seat.branch, seat.section || null, persona.role, uidFor.get(persona.email),
         persona.code, seat.name, persona.email, seat.service]
      );
    }

    // Officers' competency and today's seats. Replaced, not added to, so a
    // switch from the court to the bank leaves no court desk behind.
    const officers = PERSONAS.filter((p) => p.role === 'role-staff-001');
    await conn.query('DELETE FROM staff_services WHERE staff_id IN (?)', [officers.map((p) => p.id)]);
    await conn.query('DELETE FROM staff_assignments WHERE staff_id IN (?) AND assignment_date = CURDATE()', [officers.map((p) => p.id)]);

    const report = [];
    const taken = new Set();
    for (const persona of officers) {
      const seat = profile[persona.key];
      await conn.query(
        `INSERT IGNORE INTO staff_services (staff_id, service_id, proficiency) VALUES (?, ?, 'primary')`,
        [persona.id, seat.service]
      );
      // First free counter of their service at their branch.
      const [counters] = await conn.query(
        `SELECT id, label FROM counters
          WHERE branch_id = ? AND service_id = ? AND is_active = TRUE
          ORDER BY counter_number`,
        [seat.branch, seat.service]
      );
      const counter = counters.find((c) => !taken.has(c.id));
      if (counter) {
        taken.add(counter.id);
        // Nobody else at that desk today.
        await conn.query(
          'DELETE FROM staff_assignments WHERE counter_id = ? AND assignment_date = CURDATE()',
          [counter.id]
        );
        await conn.query(
          `INSERT INTO staff_assignments (id, staff_id, counter_id, assignment_date, shift_start, shift_end)
           VALUES (?, ?, ?, CURDATE(), '08:00:00', '17:00:00')`,
          [`asgn-${persona.id}`, persona.id, counter.id]
        );
      }
      report.push([persona.email, seat.name, counter ? counter.label : 'no counter for that service']);
    }

    await conn.commit();

    const [rows] = await pool.query(
      `SELECT s.email, r.label AS role, s.full_name, br.name AS branch, sv.name AS service
         FROM staff s JOIN roles r ON r.id = s.role_id
         LEFT JOIN branches br ON br.id = s.branch_id
         LEFT JOIN services sv ON sv.id = s.assigned_service_id
        WHERE s.id IN (?) ORDER BY FIELD(s.id, ?)`,
      [ids, ids]
    );
    console.log(`\nDemo accounts now belong to ${biz.name}:\n`);
    for (const r of rows) {
      const seat = report.find((x) => x[0] === r.email);
      console.log(`  ${r.email.padEnd(30)} ${String(r.role).padEnd(11)} ${String(r.full_name).padEnd(20)} ${r.branch || 'whole organisation'}${r.service ? ` · ${r.service}` : ''}${seat ? ` · seated at ${seat[2]}` : ''}`);
    }
    console.log('\nSign in with the passwords in secrets/staff-logins.txt. Seats are for today; run again on the demo morning.');
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Nothing was changed:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end().catch(() => {});
  }
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });

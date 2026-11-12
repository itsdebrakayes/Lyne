/**
 * organisationExport.js — everything one organisation owns, as spreadsheet files.
 *
 * "Your data is yours" (Terms, section 17) has to be something an executive can
 * act on without asking us. This builds that answer: one CSV per kind of
 * record, every row belonging to the organisation and nobody else's.
 *
 * What is deliberately NOT exported, because it is a credential or belongs to
 * the person rather than to the organisation:
 *   - sign-in identifiers (supabase_uid), password hashes, invite codes;
 *   - ticket verification codes, guest access tokens, SMS stop codes,
 *     session check-in codes;
 *   - app users' email addresses, phone numbers and dates of birth. A visitor's
 *     NAME is included, because the desk already sees it; a walk-in's phone
 *     number is included when the clerk typed it in for the organisation.
 *
 * Every dataset is read in pages by its key (keyset, not OFFSET), so a large
 * history neither loads into memory as one result nor slows down as it goes.
 * Each query names the business in its WHERE clause through a placeholder;
 * nothing here takes an identifier from the request.
 */
const pool = require('../db/pool');
const { toCsv } = require('../utils/csv');

const PAGE = 5000;
const D = (col) => `DATE_FORMAT(${col}, '%Y-%m-%d')`;

/** key = a unique, orderable expression; where must contain exactly one ?, the business id. */
const DATASETS = [
  {
    file: 'organisation.csv', about: 'The organisation record and its settings',
    key: 'b.id', from: 'businesses b', where: 'b.id = ?',
    columns: ['b.id AS organisation_id', 'b.name', 'b.short_name', 'b.sector', 'b.description', 'b.website_url', 'b.phone', 'b.email',
      'b.predictions_enabled', 'b.public_insights', 'b.default_opening_time', 'b.default_closing_time', 'b.is_active', 'b.created_at'],
  },
  {
    file: 'branches.csv', about: 'Locations',
    key: 'br.id', from: 'branches br LEFT JOIN branch_settings bs ON bs.branch_id = br.id', where: 'br.business_id = ?',
    columns: ['br.id AS branch_id', 'br.name', 'br.address', 'br.city', 'br.parish', 'br.phone', 'br.opening_time', 'br.closing_time', 'br.open_days',
      'br.is_main_branch', 'br.line_helper_enabled', 'bs.allow_overflow', 'br.is_active', 'br.created_at'],
  },
  {
    file: 'services.csv', about: 'Services (lines) offered',
    key: 's.id', from: 'services s', where: 's.business_id = ?',
    columns: ['s.id AS service_id', 's.name', 's.description', 's.ticket_prefix', 's.base_avg_time_minutes', 's.is_active', 's.created_at'],
  },
  {
    file: 'counters.csv', about: 'Counters / windows at each location',
    key: 'c.id', from: 'counters c JOIN branches br ON br.id = c.branch_id LEFT JOIN services s ON s.id = c.service_id', where: 'br.business_id = ?',
    columns: ['c.id AS counter_id', 'br.name AS branch', 's.name AS service', 'c.counter_number', 'c.label', 'c.is_active', 'c.created_at'],
  },
  {
    file: 'sections.csv', about: 'Supervisor sections and the services in each',
    key: "CONCAT(sec.id, ':', COALESCE(bss.service_id, ''))",
    from: 'branch_sections sec JOIN branches br ON br.id = sec.branch_id LEFT JOIN branch_section_services bss ON bss.section_id = sec.id LEFT JOIN services s ON s.id = bss.service_id',
    where: 'br.business_id = ?',
    columns: ['sec.id AS section_id', 'br.name AS branch', 'sec.name AS section', 's.name AS service'],
  },
  {
    file: 'staff.csv', about: 'Staff accounts (no passwords or sign-in identifiers)',
    key: 'st.id',
    from: 'staff st JOIN roles r ON r.id = st.role_id LEFT JOIN branches br ON br.id = st.branch_id LEFT JOIN branch_sections sec ON sec.id = st.section_id LEFT JOIN services s ON s.id = st.assigned_service_id',
    where: 'st.business_id = ?',
    columns: ['st.id AS staff_id', 'st.staff_code', 'st.full_name', 'st.email', 'st.phone', 'r.name AS role', 'br.name AS branch', 'sec.name AS section',
      's.name AS assigned_service', 'st.availability_status', 'st.is_active', 'st.created_at', 'st.updated_at'],
  },
  {
    file: 'visits.csv', about: 'Every ticket: who, where, when, outcome, and the transfer links between departments',
    key: 't.id',
    from: `queue_tickets t FORCE INDEX (PRIMARY) JOIN queues q ON q.id = t.queue_id JOIN branches br ON br.id = q.branch_id JOIN services s ON s.id = q.service_id
           LEFT JOIN users u ON u.id = t.user_id LEFT JOIN staff sv ON sv.id = t.served_by_staff_id LEFT JOIN counters c ON c.id = t.served_at_counter_id`,
    where: 'br.business_id = ?',
    columns: ['t.id AS ticket_id', 't.ticket_number', 'br.name AS branch', 's.name AS service', `${D('q.queue_date')} AS visit_date`, 't.channel', 't.status',
      't.position', 'COALESCE(t.guest_name, u.full_name) AS visitor_name', 't.guest_phone AS walk_in_phone', 't.visit_reason', 't.triage_flag', 't.triage_answers',
      't.readiness_outcome', 't.readiness_note', 't.estimated_wait_minutes', 't.joined_at', 't.called_at', 't.started_serving_at', 't.completed_at', 't.closed_reason',
      'sv.full_name AS served_by', 'c.label AS counter', 't.journey_started_at', 't.transferred_from_ticket_id', 't.transferred_to_ticket_id', 't.transfer_note'],
  },
  {
    file: 'visit_events.csv', about: 'The timeline of each ticket: every status change and who made it',
    key: 'e.id',
    from: `queue_events e FORCE INDEX (PRIMARY) JOIN queue_tickets t ON t.id = e.ticket_id JOIN queues q ON q.id = t.queue_id JOIN branches br ON br.id = q.branch_id
           LEFT JOIN staff sv ON sv.id = e.triggered_by_staff_id`,
    where: 'br.business_id = ?',
    columns: ['e.id AS event_id', 'e.ticket_id', 't.ticket_number', 'e.previous_status', 'e.new_status', 'e.event_timestamp', 'sv.full_name AS staff', 'e.notes'],
  },
  {
    file: 'wait_measurements.csv', about: 'One row per measured visit: wait and service minutes, used for reports and forecasts',
    // FORCE INDEX: paging by id must walk the primary key. Left to itself MySQL
    // picks the business_id index and re-sorts the whole history for every page.
    key: 'w.id', from: 'wait_time_records w FORCE INDEX (PRIMARY) JOIN branches br ON br.id = w.branch_id JOIN services s ON s.id = w.service_id', where: 'w.business_id = ?',
    columns: ['w.id AS measurement_id', 'w.ticket_id', 'br.name AS branch', 's.name AS service', `${D('w.visit_date')} AS visit_date`, 'w.day_of_week', 'w.hour_of_day',
      'w.wait_time_minutes', 'w.service_time_minutes', 'w.status', 'w.channel', 'w.staff_count_at_time', 'w.queue_length_at_time', 'w.active_counters_at_time'],
  },
  {
    file: 'daily_summaries.csv', about: 'Daily totals per location and service',
    key: 'a.id', from: 'analytics_summaries a LEFT JOIN branches br ON br.id = a.branch_id LEFT JOIN services s ON s.id = a.service_id', where: 'a.business_id = ?',
    columns: ['a.id AS summary_id', 'br.name AS branch', 's.name AS service', `${D('a.summary_date')} AS summary_date`, 'a.total_visitors', 'a.completed_count',
      'a.cancelled_count', 'a.no_show_count', 'a.left_count', 'a.avg_wait_time_minutes', 'a.avg_service_time_minutes', 'a.peak_hour', 'a.completion_rate'],
  },
  {
    file: 'ratings.csv', about: 'Visitor ratings and comments',
    key: 'r.id', from: 'ticket_ratings r LEFT JOIN branches br ON br.id = r.branch_id LEFT JOIN services s ON s.id = r.service_id', where: 'r.business_id = ?',
    columns: ['r.id AS rating_id', 'r.ticket_id', 'br.name AS branch', 's.name AS service', 'r.rating', 'r.wait_ok', 'r.comment', 'r.created_at'],
  },
  {
    file: 'sessions.csv', about: 'Scheduled sessions and appointment days',
    key: 'ss.id', from: 'scheduled_sessions ss LEFT JOIN branches br ON br.id = ss.branch_id LEFT JOIN services s ON s.id = ss.service_id', where: 'ss.business_id = ?',
    columns: ['ss.id AS session_id', 'ss.name', 'br.name AS branch', 's.name AS service', 'ss.venue_name', `${D('ss.session_date')} AS session_date`, 'ss.starts_at', 'ss.ends_at',
      'ss.capacity', 'ss.requires_eligibility', 'ss.status', 'ss.started_at', 'ss.ended_at', 'ss.end_reason', 'ss.created_at'],
  },
  {
    file: 'session_registrations.csv', about: 'Who registered for each session, and whether they checked in',
    key: 'sr.id', from: 'session_registrations sr JOIN scheduled_sessions ss ON ss.id = sr.session_id LEFT JOIN users u ON u.id = sr.user_id', where: 'ss.business_id = ?',
    columns: ['sr.id AS registration_id', 'sr.session_id', 'ss.name AS session', 'COALESCE(sr.guest_name, u.full_name) AS registrant_name', 'sr.guest_phone', 'sr.guest_email',
      'sr.reference', 'sr.verified', 'sr.status', 'sr.registered_at', 'sr.checked_in_at', 'sr.queue_ticket_id'],
  },
  {
    file: 'staff_shifts.csv', about: 'Clock-in, clock-out and break time',
    key: 'sh.id', from: 'staff_shifts sh JOIN staff st ON st.id = sh.staff_id LEFT JOIN branches br ON br.id = sh.branch_id LEFT JOIN counters c ON c.id = sh.counter_id', where: 'st.business_id = ?',
    columns: ['sh.id AS shift_id', 'st.full_name AS staff', 'br.name AS branch', 'c.label AS counter', 'sh.clocked_in_at', 'sh.clocked_out_at', 'sh.break_seconds', 'sh.auto_closed'],
  },
  {
    file: 'targets.csv', about: 'Current targets: the organisation row has no branch',
    key: 'x.k',
    from: `(SELECT CONCAT('0:', bt.business_id) AS k, bt.business_id, NULL AS branch_id, bt.target_wait_minutes, bt.target_completion_rate, bt.target_no_show_rate, bt.note, bt.updated_at
              FROM business_targets bt
            UNION ALL
            SELECT CONCAT('1:', brt.branch_id), brt.business_id, brt.branch_id, brt.target_wait_minutes, brt.target_completion_rate, brt.target_no_show_rate, brt.note, brt.updated_at
              FROM branch_targets brt) x LEFT JOIN branches br ON br.id = x.branch_id`,
    where: 'x.business_id = ?',
    columns: ["COALESCE(br.name, '(organisation)') AS scope", 'x.target_wait_minutes', 'x.target_completion_rate', 'x.target_no_show_rate', 'x.note', 'x.updated_at'],
  },
  {
    file: 'target_changes.csv', about: 'Every change to a target, with the reason given',
    key: 'tc.id', from: 'target_changes tc LEFT JOIN branches br ON br.id = tc.branch_id LEFT JOIN staff st ON st.id = tc.changed_by', where: 'tc.business_id = ?',
    columns: ['tc.id AS change_id', "COALESCE(br.name, '(organisation)') AS scope", 'tc.metric', 'tc.old_value', 'tc.new_value', 'tc.reason', 'st.full_name AS changed_by', 'tc.changed_at'],
  },
  {
    file: 'closures.csv', about: 'Closures and reduced-hours notices',
    key: 'cl.id', from: 'branch_closures cl LEFT JOIN branches br ON br.id = cl.branch_id', where: 'cl.business_id = ?',
    columns: ['cl.id AS closure_id', "COALESCE(br.name, '(all locations)') AS branch", 'cl.kind', 'cl.reason', `${D('cl.starts_on')} AS starts_on`, `${D('cl.ends_on')} AS ends_on`, 'cl.created_at', 'cl.lifted_at'],
  },
  {
    file: 'visitor_flags.csv', about: 'Flags staff placed on a visitor (for example priority), with the note',
    key: 'pf.id', from: 'patient_flags pf LEFT JOIN users u ON u.id = pf.user_id LEFT JOIN staff st ON st.id = pf.set_by_staff_id', where: 'pf.business_id = ?',
    columns: ['pf.id AS flag_id', 'u.full_name AS visitor_name', 'pf.flag', 'pf.note', 'st.full_name AS set_by', 'pf.created_at', 'pf.cleared_at'],
  },
  {
    file: 'audit_log.csv', about: 'Who did what in the admin application',
    key: 'al.id', from: 'audit_logs al LEFT JOIN staff st ON st.id = al.actor_id', where: 'al.business_id = ?',
    columns: ['al.id AS audit_id', 'al.created_at', 'al.actor_type', 'st.full_name AS staff', 'al.action', 'al.resource_type', 'al.resource_id', 'al.ip_address'],
  },
];

const headerOf = (column) => column.split(/\s+AS\s+/i).pop().split('.').pop().trim();

async function countDataset(db, dataset, businessId) {
  const [rows] = await db.query(`SELECT COUNT(*) AS n FROM ${dataset.from} WHERE ${dataset.where}`, [businessId]);
  return Number(rows[0].n);
}

/** One dataset as CSV, handed to write(text) a page at a time. Returns the row count. */
async function streamDataset(db, dataset, businessId, write) {
  const headers = dataset.columns.map(headerOf);
  const sql = `SELECT ${dataset.columns.join(', ')}, ${dataset.key} AS __k
                 FROM ${dataset.from}
                WHERE ${dataset.where} AND ${dataset.key} > ?
                ORDER BY ${dataset.key}
                LIMIT ${PAGE}`;
  // A UTF-8 byte-order mark, so Excel reads accented names correctly.
  write(`\ufeff${toCsv(headers, [])}`);
  let rows = 0;
  let last = '';
  for (;;) {
    const [page] = await db.query(sql, [businessId, last]);
    if (page.length) {
      const csv = toCsv(headers, page);
      write(csv.slice(csv.indexOf('\r\n') + 2));
      rows += page.length;
    }
    if (page.length < PAGE) break;
    last = page[page.length - 1].__k;
  }
  return rows;
}

/** What an export would contain: file names, descriptions and row counts. */
async function exportSummary(businessId, db = pool) {
  const out = [];
  for (const dataset of DATASETS) {
    out.push({ file: dataset.file, about: dataset.about, rows: await countDataset(db, dataset, businessId) });
  }
  return out;
}

/**
 * A full export, written into `zip` (a ZipWriter, or anything with begin /
 * write / end / add) a page at a time. Returns the manifest (file, about,
 * rows). The README is last, because it lists the counts.
 */
async function writeExport(businessId, { organisationName, requestedBy, at = new Date() } = {}, zip, db = pool) {
  const manifest = [];
  for (const dataset of DATASETS) {
    zip.begin(dataset.file);
    const rows = await streamDataset(db, dataset, businessId, (text) => zip.write(text));
    zip.end();
    manifest.push({ file: dataset.file, about: dataset.about, rows });
  }
  zip.add('README.txt', [
    `Lyne data export: ${organisationName || businessId}`,
    `Made ${at.toISOString()}${requestedBy ? ` by ${requestedBy}` : ''}.`,
    '',
    'These files hold the records Lyne keeps for your organisation. They are yours.',
    'Each file is a spreadsheet (CSV, UTF-8). Times are in UTC (ISO 8601); dates are calendar dates at the location.',
    '',
    'Files:',
    ...manifest.map((m) => `  ${m.file.padEnd(28)} ${String(m.rows).padStart(8)} rows   ${m.about}`),
    '',
    'Left out on purpose: passwords and sign-in identifiers, ticket verification codes,',
    'invitation and check-in codes, and app users\' own email addresses, phone numbers and',
    'dates of birth, which belong to the person. A walk-in\'s phone number appears where a',
    'clerk entered it for your organisation.',
    '',
    'This download is recorded in your audit log.',
    '',
  ].join('\r\n'));
  return manifest;
}

module.exports = { DATASETS, exportSummary, writeExport, streamDataset, headerOf, PAGE };

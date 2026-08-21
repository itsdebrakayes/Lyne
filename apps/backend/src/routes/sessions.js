/**
 * sessions.js — the front door to a queue you had to be entitled to join.
 *
 * Migration 027 built the session (a capped day you register for in advance);
 * 029 added the eligibility gate in front of it. This route is where the two
 * meet, and where the traffic-court flow designed in
 * docs/TRAFFIC_COURT_FLOW_DESIGN.md actually runs.
 *
 * THE SHAPE OF IT
 *
 *   check eligibility ─▶ register (get an access code) ─▶ check in (get a ticket)
 *
 * After the third step nothing is session-specific ever again: the person holds
 * an ordinary queue_ticket and every existing mechanism — position, ETA,
 * calling, counters, the verification code at the desk, served/no-show
 * analytics — applies untouched. `session_registrations.queue_ticket_id` is that
 * seam, and it is deliberately the only thing linking the two halves.
 *
 * FOUR RULES THIS FILE ENFORCES, EACH FOR A REASON
 *
 * 1. Eligibility DEGRADES, it does not block. A court whose IT could not send
 *    this morning's cause list must still be able to run its day. No list loaded
 *    means a code is still issued and the registration is flagged `verified: 0`,
 *    which the clerk's board shows. What we must never do is display a checked
 *    entitlement and an unchecked one identically.
 *
 * 2. The public half is UNAUTHENTICATED. A motorist under a court deadline will
 *    not install an app and create an account first — if they have to, the
 *    product is useless to them and therefore to the court. So the portal path
 *    takes no token, and the cost of that is paid in rate limiting and in
 *    never leaking anything an attacker did not already know.
 *
 * 3. The eligibility endpoint is an ENUMERATION ORACLE by nature — it answers
 *    "does this reference exist". Mitigated three ways: a hard rate limit, an
 *    optional second factor, and one single generic failure message so "no such
 *    ticket" and "wrong surname" are indistinguishable from outside.
 *
 * 4. Capacity is real. The whole promise of registering in advance is that the
 *    cap is enforced, because people travel across the island on the strength of
 *    it. Counting and inserting therefore happen under a row lock, not
 *    optimistically.
 */
const router = require('express').Router();
const crypto = require('crypto');
const { randomUUID: uuidv4 } = require('crypto');
const { z } = require('zod');
const pool = require('../db/pool');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const {
  requireStaffRole, requireBranchAccess, assertBusinessAccess,
  scopedBusinessId, scopedBranchId, roleName,
} = require('../middleware/tenantAccess');
const { auditLog } = require('../middleware/auditLog');
const { SECTOR_JOIN, SECTOR_COLUMNS, withTerms } = require('../utils/sectorTerms');
const { issueTicketSlot } = require('../utils/ticketSlot');

/** Statuses a member of the public is allowed to see at all. */
const PUBLIC_STATUSES = ['open', 'closed', 'in_progress'];

/** Registrations that occupy a capped place. `cancelled` and `no_show` do not. */
const HOLDS_A_PLACE = ['registered', 'checked_in'];

/**
 * One message for every eligibility failure. Distinguishing "that ticket is not
 * listed today" from "that surname does not match" would hand an attacker a
 * free confirmation that the ticket exists. The clerk at the counter can be
 * told the difference in person; an anonymous HTTP client cannot.
 */
const ELIGIBILITY_DENIED =
  'We could not find a matter listed for today against those details. Check them against your ticket, or contact the office directly.';

// ── Codes ────────────────────────────────────────────────────

/**
 * The access code, read off a screen and typed at a door, sometimes days later,
 * sometimes off a photograph of a screen. So: no O/0, no I/1/L, no U/V, no 5/S,
 * no 8/B. Eight characters from a 26-symbol alphabet is ~37 bits, which is far
 * more than a session of a few thousand needs, and the uniqueness constraint
 * (session_id, registration_code) catches the rest.
 */
const CODE_ALPHABET = 'ACDEFGHJKMNPQRTWXY34679';

function createRegistrationCode() {
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * What we match references on. People type ticket numbers with spaces, dashes,
 * and in lowercase; a court exports them one canonical way. Both sides go
 * through here, so "tk 4471-22", "TK4471/22" and "tk-4471-22" are one key.
 */
function referenceKey(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Surnames are compared loosely and on purpose. A person filling this in has a
 * court date and is anxious; "O'Brien" vs "OBrien" vs "Obrien" must not be the
 * thing that stops them. The surname is a second factor against guessing, not
 * an identity assertion — the clerk still sees the summons at the counter.
 */
function surnameKey(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z]/g, '');
}

// ── Shaping ──────────────────────────────────────────────────

const SESSION_SELECT = `
  ss.id, ss.business_id, ss.branch_id, ss.service_id, ss.queue_id,
  ss.name, ss.description, ss.venue_name, ss.venue_address,
  -- A calendar date, formatted as one. Left as a DATE it comes back through the
  -- driver as a Date object pinned to local midnight, so a client in any other
  -- zone renders the Saturday sitting as the Friday. A court date is not an
  -- instant and must not carry a timezone.
  DATE_FORMAT(ss.session_date, '%Y-%m-%d') AS session_date,
  ss.starts_at, ss.ends_at, ss.capacity,
  ss.requires_eligibility, ss.second_factor,
  ss.registration_opens_at, ss.registration_closes_at,
  ss.arrive_minutes_before, ss.status,
  b.name AS business_name, b.sector,
  br.name AS branch_name, br.address AS branch_address,
  sv.name AS service_name,
  (SELECT COUNT(*) FROM session_registrations r
    WHERE r.session_id = ss.id AND r.status IN ('registered','checked_in')) AS registered_count,
  (SELECT COUNT(*) FROM session_registrations r
    WHERE r.session_id = ss.id AND r.status = 'checked_in') AS checked_in_count,
  (SELECT COUNT(*) FROM session_cause_list cl WHERE cl.session_id = ss.id) AS cause_list_count
`;

const SESSION_FROM = `
  FROM scheduled_sessions ss
  JOIN businesses b ON b.id = ss.business_id
  ${SECTOR_JOIN}
  LEFT JOIN branches br ON br.id = ss.branch_id
  LEFT JOIN services sv ON sv.id = ss.service_id
`;

function shapeSession(row) {
  if (!row) return row;
  const capacity = Number(row.capacity) || 0;
  const registered = Number(row.registered_count) || 0;
  return withTerms({
    ...row,
    requires_eligibility: Boolean(row.requires_eligibility),
    capacity,
    registered_count: registered,
    checked_in_count: Number(row.checked_in_count) || 0,
    // The number people actually act on. Never negative: an over-subscribed
    // session (staff registered past the cap on purpose) should read 0 places
    // left, not "-3 places left".
    places_remaining: Math.max(0, capacity - registered),
    cause_list_count: Number(row.cause_list_count) || 0,
    // Where the session physically happens. 027 refuses to invent a branch row
    // for a hired venue, so the caller would otherwise have to know which of two
    // fields to read.
    location_name: row.venue_name || row.branch_name || null,
    location_address: row.venue_address || row.branch_address || null,
  });
}

/**
 * Is the registration window open right now? Both bounds are optional and each
 * NULL means "unbounded on that side" — a session with neither accepts
 * registrations for as long as its status says `open`, which is how a same-day
 * ordinary sitting works.
 */
function registrationWindow(session, now = new Date()) {
  if (session.status !== 'open') {
    return { open: false, reason: session.status === 'closed'
      ? 'Registration for this session has closed.'
      : 'This session is not accepting registrations.' };
  }
  if (session.registration_opens_at && now < new Date(session.registration_opens_at)) {
    return { open: false, reason: 'Registration for this session has not opened yet.' };
  }
  if (session.registration_closes_at && now > new Date(session.registration_closes_at)) {
    return { open: false, reason: 'Registration for this session has closed.' };
  }
  return { open: true };
}

/**
 * Decide whether a reference entitles somebody to a place.
 *
 * Returns `verified` separately from `eligible` because they are different
 * claims and the clerk's board depends on the difference:
 *   eligible=true, verified=true   — matched against the list the court gave us
 *   eligible=true, verified=false  — nothing to check against; self-declared
 *   eligible=false                 — there IS a list and they are not on it
 */
async function evaluateEligibility(conn, session, { reference, surname }) {
  if (!session.requires_eligibility) {
    return { eligible: true, verified: false, gate: 'none', division: null };
  }

  const [[counts]] = await conn.query(
    'SELECT COUNT(*) AS cnt FROM session_cause_list WHERE session_id = ?',
    [session.id]
  );
  // Rule 1: degrade, do not block. No list means we cannot check, which is not
  // the same as the person being ineligible.
  if (!Number(counts.cnt)) {
    return { eligible: true, verified: false, gate: 'no_list', division: null };
  }

  const key = referenceKey(reference);
  if (!key) return { eligible: false, verified: false, gate: 'listed', division: null };

  const [rows] = await conn.query(
    'SELECT reference, party_surname, division FROM session_cause_list WHERE session_id = ? AND reference_key = ? LIMIT 1',
    [session.id, key]
  );
  if (!rows.length) {
    return { eligible: false, verified: false, gate: 'listed', division: null };
  }

  const entry = rows[0];
  if (session.second_factor === 'surname') {
    const given = surnameKey(surname);
    const held = surnameKey(entry.party_surname);
    // A list row with no surname cannot be second-factored. Failing closed here
    // would lock out people whose own court supplied an incomplete file, so the
    // match passes and `verified` still tells the truth.
    if (held && (!given || !held.startsWith(given.slice(0, 4)))) {
      return { eligible: false, verified: false, gate: 'listed', division: null };
    }
  }

  return { eligible: true, verified: true, gate: 'listed', division: entry.division || null };
}

/**
 * Which queue does checking in to this session join?
 *
 * Explicit `queue_id` wins. Otherwise resolve today's queue for the session's
 * branch + service, creating it if the day has not opened one yet — the same
 * ensure-then-lock the walk-in path uses. A session at a hired venue with no
 * branch and no explicit queue cannot be resolved, and says so rather than
 * silently putting people in some other branch's line.
 */
async function resolveQueue(conn, session) {
  if (session.queue_id) {
    const [rows] = await conn.query('SELECT * FROM queues WHERE id = ? FOR UPDATE', [session.queue_id]);
    if (rows.length) return rows[0];
  }
  if (!session.branch_id || !session.service_id) return null;

  const today = new Date().toISOString().slice(0, 10);
  await conn.query(
    `INSERT INTO queues (id, branch_id, service_id, queue_date, max_capacity)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE is_active = TRUE`,
    [uuidv4(), session.branch_id, session.service_id, today, Math.max(50, Number(session.capacity) || 50)]
  );
  const [rows] = await conn.query(
    'SELECT * FROM queues WHERE branch_id = ? AND service_id = ? AND queue_date = ? FOR UPDATE',
    [session.branch_id, session.service_id, today]
  );
  return rows[0] || null;
}

function broadcast(queueId, ticket) {
  try {
    const { broadcastQueueUpdate } = require('./sse');
    broadcastQueueUpdate(queueId, ticket).catch(() => {});
  } catch { /* sse module not yet loaded */ }
}

function validationMessage(error) {
  return error.issues?.[0]?.message || 'Invalid request data.';
}

// ── Schemas ──────────────────────────────────────────────────

const eligibilitySchema = z.object({
  reference: z.string().trim().min(1, 'Enter your reference number.').max(60),
  surname:   z.string().trim().max(120).optional(),
});

const registerSchema = eligibilitySchema.extend({
  name:  z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Enter a valid email address.').max(160).optional(),
});

const checkInSchema = z.object({
  code: z.string().trim().min(4, 'Enter your access code.').max(12),
});

const createSessionSchema = z.object({
  business_id:   z.string().max(64).optional(),
  branch_id:     z.string().max(64).nullish(),
  service_id:    z.string().max(64).nullish(),
  queue_id:      z.string().max(64).nullish(),
  name:          z.string().trim().min(1, 'Give the session a name.').max(140),
  description:   z.string().trim().max(400).nullish(),
  venue_name:    z.string().trim().max(160).nullish(),
  venue_address: z.string().trim().max(255).nullish(),
  session_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'session_date must be YYYY-MM-DD.'),
  starts_at:     z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'starts_at must be HH:MM.'),
  ends_at:       z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullish(),
  capacity:      z.number().int().min(1, 'Capacity must be at least 1.').max(100000),
  requires_eligibility: z.boolean().optional(),
  second_factor: z.enum(['none', 'surname']).optional(),
  registration_opens_at:  z.string().max(40).nullish(),
  registration_closes_at: z.string().max(40).nullish(),
  arrive_minutes_before:  z.number().int().min(0).max(600).nullish(),
  status: z.enum(['draft', 'open', 'closed', 'in_progress', 'completed', 'cancelled']).optional(),
});

const causeListSchema = z.object({
  replace: z.boolean().optional(),
  entries: z.array(z.object({
    reference: z.string().trim().min(1).max(60),
    surname:   z.string().trim().max(120).nullish(),
    division:  z.string().trim().max(80).nullish(),
  })).min(1, 'The list is empty.').max(20000),
});

// ═════════════════════════════════════════════════════════════
// PUBLIC — no account, no token. See rule 2 at the top of the file.
// ═════════════════════════════════════════════════════════════

// GET /api/sessions/public?business_id= — what is coming up
//
// Deliberately shows `closed` and `in_progress` alongside `open`: somebody who
// registered last week still needs to find their session on the day, and a
// person who missed the window needs to see that it closed rather than that it
// vanished. `draft` and `cancelled` are never public.
router.get('/public', async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    const where = [`ss.status IN (${PUBLIC_STATUSES.map(() => '?').join(',')})`, 'ss.session_date >= CURDATE()'];
    const params = [...PUBLIC_STATUSES];
    if (business_id) { where.push('ss.business_id = ?'); params.push(business_id); }
    if (branch_id)   { where.push('ss.branch_id = ?');   params.push(branch_id); }

    const [rows] = await pool.query(
      `SELECT ${SESSION_SELECT}, ${SECTOR_COLUMNS} ${SESSION_FROM}
        WHERE ${where.join(' AND ')}
        ORDER BY ss.session_date, ss.starts_at
        LIMIT 100`,
      params
    );
    res.json(rows.map(shapeSession));
  } catch (err) {
    console.error('sessions/public:', err);
    res.status(500).json({ error: 'Failed to load sessions.' });
  }
});

// GET /api/sessions/public/:id — one session, for the portal page
router.get('/public/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${SESSION_SELECT}, ${SECTOR_COLUMNS} ${SESSION_FROM}
        WHERE ss.id = ? AND ss.status IN (${PUBLIC_STATUSES.map(() => '?').join(',')})
        LIMIT 1`,
      [req.params.id, ...PUBLIC_STATUSES]
    );
    if (!rows.length) return res.status(404).json({ error: 'Session not found.' });
    res.json(shapeSession(rows[0]));
  } catch (err) {
    console.error('sessions/public/:id:', err);
    res.status(500).json({ error: 'Failed to load session.' });
  }
});

// POST /api/sessions/public/:id/eligibility — "am I listed today?"
//
// Answers the question WITHOUT issuing anything or writing anything, so the
// portal can show the answer before asking for contact details. Rule 3 governs
// what may come back out of here.
router.post('/public/:id/eligibility', async (req, res) => {
  const parsed = eligibilitySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed.error) });

  try {
    const [rows] = await pool.query(
      `SELECT ${SESSION_SELECT} ${SESSION_FROM} WHERE ss.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!rows.length || !PUBLIC_STATUSES.includes(rows[0].status)) {
      return res.status(404).json({ error: 'Session not found.' });
    }
    const session = rows[0];
    const result = await evaluateEligibility(pool, session, parsed.data);

    if (!result.eligible) {
      return res.status(404).json({ eligible: false, error: ELIGIBILITY_DENIED });
    }
    res.json({
      eligible: true,
      verified: result.verified,
      // Honest about which of the two "yes"es this is, so the portal can say
      // "we could not check this against today's list" rather than implying a
      // confirmation the court never gave.
      checked_against_list: result.gate === 'listed',
      division: result.division,
      session_id: session.id,
      arrive_minutes_before: session.arrive_minutes_before,
    });
  } catch (err) {
    console.error('sessions eligibility:', err);
    res.status(500).json({ error: 'Failed to check eligibility.' });
  }
});

// POST /api/sessions/public/:id/register — take a place, get an access code
//
// Optionally authenticated: a mobile user's registration is linked to their
// account so it shows up under "my registrations", while the same endpoint
// serves an anonymous browser with no account at all.
router.post('/public/:id/register', optionalAuth, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed.error) });
  const { reference, surname, name, phone, email } = parsed.data;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // FOR UPDATE: rule 4. Two people registering for the last place at the same
    // moment must not both be told yes.
    const [rows] = await conn.query(
      `SELECT ${SESSION_SELECT} ${SESSION_FROM} WHERE ss.id = ? FOR UPDATE`,
      [req.params.id]
    );
    if (!rows.length || !PUBLIC_STATUSES.includes(rows[0].status)) {
      await conn.rollback();
      return res.status(404).json({ error: 'Session not found.' });
    }
    const session = rows[0];

    const window = registrationWindow(session);
    if (!window.open) {
      await conn.rollback();
      return res.status(409).json({ error: window.reason });
    }

    const eligibility = await evaluateEligibility(conn, session, { reference, surname });
    if (!eligibility.eligible) {
      await conn.rollback();
      return res.status(404).json({ eligible: false, error: ELIGIBILITY_DENIED });
    }

    // Registering twice with the same reference returns the FIRST code rather
    // than issuing a second. Somebody who closes the tab and comes back has not
    // earned two places, and must not be told their first code is invalid.
    const key = referenceKey(reference);
    const [existing] = await conn.query(
      `SELECT id, registration_code, status, verified
         FROM session_registrations
        WHERE session_id = ? AND UPPER(REGEXP_REPLACE(COALESCE(reference,''), '[^A-Za-z0-9]', '')) = ?
          AND status IN ('registered','checked_in')
        LIMIT 1`,
      [session.id, key]
    );
    if (existing.length) {
      await conn.commit();
      return res.status(200).json({
        already_registered: true,
        registration_id: existing[0].id,
        registration_code: existing[0].registration_code,
        status: existing[0].status,
        verified: Boolean(existing[0].verified),
        session: shapeSession(session),
      });
    }

    const [[held]] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM session_registrations
        WHERE session_id = ? AND status IN ('registered','checked_in')`,
      [session.id]
    );
    if (Number(held.cnt) >= Number(session.capacity)) {
      await conn.rollback();
      return res.status(409).json({
        error: 'This session is full. No further places are available.',
        places_remaining: 0,
      });
    }

    const registrationId = uuidv4();
    const code = createRegistrationCode();
    await conn.query(
      `INSERT INTO session_registrations
         (id, session_id, user_id, guest_name, guest_phone, guest_email, reference, verified, registration_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        registrationId, session.id, req.dbUser?.id || null,
        name || null, phone || null, email || null,
        reference, eligibility.verified ? 1 : 0, code,
      ]
    );

    await conn.commit();
    res.status(201).json({
      registration_id: registrationId,
      registration_code: code,
      verified: eligibility.verified,
      checked_against_list: eligibility.gate === 'listed',
      division: eligibility.division,
      places_remaining: Math.max(0, Number(session.capacity) - Number(held.cnt) - 1),
      session: shapeSession(session),
    });
  } catch (err) {
    await conn.rollback();
    console.error('sessions register:', err);
    res.status(500).json({ error: 'Failed to register for this session.' });
  } finally {
    conn.release();
  }
});

// POST /api/sessions/public/:id/check-in — code in, queue ticket out
//
// This is the seam. Everything before it is session machinery; everything after
// it is the ordinary queue, and nothing downstream needs to know a session was
// involved.
router.post('/public/:id/check-in', optionalAuth, (req, res) => checkIn(req, res, 'web'));

// ═════════════════════════════════════════════════════════════
// SHARED — check-in, used by both the portal and the clerk's desk
// ═════════════════════════════════════════════════════════════

async function checkIn(req, res, channel) {
  const parsed = checkInSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed.error) });

  // Codes are shown grouped ("ACDE-4679") but people type them however they
  // like, so normalise before matching rather than demanding the hyphen.
  const typed = parsed.data.code.trim().toUpperCase();
  const compact = typed.replace(/[^A-Z0-9]/g, '');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [sessions] = await conn.query(
      `SELECT ${SESSION_SELECT} ${SESSION_FROM} WHERE ss.id = ? LIMIT 1`,
      [req.params.id]
    );
    if (!sessions.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'Session not found.' });
    }
    const session = sessions[0];

    if (session.status === 'cancelled') {
      await conn.rollback();
      return res.status(409).json({ error: 'This session has been cancelled.' });
    }
    if (session.status === 'draft') {
      await conn.rollback();
      return res.status(404).json({ error: 'Session not found.' });
    }

    const [regs] = await conn.query(
      `SELECT * FROM session_registrations
        WHERE session_id = ?
          AND UPPER(REPLACE(registration_code, '-', '')) = ?
        LIMIT 1 FOR UPDATE`,
      [session.id, compact]
    );
    if (!regs.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'That access code was not recognised for this session.' });
    }
    const registration = regs[0];

    if (registration.status === 'cancelled') {
      await conn.rollback();
      return res.status(409).json({ error: 'This registration was cancelled.' });
    }
    // Checking in twice is a person pressing a button again, not an error worth
    // punishing. Hand back the ticket they already have.
    if (registration.status === 'checked_in' && registration.queue_ticket_id) {
      const [[ticket]] = await conn.query('SELECT * FROM queue_tickets WHERE id = ?', [registration.queue_ticket_id]);
      await conn.commit();
      return res.status(200).json({ already_checked_in: true, registration_id: registration.id, ticket });
    }

    // Check-in is a same-day act by definition: it puts you in TODAY's line.
    // Allowing it early would create a ticket in a queue nobody is calling from.
    const [[dateCheck]] = await conn.query(
      'SELECT DATEDIFF(?, CURDATE()) AS delta', [session.session_date]
    );
    if (Number(dateCheck.delta) > 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'Check-in opens on the day of the session.' });
    }
    if (Number(dateCheck.delta) < 0) {
      await conn.rollback();
      return res.status(409).json({ error: 'This session has already taken place.' });
    }

    const queue = await resolveQueue(conn, session);
    if (!queue) {
      await conn.rollback();
      // A configuration fault, not the visitor's fault — say so plainly rather
      // than blaming their code.
      return res.status(409).json({
        error: 'This session has no line configured yet. Please see a member of staff.',
      });
    }

    const [[svc]] = await conn.query(
      'SELECT ticket_prefix, base_avg_time_minutes FROM services WHERE id = ? LIMIT 1',
      [queue.service_id]
    );
    const [[waiting]] = await conn.query(
      "SELECT COUNT(*) AS cnt FROM queue_tickets WHERE queue_id = ? AND status = 'waiting'",
      [queue.id]
    );

    const { position, ticketNumber, estimatedWait, verificationCode } = await issueTicketSlot(conn, {
      queueId: queue.id,
      branchId: queue.branch_id,
      serviceId: queue.service_id,
      prefix: svc?.ticket_prefix,
      avgTimeMinutes: svc?.base_avg_time_minutes,
      waitingAhead: Number(waiting.cnt),
    });

    // A guest checking in from the portal has no account, so the token is the
    // only way they can come back to their own ticket — and the only thing
    // stopping anyone else reading it (migration 023).
    const guestToken = registration.user_id ? null : crypto.randomBytes(32).toString('base64url');

    const ticketId = uuidv4();
    await conn.query(
      `INSERT INTO queue_tickets
         (id, queue_id, user_id, guest_name, guest_phone, guest_access_token,
          ticket_number, verification_code, position, status, estimated_wait_minutes, channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?)`,
      [
        ticketId, queue.id, registration.user_id || null,
        registration.guest_name || null, registration.guest_phone || null, guestToken,
        ticketNumber, verificationCode, position, estimatedWait, channel,
      ]
    );
    await conn.query(
      `INSERT INTO queue_events (id, ticket_id, previous_status, new_status)
       VALUES (?, ?, NULL, 'waiting')`,
      [uuidv4(), ticketId]
    );

    await conn.query(
      `UPDATE session_registrations
          SET status = 'checked_in', checked_in_at = NOW(), queue_ticket_id = ?
        WHERE id = ?`,
      [ticketId, registration.id]
    );

    // A session that starts taking check-ins is running, whatever its status
    // said this morning. Saves the clerk a step they would forget.
    if (session.status === 'open' || session.status === 'closed') {
      await conn.query("UPDATE scheduled_sessions SET status = 'in_progress' WHERE id = ?", [session.id]);
    }

    await conn.commit();
    const [[ticket]] = await conn.query('SELECT * FROM queue_tickets WHERE id = ?', [ticketId]);
    broadcast(queue.id, ticket);

    res.status(201).json({
      registration_id: registration.id,
      reference: registration.reference,
      verified: Boolean(registration.verified),
      ticket,
      // Returned once, at creation. It is not readable from any later response.
      guest_access_token: guestToken,
    });
  } catch (err) {
    await conn.rollback();
    console.error('sessions check-in:', err);
    res.status(500).json({ error: 'Failed to check in.' });
  } finally {
    conn.release();
  }
}

// ═════════════════════════════════════════════════════════════
// AUTHENTICATED USER
// ═════════════════════════════════════════════════════════════

// GET /api/sessions/mine — "what have I got booked?"
router.get('/mine', requireAuth, async (req, res) => {
  try {
    if (!req.dbUser) return res.json([]);
    const [rows] = await pool.query(
      `SELECT r.id AS registration_id, r.registration_code, r.reference, r.verified,
              r.status AS registration_status, r.registered_at, r.checked_in_at, r.queue_ticket_id,
              ${SESSION_SELECT}, ${SECTOR_COLUMNS}
         FROM session_registrations r
         JOIN scheduled_sessions ss ON ss.id = r.session_id
         JOIN businesses b ON b.id = ss.business_id
         ${SECTOR_JOIN}
         LEFT JOIN branches br ON br.id = ss.branch_id
         LEFT JOIN services sv ON sv.id = ss.service_id
        WHERE r.user_id = ? AND r.status IN ('registered','checked_in')
        ORDER BY ss.session_date, ss.starts_at`,
      [req.dbUser.id]
    );
    res.json(rows.map((row) => ({
      registration_id: row.registration_id,
      registration_code: row.registration_code,
      reference: row.reference,
      verified: Boolean(row.verified),
      registration_status: row.registration_status,
      registered_at: row.registered_at,
      checked_in_at: row.checked_in_at,
      queue_ticket_id: row.queue_ticket_id,
      session: shapeSession(row),
    })));
  } catch (err) {
    console.error('sessions/mine:', err);
    res.status(500).json({ error: 'Failed to load your registrations.' });
  }
});

// ═════════════════════════════════════════════════════════════
// STAFF
// ═════════════════════════════════════════════════════════════

const STAFF_VIEW = ['supervisor', 'manager', 'executive'];
const STAFF_EDIT = ['manager', 'executive'];

/** Loads a session and proves the caller's tenant owns it. */
async function loadOwnedSession(req, res) {
  const [rows] = await pool.query(
    `SELECT ${SESSION_SELECT} ${SESSION_FROM} WHERE ss.id = ? LIMIT 1`,
    [req.params.id]
  );
  if (!rows.length) {
    res.status(404).json({ error: 'Session not found.' });
    return null;
  }
  const session = rows[0];
  if (!assertBusinessAccess(req, session.business_id)) {
    res.status(403).json({ error: 'You do not have access to this session.' });
    return null;
  }
  // A branch-scoped role may only touch sessions at their own branch. A session
  // with no branch (a hired venue) is company-level, so it stays with executives.
  const scoped = scopedBranchId(req, session.branch_id);
  if (scoped && session.branch_id && scoped !== session.branch_id) {
    res.status(403).json({ error: 'You do not have access to this session.' });
    return null;
  }
  if (!session.branch_id && !['executive', 'platform_admin'].includes(roleName(req))) {
    res.status(403).json({ error: 'Only an executive can manage a session held away from a branch.' });
    return null;
  }
  return session;
}

// GET /api/sessions?from=&to= — the admin list
router.get('/', requireAuth, requireStaffRole(...STAFF_VIEW), async (req, res) => {
  try {
    const businessId = scopedBusinessId(req, req.query.business_id);
    if (!businessId) return res.status(400).json({ error: 'business_id is required.' });
    if (!assertBusinessAccess(req, businessId)) {
      return res.status(403).json({ error: 'You do not have access to this business.' });
    }

    const where = ['ss.business_id = ?'];
    const params = [businessId];

    // Managers and supervisors see their own branch's sessions plus the
    // company-level ones held at a venue, which they may still be staffing.
    const branchScope = scopedBranchId(req, req.query.branch_id);
    if (branchScope) {
      where.push('(ss.branch_id = ? OR ss.branch_id IS NULL)');
      params.push(branchScope);
    }
    if (req.query.from) { where.push('ss.session_date >= ?'); params.push(req.query.from); }
    if (req.query.to)   { where.push('ss.session_date <= ?'); params.push(req.query.to); }
    if (req.query.status) { where.push('ss.status = ?'); params.push(req.query.status); }

    const [rows] = await pool.query(
      `SELECT ${SESSION_SELECT}, ${SECTOR_COLUMNS} ${SESSION_FROM}
        WHERE ${where.join(' AND ')}
        ORDER BY ss.session_date DESC, ss.starts_at
        LIMIT 200`,
      params
    );
    res.json(rows.map(shapeSession));
  } catch (err) {
    console.error('sessions list:', err);
    res.status(500).json({ error: 'Failed to load sessions.' });
  }
});

// POST /api/sessions — create one
router.post('/', requireAuth, requireStaffRole(...STAFF_EDIT), requireBranchAccess,
  auditLog('session_create', 'scheduled_session'), async (req, res) => {
    const parsed = createSessionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed.error) });
    const data = parsed.data;

    try {
      const businessId = scopedBusinessId(req, data.business_id);
      if (!businessId || !assertBusinessAccess(req, businessId)) {
        return res.status(403).json({ error: 'You do not have access to this business.' });
      }
      const branchId = data.branch_id ? scopedBranchId(req, data.branch_id) : null;

      // A venue session is a company-level commitment (027 declines to invent a
      // branch row for the National Arena), so it is an executive's to make.
      if (!branchId && !['executive', 'platform_admin'].includes(roleName(req))) {
        return res.status(403).json({ error: 'Only an executive can create a session held away from a branch.' });
      }

      const id = uuidv4();
      await pool.query(
        `INSERT INTO scheduled_sessions
           (id, business_id, branch_id, service_id, queue_id, name, description,
            venue_name, venue_address, session_date, starts_at, ends_at, capacity,
            requires_eligibility, second_factor,
            registration_opens_at, registration_closes_at, arrive_minutes_before, status)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          id, businessId, branchId, data.service_id || null, data.queue_id || null,
          data.name, data.description || null,
          data.venue_name || null, data.venue_address || null,
          data.session_date, data.starts_at, data.ends_at || null, data.capacity,
          data.requires_eligibility ? 1 : 0, data.second_factor || 'none',
          data.registration_opens_at || null, data.registration_closes_at || null,
          data.arrive_minutes_before ?? null, data.status || 'draft',
        ]
      );

      const [rows] = await pool.query(
        `SELECT ${SESSION_SELECT}, ${SECTOR_COLUMNS} ${SESSION_FROM} WHERE ss.id = ?`, [id]
      );
      res.status(201).json(shapeSession(rows[0]));
    } catch (err) {
      console.error('sessions create:', err);
      res.status(500).json({ error: 'Failed to create session.' });
    }
  });

// GET /api/sessions/:id — one session, staff view
router.get('/:id', requireAuth, requireStaffRole(...STAFF_VIEW), async (req, res) => {
  try {
    const session = await loadOwnedSession(req, res);
    if (!session) return;
    const [rows] = await pool.query(
      `SELECT ${SESSION_SELECT}, ${SECTOR_COLUMNS} ${SESSION_FROM} WHERE ss.id = ?`, [session.id]
    );
    res.json(shapeSession(rows[0]));
  } catch (err) {
    console.error('sessions get:', err);
    res.status(500).json({ error: 'Failed to load session.' });
  }
});

// PUT /api/sessions/:id — update
router.put('/:id', requireAuth, requireStaffRole(...STAFF_EDIT),
  auditLog('session_update', 'scheduled_session'), async (req, res) => {
    const parsed = createSessionSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed.error) });

    try {
      const session = await loadOwnedSession(req, res);
      if (!session) return;

      const FIELDS = [
        'branch_id', 'service_id', 'queue_id', 'name', 'description', 'venue_name', 'venue_address',
        'session_date', 'starts_at', 'ends_at', 'capacity', 'second_factor',
        'registration_opens_at', 'registration_closes_at', 'arrive_minutes_before', 'status',
      ];
      const sets = [];
      const params = [];
      for (const field of FIELDS) {
        if (parsed.data[field] !== undefined) {
          sets.push(`${field} = ?`);
          params.push(parsed.data[field] === '' ? null : parsed.data[field]);
        }
      }
      if (parsed.data.requires_eligibility !== undefined) {
        sets.push('requires_eligibility = ?');
        params.push(parsed.data.requires_eligibility ? 1 : 0);
      }
      if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });

      // Lowering capacity below what is already committed would silently
      // invalidate places people are holding. Refuse rather than quietly
      // over-subscribe.
      if (parsed.data.capacity !== undefined && Number(parsed.data.capacity) < Number(session.registered_count)) {
        return res.status(409).json({
          error: `${session.registered_count} places are already taken. Capacity cannot be set below that.`,
        });
      }

      params.push(session.id);
      await pool.query(`UPDATE scheduled_sessions SET ${sets.join(', ')} WHERE id = ?`, params);

      const [rows] = await pool.query(
        `SELECT ${SESSION_SELECT}, ${SECTOR_COLUMNS} ${SESSION_FROM} WHERE ss.id = ?`, [session.id]
      );
      res.json(shapeSession(rows[0]));
    } catch (err) {
      console.error('sessions update:', err);
      res.status(500).json({ error: 'Failed to update session.' });
    }
  });

// GET /api/sessions/:id/registrations — the clerk's board for the day
router.get('/:id/registrations', requireAuth, requireStaffRole(...STAFF_VIEW, 'line_staff', 'kiosk_clerk'), async (req, res) => {
  try {
    const session = await loadOwnedSession(req, res);
    if (!session) return;

    const where = ['r.session_id = ?'];
    const params = [session.id];
    if (req.query.status) { where.push('r.status = ?'); params.push(req.query.status); }
    if (req.query.q) {
      where.push('(r.reference LIKE ? OR r.guest_name LIKE ? OR r.registration_code LIKE ?)');
      const like = `%${req.query.q}%`;
      params.push(like, like, like);
    }

    const [rows] = await pool.query(
      `SELECT r.id, r.registration_code, r.reference, r.verified, r.status,
              r.guest_name, r.guest_phone, r.guest_email,
              r.registered_at, r.checked_in_at, r.queue_ticket_id,
              u.full_name AS user_name,
              t.ticket_number, t.status AS ticket_status, t.position
         FROM session_registrations r
         LEFT JOIN users u ON u.id = r.user_id
         LEFT JOIN queue_tickets t ON t.id = r.queue_ticket_id
        WHERE ${where.join(' AND ')}
        ORDER BY r.checked_in_at IS NULL, r.checked_in_at, r.registered_at
        LIMIT 1000`,
      params
    );

    /* The court's own summary of its day: who is expected, who came, who did
       not, and how much of it we could actually vouch for.

       Computed by SQL over the WHOLE session, deliberately — NOT by counting
       the rows above. Those rows are filtered by ?status and ?q and capped at
       1000, so deriving the summary from them would mean a clerk typing a name
       into the search box watched "Arrived" fall from 41 to 1. It would also
       disagree with registered_count on the session itself, which is a separate
       SQL count — two numbers for one fact on one screen, which is the exact
       failure this codebase keeps having to fix. */
    const [[counts]] = await pool.query(
      `SELECT
         SUM(status = 'registered')  AS registered,
         SUM(status = 'checked_in')  AS checked_in,
         SUM(status = 'no_show')     AS no_show,
         SUM(status = 'cancelled')   AS cancelled,
         SUM(verified = 0 AND status <> 'cancelled') AS unverified
       FROM session_registrations WHERE session_id = ?`,
      [session.id]
    );

    res.json({
      session: shapeSession(session),
      summary: {
        registered: Number(counts.registered) || 0,
        checked_in: Number(counts.checked_in) || 0,
        no_show: Number(counts.no_show) || 0,
        cancelled: Number(counts.cancelled) || 0,
        unverified: Number(counts.unverified) || 0,
      },
      // True when the list below is not the whole session — so the screen can
      // say so rather than letting a 1000-row cap read as "that is everybody".
      truncated: rows.length >= 1000,
      registrations: rows.map((r) => ({ ...r, verified: Boolean(r.verified) })),
    });
  } catch (err) {
    console.error('sessions registrations:', err);
    res.status(500).json({ error: 'Failed to load registrations.' });
  }
});

// POST /api/sessions/:id/registrations — a clerk registers somebody at the door
//
// Not optional, and not a convenience. A court cannot exclude people without
// smartphones from a mandatory court date, so the staff-assisted path is the
// difference between a lawful process and an unlawful one.
router.post('/:id/registrations', requireAuth,
  requireStaffRole(...STAFF_VIEW, 'kiosk_clerk'),
  auditLog('session_register_on_behalf', 'session_registration'), async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed.error) });

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [rows] = await conn.query(
        `SELECT ${SESSION_SELECT} ${SESSION_FROM} WHERE ss.id = ? FOR UPDATE`, [req.params.id]
      );
      if (!rows.length) { await conn.rollback(); return res.status(404).json({ error: 'Session not found.' }); }
      const session = rows[0];
      if (!assertBusinessAccess(req, session.business_id)) {
        await conn.rollback();
        return res.status(403).json({ error: 'You do not have access to this session.' });
      }

      const eligibility = await evaluateEligibility(conn, session, parsed.data);
      // Staff may override the gate — they are looking at the paperwork. The
      // registration is still recorded as unverified, so the override is
      // visible on the board rather than laundered into a clean row.
      const overridden = !eligibility.eligible;

      const [[held]] = await conn.query(
        `SELECT COUNT(*) AS cnt FROM session_registrations
          WHERE session_id = ? AND status IN ('registered','checked_in')`,
        [session.id]
      );
      if (Number(held.cnt) >= Number(session.capacity)) {
        await conn.rollback();
        return res.status(409).json({ error: 'This session is full. No further places are available.' });
      }

      const registrationId = uuidv4();
      const code = createRegistrationCode();
      await conn.query(
        `INSERT INTO session_registrations
           (id, session_id, guest_name, guest_phone, guest_email, reference, verified, registration_code)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          registrationId, session.id,
          parsed.data.name || null, parsed.data.phone || null, parsed.data.email || null,
          parsed.data.reference, eligibility.verified && !overridden ? 1 : 0, code,
        ]
      );
      await conn.commit();
      res.status(201).json({
        registration_id: registrationId,
        registration_code: code,
        verified: eligibility.verified && !overridden,
        eligibility_overridden: overridden,
      });
    } catch (err) {
      await conn.rollback();
      console.error('sessions staff register:', err);
      res.status(500).json({ error: 'Failed to register this person.' });
    } finally {
      conn.release();
    }
  });

// POST /api/sessions/:id/check-in — the desk check-in
router.post('/:id/check-in', requireAuth,
  requireStaffRole(...STAFF_VIEW, 'line_staff', 'kiosk_clerk'),
  (req, res) => checkIn(req, res, 'kiosk'));

// POST /api/sessions/:id/cause-list — load the day's list
//
// Tier 2 of the design: the organisation exports the list it already produces
// and we match against it. Idempotent by (session, reference) so a corrected
// file can be re-sent without creating two entitlements to the same place.
router.post('/:id/cause-list', requireAuth, requireStaffRole(...STAFF_EDIT),
  auditLog('session_cause_list_import', 'scheduled_session'), async (req, res) => {
    const parsed = causeListSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: validationMessage(parsed.error) });

    const conn = await pool.getConnection();
    try {
      const session = await loadOwnedSession(req, res);
      if (!session) return;

      await conn.beginTransaction();
      if (parsed.data.replace) {
        await conn.query('DELETE FROM session_cause_list WHERE session_id = ?', [session.id]);
      }

      // Rows the court sent that we cannot key on are reported back rather than
      // dropped silently — a court that sent 400 lines and got 397 needs to know
      // which three, not just that the number moved.
      const skipped = [];
      const values = [];
      const seen = new Set();
      for (const entry of parsed.data.entries) {
        const key = referenceKey(entry.reference);
        if (!key) { skipped.push({ reference: entry.reference, reason: 'no usable reference' }); continue; }
        if (seen.has(key)) { skipped.push({ reference: entry.reference, reason: 'duplicate in file' }); continue; }
        seen.add(key);
        values.push([
          uuidv4(), session.id, entry.reference.trim(), key,
          entry.surname || null, entry.division || null, req.dbStaff?.id || null,
        ]);
      }

      if (values.length) {
        // Chunked: a public-day list can run to tens of thousands of rows and a
        // single statement that large trips max_allowed_packet.
        for (let i = 0; i < values.length; i += 500) {
          await conn.query(
            `INSERT INTO session_cause_list
               (id, session_id, reference, reference_key, party_surname, division, imported_by)
             VALUES ?
             ON DUPLICATE KEY UPDATE
               reference = VALUES(reference),
               party_surname = VALUES(party_surname),
               division = VALUES(division),
               imported_at = CURRENT_TIMESTAMP,
               imported_by = VALUES(imported_by)`,
            [values.slice(i, i + 500)]
          );
        }
      }

      // Turning the gate on is the point of loading a list; doing it implicitly
      // saves a second call the clerk would forget, and it is reversible.
      await conn.query('UPDATE scheduled_sessions SET requires_eligibility = 1 WHERE id = ?', [session.id]);

      const [[total]] = await conn.query(
        'SELECT COUNT(*) AS cnt FROM session_cause_list WHERE session_id = ?', [session.id]
      );
      await conn.commit();

      res.json({
        session_id: session.id,
        imported: values.length,
        skipped,
        cause_list_count: Number(total.cnt),
        replaced: Boolean(parsed.data.replace),
      });
    } catch (err) {
      await conn.rollback();
      console.error('sessions cause-list:', err);
      res.status(500).json({ error: 'Failed to import the list.' });
    } finally {
      conn.release();
    }
  });

// POST /api/sessions/:id/close — end the day and record who did not come
//
// The no-show number is the one a court actually cares about: a capped place
// that somebody else could have travelled for. It only becomes true once the
// day is declared over, which is why this is an explicit act and not a job.
router.post('/:id/close', requireAuth, requireStaffRole(...STAFF_EDIT),
  auditLog('session_close', 'scheduled_session'), async (req, res) => {
    try {
      const session = await loadOwnedSession(req, res);
      if (!session) return;
      if (['completed', 'cancelled'].includes(session.status)) {
        return res.status(409).json({ error: 'This session is already closed.' });
      }

      const [result] = await pool.query(
        `UPDATE session_registrations
            SET status = 'no_show'
          WHERE session_id = ? AND status = 'registered'`,
        [session.id]
      );
      await pool.query("UPDATE scheduled_sessions SET status = 'completed' WHERE id = ?", [session.id]);

      res.json({
        session_id: session.id,
        status: 'completed',
        marked_no_show: result.affectedRows,
        checked_in: Number(session.checked_in_count),
      });
    } catch (err) {
      console.error('sessions close:', err);
      res.status(500).json({ error: 'Failed to close the session.' });
    }
  });

/**
 * The decision functions, exposed for test.
 *
 * These are the parts with real judgement in them — what counts as the same
 * reference, whether a window is open, and the three-way eligible/verified
 * answer — and they are worth testing directly rather than only through HTTP,
 * where a mocked connection would obscure what is actually being asserted.
 */
router.__internals = {
  referenceKey,
  surnameKey,
  createRegistrationCode,
  registrationWindow,
  evaluateEligibility,
  shapeSession,
  ELIGIBILITY_DENIED,
  CODE_ALPHABET,
};

module.exports = router;

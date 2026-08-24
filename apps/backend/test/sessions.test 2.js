/**
 * sessions.test.js — the eligibility gate, and the promises it makes.
 *
 * What is under test here is not "rows are inserted". It is the four rules
 * stated at the top of routes/sessions.js, each of which is a promise to
 * somebody outside the building:
 *
 *   1. Eligibility DEGRADES rather than blocks — a court whose IT could not
 *      send this morning's list must still be able to run its day.
 *   2. `verified` tells the truth — a checked entitlement and an unchecked one
 *      must never look the same on the clerk's board.
 *   3. The endpoint does not become an enumeration oracle.
 *   4. The capped place is real.
 *
 * The pool is swapped in require.cache before the router loads, the same
 * technique tenant-isolation.test.js uses. node:test gives each file its own
 * process, so the substitution cannot leak.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const poolPath = require.resolve('../src/db/pool');
require.cache[poolPath] = {
  id: poolPath,
  filename: poolPath,
  loaded: true,
  exports: { query: async () => [[]], getConnection: async () => ({}) },
};

const sessionsRouter = require('../src/routes/sessions');
const {
  referenceKey, surnameKey, createRegistrationCode,
  registrationWindow, evaluateEligibility, shapeSession,
  ELIGIBILITY_DENIED, CODE_ALPHABET,
} = sessionsRouter.__internals;

/** A stand-in connection whose answers each test dictates. */
function fakeConn({ listCount = 0, entry = null }) {
  return {
    query: async (sql) => {
      if (/COUNT\(\*\) AS cnt FROM session_cause_list/.test(sql)) return [[{ cnt: listCount }]];
      if (/FROM session_cause_list/.test(sql)) return [entry ? [entry] : []];
      return [[]];
    },
  };
}

const COURT = Object.freeze({ id: 'ses-1', requires_eligibility: 1, second_factor: 'surname' });

// ── Reference matching ───────────────────────────────────────

test('the same ticket number typed three different ways is one reference', () => {
  // A motorist reads this off a printed summons under stress. The court exports
  // it one canonical way. If these did not collapse to one key, a person holding
  // a valid ticket would be told they are not listed.
  const keys = new Set(['TK 4471-22', 'tk4471/22', 'tk-4471-22'].map(referenceKey));
  assert.equal(keys.size, 1, `expected one key, got ${[...keys].join(', ')}`);
});

test('an empty or punctuation-only reference produces no key at all', () => {
  // Must not become a key that matches a list row by accident.
  assert.equal(referenceKey('---'), '');
  assert.equal(referenceKey(''), '');
  assert.equal(referenceKey(null), '');
});

test('surnames compare without apostrophes, case or spacing', () => {
  const forms = ["O'Brien", 'OBrien', 'obrien', ' O Brien '].map(surnameKey);
  assert.equal(new Set(forms).size, 1, 'a surname must not be spelt wrong by punctuation');
});

// ── Rule 1: degrade, do not block ────────────────────────────

test('with no cause list loaded, a person is still admitted — but NOT as verified', async () => {
  const result = await evaluateEligibility(fakeConn({ listCount: 0 }), COURT, { reference: 'TK-1' });
  assert.equal(result.eligible, true, 'a missing list must not lock the day out');
  assert.equal(result.verified, false, 'nothing was checked, so nothing may be claimed');
  assert.equal(result.gate, 'no_list');
});

test('a session that checks nobody admits everybody, still unverified', async () => {
  // A university registration week: every student is entitled to attend.
  const open = { id: 'ses-2', requires_eligibility: 0, second_factor: 'none' };
  const result = await evaluateEligibility(fakeConn({}), open, { reference: 'anything' });
  assert.deepEqual(
    { eligible: result.eligible, verified: result.verified, gate: result.gate },
    { eligible: true, verified: false, gate: 'none' }
  );
});

// ── Rule 2: verified tells the truth ─────────────────────────

test('a reference found on a loaded list is admitted AND marked verified', async () => {
  const conn = fakeConn({ listCount: 400, entry: { reference: 'TK-4471-22', party_surname: 'Brown', division: 'Court 3' } });
  const result = await evaluateEligibility(conn, COURT, { reference: 'tk447122', surname: 'brown' });
  assert.equal(result.eligible, true);
  assert.equal(result.verified, true);
  assert.equal(result.division, 'Court 3', 'the division tells them which room to walk to');
});

test('a reference absent from a loaded list is refused', async () => {
  const conn = fakeConn({ listCount: 400, entry: null });
  const result = await evaluateEligibility(conn, COURT, { reference: 'TK-9999-99', surname: 'Brown' });
  assert.equal(result.eligible, false);
  assert.equal(result.verified, false);
});

test('the wrong surname is refused when the list carries one', async () => {
  const conn = fakeConn({ listCount: 400, entry: { reference: 'TK-1', party_surname: 'Brown', division: null } });
  const result = await evaluateEligibility(conn, COURT, { reference: 'TK-1', surname: 'Campbell' });
  assert.equal(result.eligible, false);
});

test('a list row with no surname still admits — the court sent an incomplete file, not the visitor', async () => {
  // Failing closed here would punish a motorist for their own court's export.
  const conn = fakeConn({ listCount: 400, entry: { reference: 'TK-1', party_surname: null, division: null } });
  const result = await evaluateEligibility(conn, COURT, { reference: 'TK-1', surname: 'Anything' });
  assert.equal(result.eligible, true);
  assert.equal(result.verified, true);
});

test('a surname is only demanded when the session asks for one', async () => {
  const noFactor = { id: 'ses-3', requires_eligibility: 1, second_factor: 'none' };
  const conn = fakeConn({ listCount: 10, entry: { reference: 'TK-1', party_surname: 'Brown', division: null } });
  const result = await evaluateEligibility(conn, noFactor, { reference: 'TK-1' });
  assert.equal(result.eligible, true, 'second_factor=none must not silently require a surname');
});

// ── Rule 3: no enumeration oracle ────────────────────────────

test('every eligibility failure returns ONE message', () => {
  // "No such ticket" vs "wrong surname" would hand an attacker free confirmation
  // that a ticket exists. The clerk can be told the difference in person.
  assert.match(ELIGIBILITY_DENIED, /could not find a matter listed for today/i);
  assert.doesNotMatch(ELIGIBILITY_DENIED, /surname|not on the list|does not exist/i);
});

test('the eligibility endpoint neither authenticates nor writes', () => {
  const layer = sessionsRouter.stack.find(
    (l) => l.route?.path === '/public/:id/eligibility' && l.route.methods?.post
  );
  assert.ok(layer, 'POST /public/:id/eligibility must exist');
  const handlers = layer.route.stack.map((h) => h.name);
  assert.ok(!handlers.includes('requireAuth'), 'the portal must work with no account');
  assert.equal(handlers.length, 1, 'lookup carries no middleware of its own — the limiter is mounted in index.js');
});

test('every staff route on this router is authenticated', () => {
  // The three public paths are deliberate and enumerated. Anything else that
  // reaches the database without auth is a mistake, so assert the whole set
  // rather than spot-checking.
  const PUBLIC = ['/public', '/public/:id', '/public/:id/eligibility', '/public/:id/register', '/public/:id/check-in'];
  for (const layer of sessionsRouter.stack) {
    const path = layer.route?.path;
    if (!path || PUBLIC.includes(path)) continue;
    const handlers = layer.route.stack.map((h) => h.name);
    assert.ok(handlers.includes('requireAuth'), `${path} must require authentication`);
  }
});

test('the public register and check-in paths identify a signed-in user without demanding one', () => {
  for (const path of ['/public/:id/register', '/public/:id/check-in']) {
    const layer = sessionsRouter.stack.find((l) => l.route?.path === path && l.route.methods?.post);
    const handlers = layer.route.stack.map((h) => h.name);
    assert.ok(handlers.includes('optionalAuth'), `${path} must attach identity when it is offered`);
    assert.ok(!handlers.includes('requireAuth'), `${path} must not require an account`);
  }
});

// ── Access codes ─────────────────────────────────────────────

test('the code alphabet excludes every character pair people misread', () => {
  // Read off a screen, sometimes off a photograph of a screen, days later.
  for (const ambiguous of ['O', '0', 'I', '1', 'L', 'U', 'V', 'S', '5', 'B', '8', '2', 'Z']) {
    assert.ok(!CODE_ALPHABET.includes(ambiguous), `${ambiguous} is too easily misread to be in an access code`);
  }
});

test('access codes are grouped, of fixed length, and do not repeat', () => {
  const codes = new Set();
  for (let i = 0; i < 2000; i += 1) {
    const code = createRegistrationCode();
    assert.match(code, /^[A-Z0-9]{4}-[A-Z0-9]{4}$/, `unexpected code shape: ${code}`);
    codes.add(code);
  }
  // Not a uniqueness guarantee — the unique key on (session_id, code) is that.
  // This catches a generator that has silently stopped being random.
  assert.ok(codes.size > 1990, `only ${codes.size} distinct codes in 2000 draws`);
});

// ── Registration window ──────────────────────────────────────

test('a draft session accepts nobody, whatever its dates say', () => {
  const result = registrationWindow({ status: 'draft' });
  assert.equal(result.open, false);
});

test('a session with no window bounds is open for as long as its status says', () => {
  // This is how a same-day ordinary sitting works: there is nothing to book in
  // advance, so there is no window to enforce.
  const result = registrationWindow({ status: 'open', registration_opens_at: null, registration_closes_at: null });
  assert.equal(result.open, true);
});

test('registration before the window opens and after it closes are both refused, with different reasons', () => {
  const now = new Date('2026-08-19T12:00:00');
  const early = registrationWindow(
    { status: 'open', registration_opens_at: '2026-08-20T09:00:00', registration_closes_at: null }, now
  );
  const late = registrationWindow(
    { status: 'open', registration_opens_at: null, registration_closes_at: '2026-08-18T17:00:00' }, now
  );
  assert.equal(early.open, false);
  assert.match(early.reason, /has not opened yet/i);
  assert.equal(late.open, false);
  assert.match(late.reason, /has closed/i);
});

// ── Rule 4: the capped place is real ─────────────────────────

test('places remaining never reads negative on an over-subscribed session', () => {
  // Staff may register past the cap on purpose (a court cannot turn away a
  // person whose summons names that date). "-3 places left" is not a thing to
  // print on a screen.
  const shaped = shapeSession({ capacity: 400, registered_count: 403, checked_in_count: 0, cause_list_count: 0 });
  assert.equal(shaped.places_remaining, 0);
  assert.equal(shaped.registered_count, 403, 'the real number must still be reported');
});

test('a session at a hired venue reports the venue, not a null branch', () => {
  // 027 refuses to invent a branch row for the National Arena, so the caller
  // would otherwise have to know which of two fields to read.
  const shaped = shapeSession({
    capacity: 400, registered_count: 0, checked_in_count: 0, cause_list_count: 0,
    venue_name: 'National Arena', venue_address: 'Independence Park, Kingston 5',
    branch_name: null, branch_address: null,
  });
  assert.equal(shaped.location_name, 'National Arena');
  assert.equal(shaped.location_address, 'Independence Park, Kingston 5');
});

test('a branch session falls back to the branch for its location', () => {
  const shaped = shapeSession({
    capacity: 50, registered_count: 0, checked_in_count: 0, cause_list_count: 0,
    venue_name: null, branch_name: 'Camp Road', branch_address: '36 Camp Road, Kingston 5',
  });
  assert.equal(shaped.location_name, 'Camp Road');
});

test('a session carries its sector vocabulary, so the portal never says "Customer" to a motorist', () => {
  const shaped = shapeSession({
    capacity: 400, registered_count: 0, checked_in_count: 0, cause_list_count: 0,
    sector: 'judiciary', sp_label: 'Court', sp_visitor_singular: 'Court User', sp_visitor_plural: 'Court Users',
    sp_location_singular: 'Court', sp_location_plural: 'Courts',
    sp_service_singular: 'Matter', sp_service_plural: 'Matters',
    sp_server_singular: 'Court Clerk', sp_server_plural: 'Court Clerks',
    sp_section_singular: 'Division', sp_section_plural: 'Divisions',
    sp_identifier_label: 'Ticket Number', sp_identifier_hint: 'The number printed on your summons',
  });
  assert.equal(shaped.terms.visitor.many, 'Court Users');
  assert.equal(shaped.terms.identifier.label, 'Ticket Number');
});

/**
 * public-exposure.test.js
 *
 * GET /api/businesses and GET /api/businesses/:slug are unauthenticated by
 * design — somebody browsing the app has no account yet. Both returned
 * `SELECT b.*` joined to the subscription tier, so every anonymous caller got
 * 21 fields per tenant including `subscription_tier_id`, `tier_name`,
 * `tier_label` and the four `can_view_*` entitlement flags.
 *
 * That publishes which plan each customer pays for — sensitive to them and to
 * us — and hands an attacker a map of exactly which features are worth trying
 * to unlock.
 *
 * The projection is a WHITELIST rather than a blacklist on purpose: a column
 * added to `businesses` later must not become public merely by existing. These
 * tests pin that property, not just today's field list.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  toPublicBusiness, PUBLIC_BUSINESS_FIELDS,
  toPublicStaff, PUBLIC_STAFF_FIELDS, NEVER_EXPOSE,
} = require('../src/utils/publicShapes');

// The full row shape the query produces today, commercial fields included.
const dbRow = () => ({
  id: 'biz-cfcu-001',
  slug: 'community-first',
  name: 'Community First Credit Union',
  description: 'A credit union',
  logo_url: null,
  website_url: null,
  phone: null,
  email: null,
  sector: 'financial_services',
  terms: { sector: 'financial_services', label: 'Credit union' },
  // none of the following may ever reach an anonymous caller
  subscription_tier_id: 'tier-exec-001',
  tier_name: 'executive',
  tier_label: 'Executive',
  can_view_analytics: 1,
  can_view_predictions: 1,
  can_view_multi_branch: 1,
  can_view_executive_reports: 1,
  predictions_enabled: 1,
  is_active: 1,
  created_at: '2026-08-21T15:36:09.000Z',
  updated_at: '2026-08-21T15:36:09.000Z',
});

const COMMERCIAL = [
  'subscription_tier_id', 'tier_name', 'tier_label',
  'can_view_analytics', 'can_view_predictions',
  'can_view_multi_branch', 'can_view_executive_reports',
];

test('the public projection drops every commercial field', () => {
  const out = toPublicBusiness(dbRow());
  for (const field of COMMERCIAL) {
    assert.ok(!(field in out), `${field} must never reach an anonymous caller`);
  }
});

test('internal bookkeeping does not leak either', () => {
  const out = toPublicBusiness(dbRow());
  for (const field of ['predictions_enabled', 'is_active', 'created_at', 'updated_at']) {
    assert.ok(!(field in out), `${field} is ours, not the public's`);
  }
});

test('what the app actually renders still comes through', () => {
  const out = toPublicBusiness(dbRow());
  // The mobile home screen reads exactly these.
  for (const field of ['id', 'name', 'sector', 'slug']) {
    assert.ok(field in out, `${field} is required by the home screen`);
  }
  assert.equal(out.name, 'Community First Credit Union');
});

test('an unknown column is excluded by default, not included', () => {
  /* The whitelist property. If this ever flips to a blacklist, a future
     `internal_notes` or `billing_email` column becomes public the day it is
     added, silently, with no code change to review. */
  const row = { ...dbRow(), some_column_added_later: 'sensitive' };
  const out = toPublicBusiness(row);
  assert.ok(!('some_column_added_later' in out));
});

test('the whitelist itself carries no commercial field', () => {
  for (const field of COMMERCIAL) {
    assert.ok(!PUBLIC_BUSINESS_FIELDS.includes(field), `${field} must not be whitelisted`);
  }
});

/* ── Staff ────────────────────────────────────────────────────────────────
   `SELECT s.*` on GET /api/staff and GET /api/staff/:id returned
   password_hash and supabase_uid to every manager and executive listing their
   own team. No hash is populated today — Supabase Auth owns passwords — but
   the column exists and would ship the moment local auth is used.

   supabase_uid is the live one: it is the identity binding, and writing a uid
   onto a staff row was half of the privilege escalation closed earlier today.
   Publishing the other half is not a mistake worth keeping. */

const staffRow = () => ({
  id: 'staff-1', business_id: 'biz-taj-001', branch_id: 'br-taj-kgn',
  role_id: 'role-mgr-001', staff_code: 'TAJ-0001', full_name: 'A Manager',
  email: 'manager@taj.gov.jm', phone: '8765550100',
  assigned_service_id: null, availability_status: 'active', is_active: 1,
  invited_by_staff_id: null, created_at: 'x', updated_at: 'y',
  role_name: 'manager', role_label: 'Manager', branch_name: 'Kingston',
  assigned_service_name: null,
  // must never leave the server
  password_hash: '$2a$10$abcdefghijklmnopqrstuv',
  supabase_uid: '81b22fdc-929e-4307-8175-b0ecbd49434c',
  date_of_birth: '1990-01-01',
  address: '1 Hope Road',
});

test('a staff row never carries a password hash', () => {
  assert.ok(!('password_hash' in toPublicStaff(staffRow())));
});

test('a staff row never carries the Supabase identity', () => {
  assert.ok(!('supabase_uid' in toPublicStaff(staffRow())),
    'the uid is the binding a role escalation needs');
});

test('a colleague does not receive personal details', () => {
  const out = toPublicStaff(staffRow());
  for (const field of ['date_of_birth', 'address']) {
    assert.ok(!(field in out), `${field} is not needed to render a rota`);
  }
});

test('what the admin app renders off a staff row still arrives', () => {
  const out = toPublicStaff(staffRow());
  // Confirmed against apps/admin-desktop: these four are read by name.
  for (const field of ['role_name', 'branch_name', 'staff_code', 'full_name']) {
    assert.ok(field in out, `the admin app reads ${field}`);
  }
});

test('neither whitelist contains anything on the never-expose list', () => {
  for (const banned of NEVER_EXPOSE) {
    assert.ok(!PUBLIC_STAFF_FIELDS.includes(banned), `staff whitelist must not carry ${banned}`);
    assert.ok(!PUBLIC_BUSINESS_FIELDS.includes(banned), `business whitelist must not carry ${banned}`);
  }
});

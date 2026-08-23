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

const { toPublicBusiness, PUBLIC_BUSINESS_FIELDS } = require('../src/routes/businesses');

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

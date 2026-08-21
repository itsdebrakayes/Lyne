/**
 * sector-terms.test.js — what the system calls people, per sector.
 * Pure shaping, no DB: a joined query row goes in, a terms object comes out.
 *
 * The cases that matter are the degenerate ones. A government org must come back
 * byte-identical to the pre-sector wording (or the pivot silently rewords TAJ,
 * PICA and NHT), and a null identifier must survive as null (or a diagnostic
 * centre starts asking patients for a Tax Registration Number).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { shapeTerms, withTerms, GOVERNMENT_DEFAULTS } = require('../src/utils/sectorTerms');

// A row as the SECTOR_COLUMNS select list produces it.
const universityRow = () => ({
  id: 'biz-uni-001',
  sector: 'university',
  sp_label: 'University',
  sp_visitor_singular: 'Student',
  sp_visitor_plural: 'Students',
  sp_location_singular: 'Campus Office',
  sp_location_plural: 'Campus Offices',
  sp_service_singular: 'Issue',
  sp_service_plural: 'Issues',
  sp_server_singular: 'Adviser',
  sp_server_plural: 'Advisers',
  sp_section_singular: 'Office',
  sp_section_plural: 'Offices',
  sp_identifier_label: 'Student ID',
  sp_identifier_hint: 'Your student identification number',
});

test('reads the sector vocabulary off a joined row', () => {
  const terms = shapeTerms(universityRow());
  assert.equal(terms.visitor.one, 'Student');
  assert.equal(terms.visitor.many, 'Students');
  assert.equal(terms.location.one, 'Campus Office');
  assert.equal(terms.server.many, 'Advisers');
  assert.equal(terms.identifier.label, 'Student ID');
});

test('a missing sector row degrades to the wording used before sectors existed', () => {
  // An org on a database where migration 024 has not been applied: the LEFT JOIN
  // matched nothing, so every sp_ column is null.
  const terms = shapeTerms({ id: 'biz-taj-001', sector: 'government_revenue' });
  assert.deepEqual(terms, GOVERNMENT_DEFAULTS);
});

test('no row at all still yields a usable vocabulary', () => {
  // Never "undefined Served" on a dashboard.
  assert.equal(shapeTerms(null).visitor.many, 'Customers');
  assert.equal(shapeTerms(undefined).location.one, 'Branch');
});

test('an unknown sector keeps its own name but borrows the default words', () => {
  const terms = shapeTerms({ sector: 'veterinary' });
  assert.equal(terms.sector, 'veterinary');
  assert.equal(terms.visitor.one, 'Customer');
});

test('a null identifier stays null — that sector asks for nothing', () => {
  const row = universityRow();
  row.sector = 'diagnostics';
  row.sp_identifier_label = null;
  row.sp_identifier_hint = null;
  assert.equal(shapeTerms(row).identifier, null);
});

test('withTerms strips the sp_ scaffolding it read from', () => {
  const row = withTerms(universityRow());
  assert.equal(row.terms.visitor.one, 'Student');
  const leaked = Object.keys(row).filter((k) => k.startsWith('sp_'));
  assert.deepEqual(leaked, [], `sp_ columns leaked to the client: ${leaked}`);
  assert.equal(row.id, 'biz-uni-001', 'unrelated columns must survive');
});

test('withTerms passes a null row through untouched', () => {
  assert.equal(withTerms(null), null);
});

test('the government defaults are frozen against accidental rewording', () => {
  assert.throws(() => {
    'use strict';
    GOVERNMENT_DEFAULTS.visitor = { one: 'Client', many: 'Clients' };
  });
});

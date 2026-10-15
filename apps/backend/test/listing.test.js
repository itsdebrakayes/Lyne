/**
 * LISTED_SECTORS narrows the public lists on the demo server; unset, it
 * changes nothing. Run with `npm test`.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { listedSectorClause } = require('../src/utils/listing');

test('unset lists every sector', () => {
  delete process.env.LISTED_SECTORS;
  assert.deepEqual(listedSectorClause('b'), { sql: '', params: [] });
});

test('a list of sectors becomes a parameterised IN clause', () => {
  process.env.LISTED_SECTORS = ' healthcare, , university ';
  assert.deepEqual(listedSectorClause('bus'), {
    sql: ' AND bus.sector IN (?,?)',
    params: ['healthcare', 'university'],
  });
  delete process.env.LISTED_SECTORS;
});

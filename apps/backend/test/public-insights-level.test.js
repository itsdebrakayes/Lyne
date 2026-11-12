/**
 * publicInsightsLevel's failure rules (migration 051). A missing column means the
 * code is deployed ahead of the migration: behave as today ('full'). Any other
 * database failure means we cannot tell whether the organisation asked us to hold
 * its detail back, so we hold it back ('limited').
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

let next;
const resolved = Module._resolveFilename('../src/db/pool', module);
require.cache[resolved] = { id: resolved, filename: resolved, loaded: true, exports: { query: async () => next() }, children: [], paths: [] };
const pi = require('../src/lib/publicInsights');

test.beforeEach(() => pi.forget());

test('reads the stored level', async () => {
  next = () => [[{ public_insights: 'limited' }]];
  assert.equal(await pi.publicInsightsLevel('b1'), 'limited');
  next = () => [[{ public_insights: 'full' }]];
  pi.forget('b1');
  assert.equal(await pi.publicInsightsLevel('b1'), 'full');
});

test('before migration 051 (no column) it behaves as today', async () => {
  next = () => { const e = new Error('Unknown column'); e.code = 'ER_BAD_FIELD_ERROR'; throw e; };
  assert.equal(await pi.publicInsightsLevel('b2'), 'full');
});

test('any other database failure holds the detail back', async () => {
  next = () => { const e = new Error('connection lost'); e.code = 'PROTOCOL_CONNECTION_LOST'; throw e; };
  assert.equal(await pi.publicInsightsLevel('b3'), 'limited');
  assert.equal(await pi.sharesFullDetail('b3'), false);
});

test('an unknown value is treated as the default, and a change is seen at once after forget()', async () => {
  next = () => [[{ public_insights: 'weird' }]];
  assert.equal(await pi.publicInsightsLevel('b4'), 'full');
  next = () => [[{ public_insights: 'limited' }]];
  assert.equal(await pi.publicInsightsLevel('b4'), 'full', 'cached');
  pi.forget('b4');
  assert.equal(await pi.publicInsightsLevel('b4'), 'limited');
});

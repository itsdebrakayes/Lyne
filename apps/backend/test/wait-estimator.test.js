/**
 * wait-estimator.test.js — functional tests for the model-based customer ETA.
 * Runs with no DB: the pool singleton's query is stubbed so we exercise the real
 * grid-lookup logic (cell selection, hour fallback, graceful fallback to null).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../src/db/pool');

function stubGrid(services) {
  pool.query = async () => [[{ insight_data: JSON.stringify({ services }) }]];
}
function stubEmpty() { pool.query = async () => [[]]; }

const { estimateWaitMinutes, _clearCache } = require('../src/utils/waitEstimator');

const GRID = [{
  service_id: 'svc-1',
  cells: [
    { hour: 9, queue_max: 2, predicted_wait: 8 },
    { hour: 9, queue_max: 5, predicted_wait: 20 },
    { hour: 9, queue_max: 10, predicted_wait: 45 },
    { hour: 12, queue_max: 2, predicted_wait: 5 },
    { hour: 12, queue_max: 10, predicted_wait: 25 },
  ],
}];

test('picks the smallest bucket whose bound covers the queue ahead', async () => {
  _clearCache(); stubGrid(GRID);
  // position 4 → 3 people ahead → smallest bucket >= 3 is queue_max 5 → 20m
  const eta = await estimateWaitMinutes({ branchId: 'b1', serviceId: 'svc-1', position: 4, hour: 9 });
  assert.equal(eta, 20);
});

test('first-in-line (position 1) uses the smallest bucket', async () => {
  _clearCache(); stubGrid(GRID);
  const eta = await estimateWaitMinutes({ branchId: 'b1', serviceId: 'svc-1', position: 1, hour: 9 });
  assert.equal(eta, 8);
});

test('a very long queue clamps to the largest available bucket', async () => {
  _clearCache(); stubGrid(GRID);
  const eta = await estimateWaitMinutes({ branchId: 'b1', serviceId: 'svc-1', position: 50, hour: 9 });
  assert.equal(eta, 45);
});

test('uses the nearest hour when the exact hour is absent', async () => {
  _clearCache(); stubGrid(GRID);
  // hour 13 not present; nearest is 12 → position 1 → 5m
  const eta = await estimateWaitMinutes({ branchId: 'b1', serviceId: 'svc-1', position: 1, hour: 13 });
  assert.equal(eta, 5);
});

test('returns null (caller falls back to formula) when no grid exists', async () => {
  _clearCache(); stubEmpty();
  const eta = await estimateWaitMinutes({ branchId: 'b1', serviceId: 'svc-1', position: 3, hour: 9 });
  assert.equal(eta, null);
});

test('returns null for a service not in the grid', async () => {
  _clearCache(); stubGrid(GRID);
  const eta = await estimateWaitMinutes({ branchId: 'b1', serviceId: 'svc-unknown', position: 3, hour: 9 });
  assert.equal(eta, null);
});

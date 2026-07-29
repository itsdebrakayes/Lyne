/**
 * eta-math.test.js — the shared counter-aware wait projection.
 * Pure arithmetic: people ahead + counters + per-person time -> minutes.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { projectedWaitMinutes } = require('../src/utils/etaMath');

test('first in line waits for no one', () => {
  assert.equal(projectedWaitMinutes({ ahead: 0, perServiceMinutes: 35, counters: 1 }), 0);
});

test('single counter is the old serial line', () => {
  // 7 ahead x 35m, one clerk — this is the 245m case, now honestly labelled.
  assert.equal(projectedWaitMinutes({ ahead: 7, perServiceMinutes: 35, counters: 1 }), 245);
});

test('opening counters divides the wait', () => {
  // Same queue, but a second and third window open.
  assert.equal(projectedWaitMinutes({ ahead: 6, perServiceMinutes: 35, counters: 2 }), 105);
  assert.equal(projectedWaitMinutes({ ahead: 6, perServiceMinutes: 15, counters: 3 }), 30);
});

test('Branch and Join agree given the same inputs', () => {
  const inputs = { ahead: 10, perServiceMinutes: 15, counters: 2 };
  assert.equal(projectedWaitMinutes(inputs), projectedWaitMinutes({ ...inputs }));
  assert.equal(projectedWaitMinutes(inputs), 75);
});

test('a queue with no counter open still divides by one, not zero', () => {
  const eta = projectedWaitMinutes({ ahead: 4, perServiceMinutes: 20, counters: 0 });
  assert.equal(eta, 80);
  assert.ok(Number.isFinite(eta), 'must never be Infinity');
});

test('never returns a negative or fractional minute', () => {
  const eta = projectedWaitMinutes({ ahead: 3, perServiceMinutes: 12.5, counters: 2 });
  assert.equal(eta, 19); // round(3/2 * 12.5) = round(18.75)
  assert.ok(Number.isInteger(eta));
  assert.ok(eta >= 0);
});

test('garbage inputs degrade to zero rather than NaN', () => {
  assert.equal(projectedWaitMinutes({ ahead: null, perServiceMinutes: undefined, counters: NaN }), 0);
});

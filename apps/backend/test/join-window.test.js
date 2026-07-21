/**
 * join-window.test.js — the walk-ins-first buffer on remote (app) joins.
 * Pure logic, no DB: a branch schedule and a clock go in, a verdict comes out.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { remoteJoinBlockedUntil, REMOTE_JOIN_BUFFER } = require('../src/utils/joinWindow');

// Mon–Fri, doors at 08:00. 2026-07-21 is a Tuesday.
const BRANCH = { opening_time: '08:00:00', open_days: '1,2,3,4,5' };
const at = (h, m) => new Date(2026, 6, 21, h, m, 0, 0);

test('buffer is 5 minutes', () => {
  assert.equal(REMOTE_JOIN_BUFFER, 5);
});

test('blocks a remote join in the minute the doors open', () => {
  const until = remoteJoinBlockedUntil(BRANCH, at(8, 0));
  assert.ok(until, 'expected the join to be blocked at 08:00');
  assert.equal(until.getHours(), 8);
  assert.equal(until.getMinutes(), 5);
});

test('still blocks on the last minute of the buffer', () => {
  assert.ok(remoteJoinBlockedUntil(BRANCH, at(8, 4)));
});

test('allows the join the moment the buffer expires', () => {
  assert.equal(remoteJoinBlockedUntil(BRANCH, at(8, 5)), null);
});

test('allows joins later in the day', () => {
  assert.equal(remoteJoinBlockedUntil(BRANCH, at(11, 30)), null);
});

test('does not apply before the branch opens', () => {
  // Pre-opening is the queue's own concern (is_active), not this rule's.
  assert.equal(remoteJoinBlockedUntil(BRANCH, at(7, 58)), null);
});

test('does not apply on a day the branch is closed', () => {
  // 2026-07-19 is a Sunday, which is not in open_days.
  assert.equal(remoteJoinBlockedUntil(BRANCH, new Date(2026, 6, 19, 8, 1)), null);
});

test('honours a half-past opening time', () => {
  const branch = { opening_time: '08:30:00', open_days: '1,2,3,4,5' };
  assert.ok(remoteJoinBlockedUntil(branch, at(8, 32)), 'should block at 08:32');
  assert.equal(remoteJoinBlockedUntil(branch, at(8, 35)), null, 'should allow at 08:35');
  assert.equal(remoteJoinBlockedUntil(branch, at(8, 2)), null, 'should not reuse 08:00');
});

test('a branch with no schedule set has no buffer to enforce', () => {
  assert.equal(remoteJoinBlockedUntil(null, at(8, 1)), null);
  assert.equal(remoteJoinBlockedUntil({}, at(8, 1)), null);
  assert.equal(remoteJoinBlockedUntil({ opening_time: '08:00:00' }, at(8, 1)), null);
  assert.equal(remoteJoinBlockedUntil({ open_days: '1,2,3,4,5' }, at(8, 1)), null);
});

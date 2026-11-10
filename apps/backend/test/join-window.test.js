/**
 * join-window.test.js — the walk-ins-first buffer on remote (app) joins.
 * Pure logic, no DB: a branch schedule and a clock go in, a verdict comes out.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { remoteJoinBlockedUntil, branchClosedMessage, REMOTE_JOIN_BUFFER } = require('../src/utils/joinWindow');

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

const HWT = { name: 'Half Way Tree', closing_time: '16:00:00', open_days: '1,2,3,4,5' };

test('open until the minute the branch closes', () => {
  assert.equal(branchClosedMessage(HWT, at(15, 59)), null);
});

test('refuses from closing time, naming the branch and the hour', () => {
  assert.equal(branchClosedMessage(HWT, at(22, 24)), 'Half Way Tree closed at 4 PM today. You can join again when it reopens.');
});

test('refuses on a day the branch does not open', () => {
  // 2026-07-25 is a Saturday.
  assert.equal(branchClosedMessage(HWT, new Date(2026, 6, 25, 11, 0)), 'Half Way Tree is closed today.');
});

test('a branch with no closing time is not refused', () => {
  assert.equal(branchClosedMessage({ name: 'X', closing_time: null }, at(23, 0)), null);
});

const { closureMessage, nextOpenDay } = require('../src/utils/branchClosures');

test('a closure says why, when it should reopen, and that notice can change', () => {
  const text = closureMessage({ kind: 'outage', branch_name: 'Half Way Tree', reason: 'Power outage', reopens_label: 'Friday 6 November' });
  assert.equal(text, 'Half Way Tree is out of service today: Power outage. It is expected to reopen on Friday 6 November, unless a further notice says otherwise.');
});

test('a holiday says which, and when the branch is back', () => {
  assert.equal(closureMessage({ kind: 'holiday', branch_name: 'Half Way Tree', reason: "National Heroes' Day", reopens_label: 'Tuesday 20 October' }),
    "Half Way Tree is closed today for National Heroes' Day. It is expected to reopen on Tuesday 20 October.");
});

test('reopening skips weekends and the next holiday', () => {
  // Friday 25 December 2026: Saturday 26 is Boxing Day, then a weekend.
  assert.equal(nextOpenDay('2026-12-25', '1,2,3,4,5', new Set(['2026-12-26'])), '2026-12-28');
  // A Saturday-opening branch still skips Boxing Day.
  assert.equal(nextOpenDay('2026-12-25', '1,2,3,4,5,6', new Set(['2026-12-26'])), '2026-12-28');
});

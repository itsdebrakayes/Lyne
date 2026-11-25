/**
 * The "Time to head out" reminder was scheduled once at join and never moved,
 * so a line that sped up called people before the reminder fired. These pin
 * src/lib/departure.ts, which decides when it moves.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { leaveAtFor, movedLeaveAt, type DepartureTrip } from '../src/lib/departure';

const MIN = 60_000;
const now = Date.UTC(2026, 10, 25, 14, 0);
const trip = (leaveAt: number): DepartureTrip => ({
  ticketId: 't1', branchName: 'Half Way Tree', travelMinutes: 20, leadMinutes: 10, leaveAt,
});

test('the reminder is set for the wait minus the drive and the lead time', () => {
  assert.equal(leaveAtFor(trip(0), 60, now), now + 30 * MIN);
});

test('a wait shorter than the drive still gives a minute, not a past time', () => {
  assert.equal(leaveAtFor(trip(0), 15, now), now + MIN);
});

test('a line that speeds up brings the reminder forward', () => {
  assert.equal(movedLeaveAt(trip(now + 30 * MIN), 45, now), now + 15 * MIN);
});

test('a line that slows down pushes the reminder back', () => {
  assert.equal(movedLeaveAt(trip(now + 30 * MIN), 80, now), now + 50 * MIN);
});

test('an estimate that wobbles by a minute leaves the reminder alone', () => {
  assert.equal(movedLeaveAt(trip(now + 30 * MIN), 61, now), null);
});

test('time passing with the estimate counting down leaves the reminder alone', () => {
  const later = now + 10 * MIN;
  assert.equal(movedLeaveAt(trip(now + 30 * MIN), 50, later), null);
});

test('a reminder that has already fired is not set again', () => {
  assert.equal(movedLeaveAt(trip(now - MIN), 90, now), null);
});

test('a ticket with no estimate does not move the reminder to now', () => {
  assert.equal(movedLeaveAt(trip(now + 30 * MIN), null, now), null);
  assert.equal(movedLeaveAt(trip(now + 30 * MIN), undefined, now), null);
});

test('a reminder held at the one-minute floor is not pushed back on every poll', () => {
  const armed = trip(leaveAtFor(trip(0), 15, now));
  assert.equal(movedLeaveAt(armed, 14, now + 5_000), null);
  assert.equal(movedLeaveAt(armed, 14, now + 50_000), null);
});

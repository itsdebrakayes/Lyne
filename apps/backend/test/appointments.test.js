/**
 * appointments.test.js — the rule for a person with a time (migration 042).
 *
 * The promises under test, each one somebody outside the building relies on:
 *
 *   1. Nobody gets ahead of walk-ins long before their slot (too early is refused
 *      with the time check-in opens, not a ticket).
 *   2. An on-time appointment is called before walk-ins, behind earlier slots.
 *   3. A late arrival is still served, in the usual order, and told why.
 *   4. A session without times behaves exactly as before.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  DEFAULT_EARLY_MINUTES, DEFAULT_LATE_MINUTES,
  appointmentWindow, appointmentTiming, appointmentInsertIndex, appointmentMessage,
  slotLabel, shiftLabel,
} = require('../src/utils/appointments');

const W = { early: 15, late: 10 };

test('window: defaults when the session sets nothing, its own values when it does', () => {
  assert.deepEqual(appointmentWindow({}), { early: DEFAULT_EARLY_MINUTES, late: DEFAULT_LATE_MINUTES });
  assert.deepEqual(appointmentWindow({ appointment_early_minutes: null, appointment_late_minutes: null }), { early: 15, late: 10 });
  assert.deepEqual(appointmentWindow({ appointment_early_minutes: 30, appointment_late_minutes: 0 }), { early: 30, late: 0 });
});

test('timing: early, on time and late around the slot, inclusive at both edges', () => {
  assert.equal(appointmentTiming(-16, W), 'early');
  assert.equal(appointmentTiming(-15, W), 'on_time');
  assert.equal(appointmentTiming(-10, W), 'on_time');   // the 10:20 for 10:30 case
  assert.equal(appointmentTiming(0, W), 'on_time');
  assert.equal(appointmentTiming(10, W), 'on_time');
  assert.equal(appointmentTiming(10.5, W), 'late');
  assert.equal(appointmentTiming(null, W), 'none');
});

test('placement: an on-time appointment goes ahead of every walk-in', () => {
  const line = [
    { id: 'w1', appointment_at: null },
    { id: 'w2', appointment_at: null },
  ];
  assert.equal(appointmentInsertIndex(line, '2026-11-18 10:30:00'), 0);
});

test('placement: behind earlier and equal slots, ahead of later ones', () => {
  const line = [
    { id: 'a1', appointment_at: '2026-11-18 10:00:00' },
    { id: 'a2', appointment_at: '2026-11-18 10:30:00' },
    { id: 'a3', appointment_at: '2026-11-18 11:00:00' },
    { id: 'w1', appointment_at: null },
  ];
  assert.equal(appointmentInsertIndex(line, '2026-11-18 10:30:00'), 2);
  assert.equal(appointmentInsertIndex(line, '2026-11-18 09:45:00'), 0);
  assert.equal(appointmentInsertIndex(line, new Date('2026-11-18T11:30:00')), 3);
});

test('placement: an empty line puts them first', () => {
  assert.equal(appointmentInsertIndex([], '2026-11-18 10:30:00'), 0);
});

test('messages say the times a person can act on', () => {
  assert.equal(appointmentMessage('early', '10:30:00', W), 'Check-in for your 10:30 appointment opens at 10:15.');
  assert.match(appointmentMessage('late', '10:30:00', W), /more than 10 minutes after your 10:30 appointment/);
  assert.match(appointmentMessage('on_time', '10:30:00', W), /ahead of walk-in clients/);
  assert.equal(appointmentMessage('on_time', null, W), null);
});

test('labels: wall-clock times, wrapping past midnight', () => {
  assert.equal(slotLabel('9:05:00'), '09:05');
  assert.equal(slotLabel(null), null);
  assert.equal(shiftLabel('00:10', -15), '23:55');
  assert.equal(shiftLabel('10:30:00', -15), '10:15');
});

/**
 * appointments.js — a time per person, on top of a session (migration 042).
 *
 * 027 gave people a DAY and a place in the order, and said plainly that it was
 * not an appointment system. A bank is different: it already books clients for
 * 10:30 with an officer, in its own booking tool. What it lacks is the day
 * itself: knowing the client has arrived, and calling them at 10:30 instead of
 * after the twelve walk-ins who got there first.
 *
 * So an appointment here is not a booking engine. The time comes in from the
 * organisation (with the approved list, or typed by staff), and Lyne does the
 * part it is good at: check-in and the line.
 *
 * THE RULE, decided once and kept here so the route, the tests and the admin
 * text all agree:
 *
 *   too early  — check-in opens EARLY minutes before the slot. Before that the
 *                person is told when to come back; no ticket is issued, because
 *                a ticket would put them ahead of walk-ins long before their time.
 *   on time    — from EARLY minutes before to LATE minutes after the slot. The
 *                ticket goes ahead of every walk-in, behind anyone already
 *                waiting with an earlier (or the same) slot.
 *   late       — after that, the slot is gone. They still get in, in the usual
 *                order, and are told why. Turning someone away who came in person
 *                is worse for the branch than serving them in turn.
 */

const DEFAULT_EARLY_MINUTES = 15;
const DEFAULT_LATE_MINUTES = 10;

/** The session's window, with the defaults applied. */
function appointmentWindow(session) {
  const pick = (value, fallback) => (value == null || !Number.isFinite(Number(value)) ? fallback : Number(value));
  return {
    early: pick(session?.appointment_early_minutes, DEFAULT_EARLY_MINUTES),
    late: pick(session?.appointment_late_minutes, DEFAULT_LATE_MINUTES),
  };
}

/**
 * Where "now" falls against a slot.
 * `minutesFromSlot` is now minus the slot: negative means early.
 */
function appointmentTiming(minutesFromSlot, { early, late }) {
  // Number(null) is 0, which would read as "exactly on time".
  if (minutesFromSlot == null || minutesFromSlot === '') return 'none';
  const m = Number(minutesFromSlot);
  if (!Number.isFinite(m)) return 'none';
  if (m < -early) return 'early';
  if (m > late) return 'late';
  return 'on_time';
}

/**
 * Where an on-time appointment joins the waiting line.
 *
 * `waiting` is the line in call order: [{ id, appointment_at }]. Appointments
 * that were honoured sit at the front in slot order, so the new one goes before
 * the first ticket that is either a walk-in or an appointment with a later slot.
 * Equal slots keep arrival order. Returns the 0-based index to insert at.
 */
function appointmentInsertIndex(waiting, slot) {
  const mine = toMillis(slot);
  for (let i = 0; i < waiting.length; i += 1) {
    const theirs = toMillis(waiting[i].appointment_at);
    if (theirs == null || theirs > mine) return i;
  }
  return waiting.length;
}

function toMillis(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** "10:30:00" → "10:30". Times are wall-clock at the branch, never instants. */
function slotLabel(time) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

/** "10:30" minus 15 minutes → "10:15". */
function shiftLabel(time, minutes) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
  if (!match) return null;
  const total = (Number(match[1]) * 60 + Number(match[2]) + minutes + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** What the person is told, for each outcome. One place, so the words agree. */
function appointmentMessage(timing, time, { early, late }) {
  const slot = slotLabel(time);
  if (!slot) return null;
  if (timing === 'early') {
    return `Check-in for your ${slot} appointment opens at ${shiftLabel(time, -early)}.`;
  }
  if (timing === 'late') {
    return `You arrived more than ${late} minutes after your ${slot} appointment, so you have joined the line in the usual order.`;
  }
  if (timing === 'on_time') {
    return `You are checked in for your ${slot} appointment and will be called ahead of walk-in clients.`;
  }
  return null;
}

module.exports = {
  DEFAULT_EARLY_MINUTES,
  DEFAULT_LATE_MINUTES,
  appointmentWindow,
  appointmentTiming,
  appointmentInsertIndex,
  appointmentMessage,
  slotLabel,
  shiftLabel,
};

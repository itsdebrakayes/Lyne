/**
 * joinWindow.js — when a customer may join a queue FROM THE APP.
 *
 * The first few minutes of a branch's day belong to walk-ins: people who
 * physically travelled to the branch and are standing at the door must not be
 * leapfrogged by someone tapping "join" from home the second the clock ticks
 * over. Remote (channel 'app') joining therefore opens REMOTE_JOIN_BUFFER
 * minutes after the doors do.
 *
 * Mirrored in the mobile UI (remoteJoinInfo in apps/mobile/src/lib/theme.ts) —
 * the UI disables the button, this enforces it so the rule cannot be bypassed.
 */

const REMOTE_JOIN_BUFFER = 5; // minutes

/**
 * @param {{opening_time?: string|null, open_days?: string|null}} branch
 * @param {Date} now
 * @returns {Date|null} the moment remote joining opens, or null if not blocked.
 */
function remoteJoinBlockedUntil(branch, now = new Date()) {
  // A branch with no schedule set has no buffer to enforce.
  if (!branch || !branch.opening_time || !branch.open_days) return null;

  const openDays = String(branch.open_days)
    .split(',')
    .map((d) => parseInt(d, 10))
    .filter((d) => !Number.isNaN(d));
  if (!openDays.includes(now.getDay())) return null;

  const [hours, minutes] = String(branch.opening_time).split(':').map(Number);
  const openMin = hours * 60 + (minutes || 0);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // Before opening, or past the buffer — nothing for this rule to say. (Whether
  // the branch is open at all is decided by the queue's own is_active flag.)
  if (nowMin < openMin || nowMin >= openMin + REMOTE_JOIN_BUFFER) return null;

  const opensAt = new Date(now);
  opensAt.setHours(0, openMin + REMOTE_JOIN_BUFFER, 0, 0);
  return opensAt;
}

module.exports = { remoteJoinBlockedUntil, REMOTE_JOIN_BUFFER };

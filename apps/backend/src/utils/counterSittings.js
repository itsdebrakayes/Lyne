/**
 * counterSittings.js — who was at which counter, and when.
 *
 * A counter is open while somebody is sitting at it. Clocking in opens a sitting,
 * clocking out closes it, and a break or a move closes one and (on the way back,
 * or at the new desk) opens another. When one person leaves and another picks the
 * counter up, the two sittings overlap or touch, so the counter stayed open.
 */
const { randomUUID: uuidv4 } = require('crypto');

async function openSitting(db, { counterId, staffId, shiftId }) {
  if (!counterId) return;
  await db.query(
    `INSERT INTO counter_sittings (id, counter_id, staff_id, shift_id, opened_at) VALUES (?, ?, ?, ?, NOW())`,
    [uuidv4(), counterId, staffId, shiftId || null]);
}

async function closeSitting(db, staffId, reason) {
  await db.query(
    `UPDATE counter_sittings SET closed_at = NOW(), end_reason = ? WHERE staff_id = ? AND closed_at IS NULL`,
    [reason, staffId]);
}

module.exports = { openSitting, closeSitting };

/**
 * smsAlerts.js — the texts Lyne sends a person about their place in a line.
 *
 * Only to someone who said yes, and only where the branch has switched texting on.
 * Every alert names Lyne and says how to stop, in one 160-character segment.
 */
const crypto = require('crypto');
const pool = require('../db/pool');
const { sendSms, smsAvailable } = require('./smsSender');

/* Unmistakable when typed from a phone screen: no 0/O or 1/I. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const stopCode = () => Array.from(crypto.randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join('');

/** One segment whatever the branch is called: the name gives way, the rest cannot. */
function calledMessage({ ticket, branch, stop }) {
  const tail = stop ? `Stop texts: uselyne.com/stop/${stop}` : 'Stop texts in the Lyne app.';
  const room = 160 - `Lyne: ${ticket} is called at . Go to the counter. ${tail}`.length;
  const place = String(branch || 'the branch').replace(/[^\x20-\x7E]/g, '').slice(0, Math.max(0, room)).trim();
  return `Lyne: ${ticket} is called at ${place}. Go to the counter. ${tail}`;
}

async function textWhenCalled(ticketId) {
  try {
    const [[v]] = await pool.query(
      `SELECT t.id, t.user_id, t.ticket_number, t.guest_phone, t.notify_consent_at, t.sms_stop_code,
              br.name AS branch, bs.text_when_called, u.phone AS user_phone, u.sms_opt_in, u.phone_verified_at
         FROM queue_tickets t JOIN queues q ON q.id = t.queue_id JOIN branches br ON br.id = q.branch_id
         LEFT JOIN branch_settings bs ON bs.branch_id = br.id
         LEFT JOIN users u ON u.id = t.user_id
        WHERE t.id = ?`, [ticketId]);
    if (!v || !Number(v.text_when_called)) return { sent: false, reason: 'branch_off' };
    const member = Boolean(v.user_id);
    const to = member ? v.user_phone : v.guest_phone;
    const agreed = member ? Number(v.sms_opt_in) === 1 && v.phone_verified_at : v.notify_consent_at;
    if (!to || !agreed) return { sent: false, reason: 'no_consent' };
    return await sendSms({
      to, purpose: 'called', ticketId: v.id, userId: v.user_id,
      body: calledMessage({ ticket: v.ticket_number, branch: v.branch, stop: member ? null : v.sms_stop_code }),
    });
  } catch (err) {
    console.error('[SMS] called alert failed:', err.message);
    return { sent: false, reason: 'failed' };
  }
}

/** Whether a kiosk at this branch should offer "Text Me". */
async function canTextAtBranch(branchId) {
  if (!smsAvailable() || !branchId) return false;
  const [rows] = await pool.query('SELECT text_when_called FROM branch_settings WHERE branch_id = ?', [branchId]);
  return Number(rows?.[0]?.text_when_called) === 1;
}

module.exports = { textWhenCalled, canTextAtBranch, calledMessage, stopCode };

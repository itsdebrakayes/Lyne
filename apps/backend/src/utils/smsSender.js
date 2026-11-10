/**
 * smsSender.js — text messages, behind one interface.
 *
 * Modelled on pushSender.js: callers treat it as fire-and-forget AFTER their
 * transaction commits, and it never throws. Swapping provider means replacing the
 * `twilio` object below and nothing else (docs/LAUNCH_PROCUREMENT.md §1.1).
 *
 * Every text costs about US$0.32 a segment and goes from the name "Lyne", which
 * cannot receive replies. So:
 *   - nothing is sent unless SMS_ENABLED=true, whatever else is configured;
 *   - a message over one segment is refused rather than quietly billed twice;
 *   - a number is limited per hour, and the whole system per day;
 *   - a number that has said stop is never texted. Consent is the caller's job;
 *     the stop list is checked here so no caller can forget it.
 */
const crypto = require('crypto');
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');

const num = (v, fallback) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : fallback; };
const PER_NUMBER_PER_HOUR = () => num(process.env.SMS_PER_NUMBER_PER_HOUR, 4);
const DAILY_CAP = () => num(process.env.SMS_DAILY_CAP, 200);

/** The GSM-7 alphabet. One character outside it halves a segment to 70. */
const GSM = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà]*$/;
const fitsOneSegment = (body) => GSM.test(body) && body.length <= 160;

/** +1876/+1658 from however it was typed. Jamaica only, as the account is. */
function normalizeJamaican(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 7) return `+1876${digits}`;
  const ten = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  return ten.length === 10 && /^(876|658)/.test(ten) ? `+1${ten}` : null;
}

const hash = (phone) => crypto.createHash('sha256').update(phone).digest('hex');

/** Configured and switched on: the one test for "can Lyne text right now?". */
function smsAvailable(env = process.env) {
  return String(env.SMS_ENABLED || '').toLowerCase() === 'true'
    && Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_MESSAGING_SERVICE_SID);
}

const twilioClient = () => require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

/** The provider. Everything Twilio-shaped lives here and in verifyCode below. */
const twilio = {
  async send(to, body) {
    const m = await twilioClient().messages.create({ to, body, messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID });
    return m.sid;
  },
};

async function record(phone, { purpose, status, providerId = null, detail = null, ticketId = null, userId = null }) {
  await pool.query(
    `INSERT INTO sms_log (id, phone_hash, purpose, status, provider_id, detail, ticket_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), hash(phone), purpose, status, providerId, detail ? String(detail).slice(0, 255) : null, ticketId, userId]);
}

/** Why this number may not be texted now, or null if it may. */
async function refusal(phone) {
  const [[out]] = await pool.query('SELECT 1 AS yes FROM sms_opt_outs WHERE phone = ?', [phone]);
  if (out) return 'opted_out';
  const [[{ recent }]] = await pool.query(
    `SELECT COUNT(*) AS recent FROM sms_log WHERE phone_hash = ? AND status = 'sent' AND created_at >= NOW() - INTERVAL 1 HOUR`, [hash(phone)]);
  if (Number(recent) >= PER_NUMBER_PER_HOUR()) return 'throttled';
  const [[{ today }]] = await pool.query(
    `SELECT COUNT(*) AS today FROM sms_log WHERE status = 'sent' AND created_at >= CURDATE()`);
  if (Number(today) >= DAILY_CAP()) return 'daily_cap';
  return null;
}

/** @returns {Promise<{ sent: boolean, reason?: string }>} never rejects */
async function sendSms({ to, body, purpose, ticketId = null, userId = null }) {
  try {
    const phone = normalizeJamaican(to);
    if (!phone) return { sent: false, reason: 'bad_number' };
    const base = { purpose, ticketId, userId };
    if (!fitsOneSegment(body)) {
      console.error(`[SMS] ${purpose} refused: over one segment (${body.length} chars)`);
      await record(phone, { ...base, status: 'too_long' });
      return { sent: false, reason: 'too_long' };
    }
    if (!smsAvailable()) {
      await record(phone, { ...base, status: 'disabled' });
      return { sent: false, reason: 'disabled' };
    }
    const no = await refusal(phone);
    if (no) {
      await record(phone, { ...base, status: no });
      return { sent: false, reason: no };
    }
    const providerId = await twilio.send(phone, body);
    await record(phone, { ...base, status: 'sent', providerId });
    return { sent: true };
  } catch (err) {
    console.error('[SMS] send failed:', err.message);
    try { await record(normalizeJamaican(to) || 'invalid', { purpose, status: 'failed', detail: err.code || err.message, ticketId, userId }); } catch { /* the log is not worth a crash */ }
    return { sent: false, reason: 'failed' };
  }
}

module.exports = {
  sendSms, smsAvailable, normalizeJamaican, fitsOneSegment, refusal, record,
};

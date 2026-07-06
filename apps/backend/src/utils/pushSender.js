/**
 * pushSender.js — Expo push notification delivery
 *
 * Looks up a user's registered devices in device_push_tokens and delivers
 * through Expo's push API (plain HTTPS — no SDK dependency). Tokens that
 * Expo reports as DeviceNotRegistered are deactivated so dead devices
 * stop receiving sends.
 *
 * Callers should treat this as fire-and-forget AFTER their transaction
 * commits: sendPushToUser never throws.
 */

const pool = require('../db/pool');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

async function sendPushToUser(userId, { title, body, data = {} }) {
  if (!userId || !title) return { sent: 0 };

  try {
    const [tokens] = await pool.query(
      'SELECT id, expo_push_token FROM device_push_tokens WHERE user_id = ? AND is_active = TRUE',
      [userId]
    );
    if (!tokens.length) return { sent: 0 };

    let sent = 0;
    for (let start = 0; start < tokens.length; start += BATCH_SIZE) {
      const batch = tokens.slice(start, start + BATCH_SIZE);
      const messages = batch.map(token => ({
        to: token.expo_push_token,
        sound: 'default',
        priority: 'high',
        title,
        body,
        data,
      }));

      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });

      const payload = await response.json().catch(() => null);
      const receipts = Array.isArray(payload?.data) ? payload.data : [];

      for (let i = 0; i < receipts.length; i++) {
        const receipt = receipts[i];
        if (receipt.status === 'ok') {
          sent++;
        } else if (receipt.details?.error === 'DeviceNotRegistered') {
          await pool.query(
            'UPDATE device_push_tokens SET is_active = FALSE WHERE id = ?',
            [batch[i].id]
          );
        }
      }
    }

    return { sent };
  } catch (err) {
    console.error('[Push] send failed:', err.message);
    return { sent: 0, error: err.message };
  }
}

module.exports = { sendPushToUser };

/**
 * sms.js — agreeing to texts and stopping them.
 *
 * GET  /api/sms/status            is texting on (and, with branch_id, at this branch)?
 * GET  /api/sms/preference        my number and whether I get texts
 * PUT  /api/sms/preference        turn my texts on or off
 * POST /api/sms/stop              stop texts from the link in a message
 *
 * A phone is never how an account is made. Sign-up is by email; a signed-in person
 * proves a number through Supabase (updateUser, then verifyOtp), whose Phone provider
 * uses Twilio Verify, and that proof is what allows texts.
 */
const router = require('express').Router();
const { createClient } = require('@supabase/supabase-js');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { smsAvailable, normalizeJamaican } = require('../utils/smsSender');
const { canTextAtBranch } = require('../utils/smsAlerts');

const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const admin = () => createClient(process.env.SUPABASE_URL, serviceKey(), { auth: { persistSession: false } });

router.get('/status', async (req, res) => {
  try {
    const available = smsAvailable();
    const branch = req.query.branch_id ? await canTextAtBranch(String(req.query.branch_id)) : undefined;
    res.json({ available, ...(branch === undefined ? {} : { branch }) });
  } catch (err) {
    console.error('sms status:', err);
    res.json({ available: false });
  }
});

router.get('/preference', requireAuth, async (req, res) => {
  if (!req.dbUser) return res.status(403).json({ error: 'Clients only.' });
  try {
    const [[u]] = await pool.query('SELECT phone, sms_opt_in, phone_verified_at FROM users WHERE id = ?', [req.dbUser.id]);
    res.json({ available: smsAvailable(), phone: u?.phone || null, verified: Boolean(u?.phone_verified_at), opt_in: Number(u?.sms_opt_in) === 1 });
  } catch (err) {
    console.error('sms preference:', err);
    res.status(500).json({ error: 'Could not load your text settings.' });
  }
});

router.put('/preference', requireAuth, async (req, res) => {
  if (!req.dbUser) return res.status(403).json({ error: 'Clients only.' });
  try {
    const on = req.body?.opt_in === true;
    /* Supabase is what proved the phone, so its record decides. Whatever a phone
       field says, a number nobody verified is never texted. */
    const { data, error } = await admin().auth.admin.getUserById(req.dbUser.supabase_uid);
    if (error || !data?.user) return res.status(502).json({ error: 'Could not check your number. Try again.' });
    const phone = data.user.phone_confirmed_at ? normalizeJamaican(data.user.phone) : null;
    if (on && !phone) return res.status(409).json({ error: 'Add and verify a Jamaican mobile number first.' });

    await pool.query(
      `UPDATE users SET sms_opt_in = ?, sms_opt_in_at = IF(? = 1, NOW(), sms_opt_in_at),
              phone = COALESCE(?, phone), phone_verified_at = IF(? IS NULL, phone_verified_at, COALESCE(phone_verified_at, NOW()))
        WHERE id = ?`, [on ? 1 : 0, on ? 1 : 0, phone, phone, req.dbUser.id]);
    if (phone) {
      if (on) await pool.query('DELETE FROM sms_opt_outs WHERE phone = ?', [phone]);
      else await pool.query(`INSERT IGNORE INTO sms_opt_outs (phone, source) VALUES (?, 'app')`, [phone]);
    }
    res.json({ opt_in: on });
  } catch (err) {
    console.error('sms preference save:', err);
    res.status(500).json({ error: 'Could not save your text settings.' });
  }
});

/* The sender is a name, so nobody can reply STOP; this link is how a walk-in stops. */
router.post('/stop', authLimiter, async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim().toUpperCase();
    const [[t]] = await pool.query('SELECT user_id, guest_phone FROM queue_tickets WHERE sms_stop_code = ?', [code]);
    if (!t) return res.status(404).json({ error: 'That link has expired or is not right.' });
    const phone = normalizeJamaican(t.guest_phone);
    if (phone) await pool.query(`INSERT IGNORE INTO sms_opt_outs (phone, source) VALUES (?, 'link')`, [phone]);
    if (t.user_id) await pool.query('UPDATE users SET sms_opt_in = 0 WHERE id = ?', [t.user_id]);
    res.json({ stopped: true });
  } catch (err) {
    console.error('sms stop:', err);
    res.status(500).json({ error: 'Could not stop texts. Try again.' });
  }
});

module.exports = router;

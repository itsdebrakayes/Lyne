/**
 * sms.js — agreeing to texts, stopping them, and signing up by text.
 *
 * GET  /api/sms/status            is texting on (and, with branch_id, at this branch)?
 * GET  /api/sms/preference        my number and whether I get texts
 * PUT  /api/sms/preference        turn my texts on or off
 * POST /api/sms/stop              stop texts from the link in a message
 * POST /api/sms/signup/start      send a sign-up code
 * POST /api/sms/signup/finish     check it and create the account
 *
 * Why sign-up does not use Supabase's phone path: "Confirm email" is on, so a new
 * email account has no session until it confirms, and updateUser({ phone }) needs a
 * session. Here Twilio Verify proves the phone first, and only then is the account
 * made, with its email and that phone. It still cannot exist without an email.
 */
const router = require('express').Router();
const { z } = require('zod');
const { createClient } = require('@supabase/supabase-js');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const {
  smsAvailable, normalizeJamaican, refusal, record, startVerification, checkVerification,
} = require('../utils/smsSender');
const { canTextAtBranch } = require('../utils/smsAlerts');

const serviceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const admin = () => createClient(process.env.SUPABASE_URL, serviceKey(), { auth: { persistSession: false } });

const REFUSED = {
  throttled: 'Too many codes have gone to this number. Wait an hour and try again.',
  daily_cap: 'Text codes are busy right now. Try confirming by email instead.',
  opted_out: 'This number has asked not to be texted. Confirm by email instead.',
};

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

const startSchema = z.object({ phone: z.string().trim().min(7).max(20) });
const finishSchema = z.object({
  phone: z.string().trim().min(7).max(20),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  password: z.string().min(8, 'Use at least 8 characters.').max(72),
  full_name: z.string().trim().min(1).max(120),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const available = (res) => {
  if (smsAvailable() && process.env.TWILIO_VERIFY_SERVICE_SID) return true;
  res.status(503).json({ error: 'Text codes are not available right now. Confirm by email instead.' });
  return false;
};

router.post('/signup/start', authLimiter, async (req, res) => {
  const parsed = startSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter your mobile number.' });
  if (!available(res)) return undefined;
  const phone = normalizeJamaican(parsed.data.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a Jamaican mobile number, like 876-555-0100.' });
  try {
    const no = await refusal(phone);
    if (no) return res.status(429).json({ error: REFUSED[no] });
    await startVerification(phone);
    await record(phone, { purpose: 'signup_code', status: 'sent' });
    return res.json({ sent: true });
  } catch (err) {
    console.error('sms signup start:', err.code || err.message);
    if (err.code === 60203 || err.status === 429) return res.status(429).json({ error: REFUSED.throttled });
    return res.status(502).json({ error: 'Could not send a code. Check the number, or confirm by email instead.' });
  }
});

router.post('/signup/finish', authLimiter, async (req, res) => {
  const parsed = finishSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your details.' });
  if (!available(res)) return undefined;
  const { code, email, password, full_name: fullName, date_of_birth: dob } = parsed.data;
  const phone = normalizeJamaican(parsed.data.phone);
  if (!phone) return res.status(400).json({ error: 'Enter a Jamaican mobile number, like 876-555-0100.' });
  try {
    if (!(await checkVerification(phone, code))) return res.status(400).json({ error: 'That code is not right, or it has expired.' });
    const { error } = await admin().auth.admin.createUser({
      email, password, phone: phone.slice(1),
      /* The phone proved this person is real, which is what confirming an email was
         for here. The email itself is unproven; a password reset still goes to it. */
      email_confirm: true, phone_confirm: true,
      user_metadata: { full_name: fullName, phone, ...(dob ? { date_of_birth: dob } : {}) },
    });
    if (error) {
      const taken = /already|exists|registered/i.test(error.message);
      return res.status(taken ? 409 : 502).json({ error: taken ? 'That email or number already has an account. Sign in instead.' : 'Could not create your account. Try again.' });
    }
    return res.status(201).json({ created: true });
  } catch (err) {
    console.error('sms signup finish:', err.code || err.message);
    return res.status(502).json({ error: 'Could not check your code. Try again.' });
  }
});

module.exports = router;

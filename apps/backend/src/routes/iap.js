/**
 * iap.js — Lyne Premium bought in the app.
 *
 * POST /api/iap/verify  { platform, product_id, transaction_id | purchase_token }
 *
 * Called after every purchase and every "Restore purchases". The store is asked
 * whether the purchase is real, belongs to this Lyne account, and is still
 * running; only then does premium_until move. Expiry is the store's, so a
 * lapsed subscription ends Premium by itself (lib/premium.js hasPremium).
 */
const router = require('express').Router();
const { z } = require('zod');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { withPremiumState } = require('../lib/premium');
const store = require('../utils/storeVerification');

const verifySchema = z.discriminatedUnion('platform', [
  z.object({ platform: z.literal('ios'), product_id: z.string().max(120), transaction_id: z.string().regex(/^\d{1,30}$/) }),
  z.object({ platform: z.literal('android'), product_id: z.string().max(120), purchase_token: z.string().min(10).max(1024) }),
]);

router.post('/verify', requireAuth, async (req, res) => {
  if (!req.dbUser) return res.status(403).json({ error: 'User account required.' });
  const parsed = verifySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Send the platform, product and the store\'s purchase identifier.' });
  const body = parsed.data;
  if (!store.PRODUCTS.includes(body.product_id)) return res.status(400).json({ error: 'Unknown product.' });

  try {
    let result;
    let acknowledge = null;
    if (body.platform === 'ios') {
      const txn = await store.fetchAppleTransaction(body.transaction_id);
      result = store.appleEntitlement(txn, { userId: req.dbUser.id, bundleId: store.appleConfig().bundleId });
    } else {
      const { sub, acknowledge: ack } = await store.fetchGoogleSubscription(body.purchase_token);
      result = store.googleEntitlement(sub, { userId: req.dbUser.id, purchaseToken: body.purchase_token });
      acknowledge = ack;
    }
    if (!result.ok) return res.status(result.expired ? 410 : 402).json({ error: result.reason });

    const [taken] = await pool.query('SELECT user_id FROM iap_subscriptions WHERE store_ref = ?', [result.storeRef]);
    if (taken.length && taken[0].user_id !== req.dbUser.id) {
      return res.status(409).json({ error: 'This subscription is already linked to another Lyne account.' });
    }

    await pool.query(
      `INSERT INTO iap_subscriptions (id, user_id, platform, product_id, store_ref, expires_at, environment)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE product_id = VALUES(product_id), expires_at = VALUES(expires_at), environment = VALUES(environment)`,
      [randomUUID(), req.dbUser.id, body.platform, result.productId, result.storeRef, result.expiresAt, result.environment]
    );
    // Never shorten an entitlement that runs longer (a trial, or another store's subscription).
    await pool.query(
      `UPDATE users SET is_premium = TRUE,
              premium_until = GREATEST(COALESCE(premium_until, ?), ?), updated_at = NOW()
        WHERE id = ?`,
      [result.expiresAt, result.expiresAt, req.dbUser.id]
    );
    if (acknowledge && result.needsAcknowledge) await acknowledge(result.productId);

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.dbUser.id]);
    res.json({ user: withPremiumState(rows[0]), expires_at: result.expiresAt });
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: 'Purchases cannot be confirmed right now. Your store account has not been charged twice; try Restore purchases later.' });
    console.error('[iap] verify failed:', err.message);
    res.status(502).json({ error: 'The store could not confirm this purchase. Try Restore purchases in a moment.' });
  }
});

/** The products the app should load from the store, so the list lives in one place. */
router.get('/products', (_req, res) => res.json({ products: store.PRODUCTS }));

module.exports = router;

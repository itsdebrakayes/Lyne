/**
 * storeVerification.js — asks Apple or Google whether a purchase is real.
 *
 * The app never decides that someone has paid. It hands the server the store's
 * identifier for the purchase; the server asks the store directly and grants
 * Lyne Premium only on the store's answer. There is no test card, bypass or
 * debug grant: sandbox purchases (TestFlight, Play internal testing) go through
 * the same path against the stores' sandbox environments.
 *
 * Apple: App Store Server API, "Get Transaction Info", authenticated with an
 *   In-App Purchase key (App Store Connect → Users and Access → Integrations).
 *   Env: APPSTORE_ISSUER_ID, APPSTORE_KEY_ID, APPSTORE_PRIVATE_KEY (or
 *   APPSTORE_PRIVATE_KEY_PATH), APPSTORE_BUNDLE_ID (default com.lyne.mobile).
 * Google: Play Developer API, purchases.subscriptionsv2, authenticated with a
 *   service account that has access in Play Console.
 *   Env: GOOGLE_PLAY_SERVICE_ACCOUNT (the JSON) or
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_PATH, PLAY_PACKAGE_NAME (default com.lyne.mobile).
 *
 * Without credentials verification is refused, never assumed.
 */
const crypto = require('crypto');
const fs = require('fs');

/** The only things Lyne sells. The same identifiers are created in both stores. */
const PRODUCTS = Object.freeze(['com.lyne.mobile.premium.monthly', 'com.lyne.mobile.premium.yearly']);

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

function readFileOrEnv(value, path) {
  if (value) return value.replace(/\\n/g, '\n');
  if (path) { try { return fs.readFileSync(path, 'utf8'); } catch { return null; } }
  return null;
}

function appleConfig(env = process.env) {
  return {
    issuerId: env.APPSTORE_ISSUER_ID || null,
    keyId: env.APPSTORE_KEY_ID || null,
    key: readFileOrEnv(env.APPSTORE_PRIVATE_KEY, env.APPSTORE_PRIVATE_KEY_PATH),
    bundleId: env.APPSTORE_BUNDLE_ID || 'com.lyne.mobile',
  };
}

function googleConfig(env = process.env) {
  const raw = readFileOrEnv(env.GOOGLE_PLAY_SERVICE_ACCOUNT, env.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH);
  let account = null;
  try { account = raw ? JSON.parse(raw) : null; } catch { account = null; }
  return { account, packageName: env.PLAY_PACKAGE_NAME || 'com.lyne.mobile' };
}

function appleToken(cfg, now = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId, typ: 'JWT' }));
  const claims = b64url(JSON.stringify({ iss: cfg.issuerId, iat: now, exp: now + 15 * 60, aud: 'appstoreconnect-v1', bid: cfg.bundleId }));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), { key: cfg.key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${claims}.${b64url(sig)}`;
}

/** The payload of a JWS Apple returned to us over TLS. */
function decodeJws(jws) {
  const part = String(jws || '').split('.')[1];
  if (!part) return null;
  try { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')); } catch { return null; }
}

/**
 * Whether an Apple transaction grants Premium to this user. Pure, so the rules
 * are tested without a network.
 */
function appleEntitlement(txn, { userId, bundleId, now = Date.now() }) {
  if (!txn) return { ok: false, reason: 'Apple did not return this purchase.' };
  if (txn.bundleId !== bundleId) return { ok: false, reason: 'This purchase belongs to a different app.' };
  if (!PRODUCTS.includes(txn.productId)) return { ok: false, reason: 'Unknown product.' };
  if (txn.revocationDate) return { ok: false, reason: 'This purchase was refunded or revoked.' };
  if (!txn.appAccountToken || txn.appAccountToken.toLowerCase() !== String(userId).toLowerCase()) {
    return { ok: false, reason: 'This purchase was made from a different Lyne account.' };
  }
  const expires = Number(txn.expiresDate);
  if (!expires || expires <= now) return { ok: false, reason: 'This subscription has expired.', expired: true };
  return {
    ok: true,
    productId: txn.productId,
    storeRef: String(txn.originalTransactionId),
    expiresAt: new Date(expires),
    environment: txn.environment === 'Sandbox' ? 'sandbox' : 'production',
  };
}

/** Whether a Google subscriptionsv2 resource grants Premium to this user. Pure. */
function googleEntitlement(sub, { userId, purchaseToken, now = Date.now() }) {
  if (!sub) return { ok: false, reason: 'Google did not return this purchase.' };
  const active = ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED'];
  if (!active.includes(sub.subscriptionState)) return { ok: false, reason: 'This subscription is not active.', expired: true };
  const line = (sub.lineItems || []).find((l) => PRODUCTS.includes(l.productId));
  if (!line) return { ok: false, reason: 'Unknown product.' };
  const owner = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (!owner || owner !== String(userId)) return { ok: false, reason: 'This purchase was made from a different Lyne account.' };
  const expires = Date.parse(line.expiryTime);
  // CANCELED still runs to the end of the period the person paid for.
  if (!expires || expires <= now) return { ok: false, reason: 'This subscription has expired.', expired: true };
  return {
    ok: true,
    productId: line.productId,
    // An upgrade or resubscribe issues a new token that names the one it replaced.
    storeRef: sub.linkedPurchaseToken || purchaseToken,
    expiresAt: new Date(expires),
    environment: sub.testPurchase ? 'sandbox' : 'production',
    needsAcknowledge: sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING',
  };
}

async function fetchAppleTransaction(transactionId, cfg = appleConfig()) {
  if (!cfg.issuerId || !cfg.keyId || !cfg.key) throw Object.assign(new Error('App Store verification is not configured.'), { status: 503 });
  const auth = { Authorization: `Bearer ${appleToken(cfg)}` };
  for (const host of ['https://api.storekit.itunes.apple.com', 'https://api.storekit-sandbox.itunes.apple.com']) {
    const res = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, { headers: auth });
    if (res.status === 404) continue; // a sandbox purchase is unknown to production, and vice versa
    if (!res.ok) throw Object.assign(new Error(`App Store returned ${res.status}.`), { status: 502 });
    const body = await res.json();
    return decodeJws(body.signedTransactionInfo);
  }
  return null;
}

async function googleAccessToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: account.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), account.private_key);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${b64url(sig)}` }),
  });
  if (!res.ok) throw Object.assign(new Error('Google sign-in for verification failed.'), { status: 502 });
  return (await res.json()).access_token;
}

async function fetchGoogleSubscription(purchaseToken, cfg = googleConfig()) {
  if (!cfg.account?.client_email || !cfg.account?.private_key) {
    throw Object.assign(new Error('Google Play verification is not configured.'), { status: 503 });
  }
  const token = await googleAccessToken(cfg.account);
  const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(cfg.packageName)}/purchases`;
  const res = await fetch(`${base}/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404 || res.status === 410) return { sub: null };
  if (!res.ok) throw Object.assign(new Error(`Google Play returned ${res.status}.`), { status: 502 });
  const sub = await res.json();
  /* Google refunds a purchase that is not acknowledged within three days, so
     the server acknowledges as soon as it has verified one. */
  const acknowledge = async (productId) => {
    await fetch(`${base}/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}',
    }).catch(() => {});
  };
  return { sub, acknowledge };
}

module.exports = {
  PRODUCTS, appleConfig, googleConfig, appleToken, decodeJws,
  appleEntitlement, googleEntitlement, fetchAppleTransaction, fetchGoogleSubscription,
};

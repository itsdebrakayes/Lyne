/**
 * The rules for granting Lyne Premium from an Apple or Google purchase.
 * No network: the store responses are written out as the stores send them.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { appleEntitlement, googleEntitlement, appleToken, decodeJws, PRODUCTS } = require('../src/utils/storeVerification');

const USER = '6f1c2a9e-1111-4b4b-9a9a-123456789abc';
const NOW = Date.parse('2026-10-08T12:00:00Z');
const IN_A_MONTH = NOW + 30 * 86400000;

const apple = (over = {}) => ({
  bundleId: 'com.lyne.mobile', productId: 'com.lyne.mobile.premium.monthly',
  originalTransactionId: '2000000123456789', appAccountToken: USER,
  expiresDate: IN_A_MONTH, environment: 'Sandbox', ...over,
});

test('a current Apple subscription bought from this account grants Premium until it renews', () => {
  const r = appleEntitlement(apple(), { userId: USER, bundleId: 'com.lyne.mobile', now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.expiresAt.getTime(), IN_A_MONTH);
  assert.equal(r.storeRef, '2000000123456789', 'keyed on the original transaction so renewals update one row');
  assert.equal(r.environment, 'sandbox');
});

test('Apple: refused for another account, another app, an unknown product, a refund, or after expiry', () => {
  const opts = { userId: USER, bundleId: 'com.lyne.mobile', now: NOW };
  assert.equal(appleEntitlement(apple({ appAccountToken: 'someone-else' }), opts).ok, false);
  assert.equal(appleEntitlement(apple({ appAccountToken: undefined }), opts).ok, false);
  assert.equal(appleEntitlement(apple({ bundleId: 'com.other.app' }), opts).ok, false);
  assert.equal(appleEntitlement(apple({ productId: 'com.lyne.mobile.coins' }), opts).ok, false);
  assert.equal(appleEntitlement(apple({ revocationDate: NOW - 1000 }), opts).ok, false);
  const expired = appleEntitlement(apple({ expiresDate: NOW - 1 }), opts);
  assert.equal(expired.ok, false);
  assert.equal(expired.expired, true);
  assert.equal(appleEntitlement(null, opts).ok, false);
});

const google = (over = {}) => ({
  subscriptionState: 'SUBSCRIPTION_STATE_ACTIVE',
  acknowledgementState: 'ACKNOWLEDGEMENT_STATE_PENDING',
  externalAccountIdentifiers: { obfuscatedExternalAccountId: USER },
  lineItems: [{ productId: 'com.lyne.mobile.premium.yearly', expiryTime: new Date(IN_A_MONTH).toISOString() }],
  ...over,
});

test('an active Google subscription from this account grants Premium and asks to be acknowledged', () => {
  const r = googleEntitlement(google(), { userId: USER, purchaseToken: 'tok-1', now: NOW });
  assert.equal(r.ok, true);
  assert.equal(r.productId, 'com.lyne.mobile.premium.yearly');
  assert.equal(r.needsAcknowledge, true, 'unacknowledged purchases are refunded by Google after three days');
  assert.equal(r.storeRef, 'tok-1');
});

test('a cancelled Google subscription still runs to the end of the paid period', () => {
  const r = googleEntitlement(google({ subscriptionState: 'SUBSCRIPTION_STATE_CANCELED' }), { userId: USER, purchaseToken: 't', now: NOW });
  assert.equal(r.ok, true);
});

test('a resubscription keeps one row by following the linked token', () => {
  const r = googleEntitlement(google({ linkedPurchaseToken: 'tok-original' }), { userId: USER, purchaseToken: 'tok-new', now: NOW });
  assert.equal(r.storeRef, 'tok-original');
});

test('Google: refused for another account, expired, on hold, or unknown products', () => {
  const opts = { userId: USER, purchaseToken: 't', now: NOW };
  assert.equal(googleEntitlement(google({ externalAccountIdentifiers: {} }), opts).ok, false);
  assert.equal(googleEntitlement(google({ subscriptionState: 'SUBSCRIPTION_STATE_ON_HOLD' }), opts).ok, false);
  assert.equal(googleEntitlement(google({ subscriptionState: 'SUBSCRIPTION_STATE_EXPIRED' }), opts).ok, false);
  assert.equal(googleEntitlement(google({ lineItems: [{ productId: 'other', expiryTime: new Date(IN_A_MONTH).toISOString() }] }), opts).ok, false);
  assert.equal(googleEntitlement(google({ lineItems: [{ productId: PRODUCTS[0], expiryTime: new Date(NOW - 1).toISOString() }] }), opts).ok, false);
});

test('the App Store Server API token carries the right audience and bundle, and verifies', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwt = appleToken({ issuerId: 'iss-1', keyId: 'KEY123', key: privateKey.export({ type: 'pkcs8', format: 'pem' }), bundleId: 'com.lyne.mobile' }, 1700000000);
  const [h, c, s] = jwt.split('.');
  const claims = JSON.parse(Buffer.from(c, 'base64url'));
  assert.equal(claims.aud, 'appstoreconnect-v1');
  assert.equal(claims.bid, 'com.lyne.mobile');
  assert.equal(claims.exp - claims.iat, 900);
  assert.ok(crypto.verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url')));
});

test('decodeJws reads the payload Apple signed', () => {
  const payload = Buffer.from(JSON.stringify({ productId: PRODUCTS[0] })).toString('base64url');
  assert.deepEqual(decodeJws(`h.${payload}.s`), { productId: PRODUCTS[0] });
  assert.equal(decodeJws('garbage'), null);
});

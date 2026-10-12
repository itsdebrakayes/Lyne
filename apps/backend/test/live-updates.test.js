/**
 * The lock-screen ticket: the state it draws and the push that carries it.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { buildContentState, buildApnsPayload } = require('../src/utils/liveUpdates');
const { makeProviderToken, isConfigured, readConfig } = require('../src/utils/apnsSender');

const row = (over = {}) => ({
  status: 'waiting', waiting_position: 4, resolved_since_join: 6,
  service_minutes: 6, active_counters: 2, verification_code: 'K7MQ2X', ...over,
});

test('a waiting ticket reports the people ahead, a wait, and forward-only progress', () => {
  const s = buildContentState(row());
  assert.equal(s.status, 'waiting');
  assert.equal(s.ahead, 3);
  assert.ok(s.waitMinutes > 0);
  assert.equal(s.progress, 0.67, 'six of the nine ahead at join have been dealt with');
  assert.equal(s.code, null, 'the code stays off the lock screen until the person is called');
});

test('first in line is nearly full but never complete while still waiting', () => {
  const s = buildContentState(row({ waiting_position: 1, resolved_since_join: 0 }));
  assert.equal(s.ahead, 0);
  assert.ok(s.progress < 1);
});

test('a called ticket shows its code and a full bar', () => {
  const s = buildContentState(row({ status: 'called' }));
  assert.equal(s.ahead, 0);
  assert.equal(s.progress, 1);
  assert.equal(s.code, 'K7MQ2X');
});

test('a finished ticket is reported as ended', () => {
  assert.equal(buildContentState(row({ status: 'served' })).status, 'ended');
  assert.equal(buildContentState(row({ status: 'left' })).status, 'ended');
});

test('the called update alerts; ordinary updates are silent', () => {
  const called = buildApnsPayload(buildContentState(row({ status: 'called' })), { ticketNumber: 'PAY-008', now: 1000 });
  assert.match(called.aps.alert.title, /PAY-008/);
  assert.equal(called.aps.sound, 'default');
  const quiet = buildApnsPayload(buildContentState(row()), { now: 1000 });
  assert.equal(quiet.aps.alert, undefined);
  assert.equal(quiet.aps.event, 'update');
  assert.equal(quiet.aps['content-state'].ahead, 3);
});

test('an end event schedules the dismissal', () => {
  const p = buildApnsPayload(buildContentState(row({ status: 'served' })), { event: 'end', now: 1000 });
  assert.equal(p.aps.event, 'end');
  assert.equal(p.aps['dismissal-date'], 1300);
});

test('the APNs provider token is an ES256 JWT that verifies with the key', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const config = { keyId: 'ABC123DEFG', teamId: 'UD8HYB75P4', key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const jwt = makeProviderToken(config, 1700000000);
  const [h, c, sig] = jwt.split('.');
  assert.deepEqual(JSON.parse(Buffer.from(h, 'base64url')), { alg: 'ES256', kid: 'ABC123DEFG' });
  assert.deepEqual(JSON.parse(Buffer.from(c, 'base64url')), { iss: 'UD8HYB75P4', iat: 1700000000 });
  const ok = crypto.verify('sha256', Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url'));
  assert.ok(ok, 'signature must verify, or Apple answers 403 InvalidProviderToken');
});

test('without the APNs key nothing is sent', () => {
  assert.equal(isConfigured(readConfig({})), false);
});

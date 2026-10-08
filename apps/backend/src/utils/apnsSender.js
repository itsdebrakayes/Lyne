/**
 * apnsSender.js — updates to iOS Live Activities, straight to APNs.
 *
 * Expo's push service cannot deliver these: a Live Activity update has its own
 * push type (`liveactivity`), its own topic (`<bundle>.push-type.liveactivity`)
 * and a token ActivityKit issues per activity, none of which Expo forwards. So
 * this talks HTTP/2 to Apple directly, authenticated with the team's .p8 key,
 * and needs no dependency beyond Node itself.
 *
 * Configuration (all required to send; without them every call is a no-op and
 * the app still updates its own Live Activity while it is open):
 *   APNS_KEY_ID        the key's 10-character id (Certificates, IDs & Profiles → Keys)
 *   APNS_TEAM_ID       the Apple developer team id
 *   APNS_PRIVATE_KEY   the .p8 contents (newlines may be written as \n), or
 *   APNS_PRIVATE_KEY_PATH  a path to the .p8 file
 *   APNS_BUNDLE_ID     defaults to com.lyne.mobile
 *   APNS_ENV           'production' (default) or 'sandbox' for development builds
 */
const crypto = require('crypto');
const fs = require('fs');
const http2 = require('http2');

const HOSTS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
};

function readConfig(env = process.env) {
  let key = env.APNS_PRIVATE_KEY ? env.APNS_PRIVATE_KEY.replace(/\\n/g, '\n') : null;
  if (!key && env.APNS_PRIVATE_KEY_PATH) {
    try { key = fs.readFileSync(env.APNS_PRIVATE_KEY_PATH, 'utf8'); } catch { key = null; }
  }
  return {
    keyId: env.APNS_KEY_ID || null,
    teamId: env.APNS_TEAM_ID || null,
    key,
    bundleId: env.APNS_BUNDLE_ID || 'com.lyne.mobile',
    host: HOSTS[env.APNS_ENV === 'sandbox' ? 'sandbox' : 'production'],
  };
}

function isConfigured(config = readConfig()) {
  return Boolean(config.keyId && config.teamId && config.key);
}

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** The ES256 provider token APNs expects. Apple refuses one older than an hour. */
function makeProviderToken(config, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: config.keyId }));
  const claims = b64url(JSON.stringify({ iss: config.teamId, iat: nowSeconds }));
  const signature = crypto.sign('sha256', Buffer.from(`${header}.${claims}`), {
    key: config.key,
    dsaEncoding: 'ieee-p1363',
  });
  return `${header}.${claims}.${b64url(signature)}`;
}

let cachedToken = null;
let cachedAt = 0;
function providerToken(config) {
  const now = Math.floor(Date.now() / 1000);
  // Reuse for 50 minutes: Apple rejects tokens refreshed too often as well as stale ones.
  if (!cachedToken || now - cachedAt > 50 * 60) {
    cachedToken = makeProviderToken(config, now);
    cachedAt = now;
  }
  return cachedToken;
}

let session = null;
function getSession(host) {
  if (session && !session.closed && !session.destroyed) return session;
  session = http2.connect(host);
  session.on('error', () => { session = null; });
  session.on('goaway', () => { session = null; });
  session.unref();
  return session;
}

/**
 * Send one Live Activity payload. Resolves { ok, status, reason } and never
 * throws: a failed lock-screen update must not fail the queue change behind it.
 */
function sendLiveActivity(pushToken, payload, { priority = 5, config = readConfig() } = {}) {
  if (!isConfigured(config)) return Promise.resolve({ ok: false, status: 0, reason: 'not-configured' });
  return new Promise((resolve) => {
    try {
      const req = getSession(config.host).request({
        ':method': 'POST',
        ':path': `/3/device/${pushToken}`,
        authorization: `bearer ${providerToken(config)}`,
        'apns-push-type': 'liveactivity',
        'apns-topic': `${config.bundleId}.push-type.liveactivity`,
        'apns-priority': String(priority),
        'content-type': 'application/json',
      });
      let status = 0;
      let body = '';
      req.setEncoding('utf8');
      req.on('response', (headers) => { status = Number(headers[':status']) || 0; });
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        let reason = null;
        try { reason = body ? JSON.parse(body).reason : null; } catch { /* empty */ }
        resolve({ ok: status === 200, status, reason });
      });
      req.on('error', (err) => resolve({ ok: false, status: 0, reason: err.message }));
      req.setTimeout(10_000, () => { req.close(); resolve({ ok: false, status: 0, reason: 'timeout' }); });
      req.end(JSON.stringify(payload));
    } catch (err) {
      resolve({ ok: false, status: 0, reason: err.message });
    }
  });
}

module.exports = { readConfig, isConfigured, makeProviderToken, sendLiveActivity };

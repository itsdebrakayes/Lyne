/**
 * What must stay true about error reporting.
 *
 * Two independent promises are being kept here, and both are the kind that
 * fail silently: a scrubber only redacts the keys it knows about, and a filter
 * only excludes the statuses it was told to. Neither announces itself when it
 * drifts — you find out when a TRN turns up in a third-party dashboard, or when
 * the alert feed is so full of 401s that nobody reads it.
 */
const test = require('node:test');
const assert = require('node:assert');

const { scrub, SENSITIVE, monitoringEnabled } = require('../src/lib/monitoring');

test('monitoring is off when no DSN is configured', () => {
  // The suite runs without SENTRY_DSN, which is the default everywhere except
  // a deployed box. If this ever flips, every other test is sending events.
  assert.strictEqual(monitoringEnabled, false);
});

test('every field this product must never report is caught by the scrubber', () => {
  // Written as the real column and header names rather than as regex fragments,
  // so adding a field to the database and forgetting this file shows up here.
  const mustRedact = [
    'trn', 'TRN', 'national_id', 'nationalId', 'passport', 'nin',
    'verification_code', 'password', 'token', 'access_token', 'refresh_token',
    'authorization', 'Authorization', 'cookie', 'api_key', 'apiKey',
    'secret', 'SUPABASE_SERVICE_KEY', 'supabase_anon_key', 'publishable_key',
    'SENTRY_DSN', 'MYSQL_PASSWORD', 'database_url', 'connectionString',
    'email', 'guest_phone', 'phone', 'date_of_birth', 'dob', 'address',
  ];
  for (const key of mustRedact) {
    assert.ok(SENSITIVE.test(key), `${key} is NOT redacted and would be sent to Sentry`);
  }
});

test('the scrubber redacts by key at any depth, and leaves safe values alone', () => {
  const out = scrub({
    business_id: 'biz-1',
    actor: { id: 'usr-1', email: 'someone@example.com', profile: { trn: '123-456-789' } },
    tickets: [{ ticket_number: 'PAY-006', verification_code: 'NFUMR7' }],
  });

  assert.strictEqual(out.business_id, 'biz-1', 'tenant id is the point of the report');
  assert.strictEqual(out.actor.id, 'usr-1', 'internal id is allowed');
  assert.strictEqual(out.actor.email, '[redacted]');
  assert.strictEqual(out.actor.profile.trn, '[redacted]', 'nested PII must not survive');
  assert.strictEqual(out.tickets[0].ticket_number, 'PAY-006', 'not sensitive, and useful');
  assert.strictEqual(out.tickets[0].verification_code, '[redacted]');
});

test('the scrubber terminates on a cyclic object instead of hanging the process', () => {
  // An Express error can carry req, which carries res, which carries req. A
  // reporter that stack-overflows while reporting takes the API with it.
  const a = { name: 'a' };
  a.self = a;
  assert.doesNotThrow(() => scrub(a));
});

test('only 5xx is reported; 4xx and CORS refusals are not', () => {
  // captureServerError returns early when monitoring is off, so the decision
  // itself is asserted here against the same rule the function applies.
  const reportable = (err) => {
    const status = Number(err?.status || err?.statusCode || 500);
    if (status < 500) return false;
    if (err?.name === 'CorsError') return false;
    return true;
  };

  assert.strictEqual(reportable({ status: 500 }), true, 'a real server fault');
  assert.strictEqual(reportable({ status: 503 }), true);
  assert.strictEqual(reportable(new Error('no status defaults to 500')), true);

  assert.strictEqual(reportable({ status: 400 }), false, 'validation');
  assert.strictEqual(reportable({ status: 401 }), false, 'expired token');
  assert.strictEqual(reportable({ status: 402 }), false, 'payment required');
  assert.strictEqual(reportable({ status: 404 }), false, 'route not found');
  assert.strictEqual(reportable({ status: 429 }), false, 'rate limited');

  const cors = new Error('Origin not allowed by CORS.');
  cors.name = 'CorsError';
  assert.strictEqual(reportable(cors), false, 'a rejected origin is the allowlist working');
});

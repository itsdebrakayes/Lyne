/**
 * portal-handoff.test.js
 *
 * /account exists on a marketing site with no "Log in" in the nav, because
 * Apple will not let the app sell a subscription and the purchase has to happen
 * somewhere. A login form on a public URL is an invitation to credential-stuff
 * it, so the route only renders for somebody who arrived from the app.
 *
 * The honest limit, stated in the module and pinned here: a URL cannot be
 * secret in a browser. What the token buys is that typing /account is
 * indistinguishable from typing any other unknown path.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.PORTAL_HANDOFF_SECRET = SECRET;

const handoff = require('../src/lib/portalHandoff');

test('a freshly issued token verifies and names its user', () => {
  const token = handoff.issue('user-1');
  assert.ok(token, 'a configured portal issues tokens');
  const result = handoff.verify(token);
  assert.equal(result.valid, true);
  assert.equal(result.userId, 'user-1');
});

test('a token expires, and ten minutes is the window', () => {
  const now = Date.now();
  const token = handoff.issue('user-1', now);
  assert.equal(handoff.verify(token, now + handoff.TTL_MS - 1000).valid, true, 'still good just before');
  assert.equal(handoff.verify(token, now + handoff.TTL_MS + 1000).valid, false, 'dead just after');
  assert.equal(handoff.TTL_MS, 10 * 60 * 1000);
});

test('a tampered user id does not verify', () => {
  /* The whole point: the payload is signed, so swapping the user id in a token
     you legitimately hold does not get you somebody else's portal. */
  const token = handoff.issue('user-1');
  const [, exp, nonce, sig] = token.split('.');
  assert.equal(handoff.verify(`user-2.${exp}.${nonce}.${sig}`).valid, false);
});

test('a tampered expiry does not verify', () => {
  const token = handoff.issue('user-1', Date.now() - handoff.TTL_MS * 2);
  const [uid, , nonce, sig] = token.split('.');
  const future = Date.now() + 86400000;
  assert.equal(handoff.verify(`${uid}.${future}.${nonce}.${sig}`).valid, false,
    'extending your own token must not work');
});

test('a forged signature does not verify', () => {
  const token = handoff.issue('user-1');
  const parts = token.split('.');
  parts[3] = 'nope';
  assert.equal(handoff.verify(parts.join('.')).valid, false);
});

test('malformed input is refused rather than thrown on', () => {
  for (const bad of [undefined, null, '', 'x', 'a.b.c', 'a.b.c.d.e', 42, {}, 'x'.repeat(600)]) {
    const result = handoff.verify(bad);
    assert.equal(result.valid, false, `${String(bad).slice(0, 20)} must not verify`);
  }
});

test('two tokens for the same user differ', () => {
  // A nonce, so a token is not a stable string somebody can memorise or reuse
  // from a screenshot taken days earlier.
  assert.notEqual(handoff.issue('user-1'), handoff.issue('user-1'));
});

test('with no secret configured, nothing is issued and nothing verifies', () => {
  /* Fail closed. A handoff signed with a well-known fallback would be forgeable
     by anyone who has read this repository, and "it worked in development" is
     exactly how that reaches production. */
  const saved = process.env.PORTAL_HANDOFF_SECRET;
  delete process.env.PORTAL_HANDOFF_SECRET;
  assert.equal(handoff.issue('user-1'), null);
  assert.equal(handoff.verify('anything').valid, false);
  process.env.PORTAL_HANDOFF_SECRET = saved;
});

test('a short secret counts as unconfigured', () => {
  const saved = process.env.PORTAL_HANDOFF_SECRET;
  process.env.PORTAL_HANDOFF_SECRET = 'tooshort';
  assert.equal(handoff.issue('user-1'), null);
  process.env.PORTAL_HANDOFF_SECRET = saved;
});

test('a token signed with a different secret does not verify', () => {
  const token = handoff.issue('user-1');
  const saved = process.env.PORTAL_HANDOFF_SECRET;
  process.env.PORTAL_HANDOFF_SECRET = 'a-completely-different-secret-of-sufficient-length';
  assert.equal(handoff.verify(token).valid, false);
  process.env.PORTAL_HANDOFF_SECRET = saved;
});

/**
 * Reopening the app after the access token expired, while the auth server was
 * down, showed the Sign in form: getSession answers `session: null` for that as
 * well as for nobody signed in. These pin src/lib/storedSession.ts, which
 * tells the two apart.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthApiError, AuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import { readStoredSession } from '../src/lib/storedSession';

const session = { access_token: 'a', refresh_token: 'r', user: { id: 'u1' } } as unknown as Session;

test('a session on the phone is signed in', () => {
  assert.deepEqual(readStoredSession({ data: { session }, error: null }), { kind: 'signed-in', session });
});

test('no session and no error is signed out', () => {
  assert.deepEqual(readStoredSession({ data: { session: null }, error: null }), { kind: 'signed-out' });
});

test('a refresh that hit a server error keeps the person signed in', () => {
  const error = new AuthRetryableFetchError('Internal Server Error', 500);
  assert.deepEqual(readStoredSession({ data: { session: null }, error }), { kind: 'unreachable' });
});

test('a refresh that never reached the server keeps the person signed in', () => {
  const error = new AuthRetryableFetchError('Network request failed', 0);
  assert.deepEqual(readStoredSession({ data: { session: null }, error }), { kind: 'unreachable' });
});

test('a refresh token the server rejected is signed out', () => {
  const error = new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found');
  assert.deepEqual(readStoredSession({ data: { session: null }, error }), { kind: 'signed-out' });
});

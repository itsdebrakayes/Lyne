/**
 * What the session on this phone says about the person, read from
 * `supabase.auth.getSession()`.
 *
 * getSession answers `session: null` for two different things. One is nobody
 * signed in. The other is a session whose access token had expired (anyone
 * reopening the app after an hour) and whose refresh failed because the auth
 * server could not be reached or answered with a server error. The library
 * keeps that session in storage and retries it every 30 seconds, but the
 * `null` alone reads as signed out, and the app showed the Sign in form to
 * people who were still signed in.
 *
 * The error tells them apart: a retryable fetch error means "we could not ask",
 * never "the answer was no".
 */
import { isAuthRetryableFetchError, type AuthError, type Session } from '@supabase/supabase-js';

export type StoredSession =
  | { kind: 'signed-in'; session: Session }
  | { kind: 'signed-out' }
  | { kind: 'unreachable' };

export function readStoredSession(result: {
  data: { session: Session | null };
  error: AuthError | null;
}): StoredSession {
  const { session } = result.data;
  if (session) return { kind: 'signed-in', session };
  if (result.error && isAuthRetryableFetchError(result.error)) return { kind: 'unreachable' };
  return { kind: 'signed-out' };
}

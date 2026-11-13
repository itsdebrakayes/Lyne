/**
 * apiClient.ts — Admin Desktop API Client
 *
 * Attaches the Supabase JWT to every request to the Lyne backend.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
/* The localhost fallback is behind import.meta.env.DEV deliberately. Vite
   replaces that with `false` in a production build and the minifier then drops
   the branch, so the string `http://localhost:4000/api` does not exist in a
   shipped bundle at all — which is what makes the build-time localhost check
   in scripts/assert-production-bundle.mjs meaningful rather than a check that
   can never pass. */
export const API_URL = (import.meta.env.VITE_API_URL as string)
  || (import.meta.env.DEV ? 'http://localhost:4000/api' : '');

/* pkce: a Microsoft sign-in returns a one-time code that only this app can
   trade for a session (it holds the verifier). detectSessionInUrl is off so the
   code is handled in one place, lib/microsoftSignIn.ts, not twice. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { flowType: 'pkce', detectSessionInUrl: false },
});

async function getToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  requireAuth = true
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (requireAuth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText })) as { error?: string; message?: string; code?: string };
    /* The server wants the two-factor code (or a set-up): useAdminAuth listens. */
    if (res.status === 403 && (err.code === 'mfa_required' || err.code === 'mfa_enrollment_required')) {
      window.dispatchEvent(new Event('lyne:mfa'));
    }
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

/** A file from the API (for example an export). Returns the bytes and the
 *  file name the server suggested. Errors carry the server's own message. */
export async function downloadFile(method: 'GET' | 'POST', path: string): Promise<{ blob: Blob; filename: string | null }> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText })) as { error?: string; message?: string };
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') || '');
  return { blob: await res.blob(), filename: name ? name[1] : null };
}

const api = {
  get:    <T>(path: string, auth = true) => request<T>('GET',    path, undefined, auth),
  post:   <T>(path: string, body: unknown, auth = true) => request<T>('POST',   path, body, auth),
  put:    <T>(path: string, body: unknown, auth = true) => request<T>('PUT',    path, body, auth),
  delete: <T>(path: string, auth = true) => request<T>('DELETE', path, undefined, auth),
};

export default api;

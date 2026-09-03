/**
 * apiClient.ts — Mobile API Client
 *
 * Attaches the Supabase JWT to every request to the LYNE backend.
 */

import { createClient } from '@supabase/supabase-js';
import secureSessionStorage from './secureSessionStorage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

type ExpoExtra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  apiUrl?: string;
};

type ExpoConstantsWithHosts = typeof Constants & {
  expoConfig?: NonNullable<typeof Constants.expoConfig> & { hostUri?: string };
  manifest?: { debuggerHost?: string };
  manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
};

const expoConstants = Constants as ExpoConstantsWithHosts;
const expoExtra = (expoConstants.expoConfig?.extra || {}) as ExpoExtra;

function normalizeApiUrl(url: string) {
  return url.replace(/\/+$/, '');
}

function parseHost(hostUri?: unknown) {
  if (typeof hostUri !== 'string' || hostUri.trim() === '') return '';
  const hostPort = hostUri.trim().replace(/^[a-z]+:\/\//i, '').split('/')[0];
  if (hostPort.startsWith('[')) return hostPort.slice(1, hostPort.indexOf(']'));
  return hostPort.split(':')[0];
}

function inferApiUrl() {
  const configuredUrl = expoExtra.apiUrl?.trim();
  if (configuredUrl) return normalizeApiUrl(configuredUrl);

  const expoHost = parseHost(
    expoConstants.expoConfig?.hostUri
      || expoConstants.manifest2?.extra?.expoClient?.hostUri
      || expoConstants.manifest?.debuggerHost
  );

  /* Development conveniences only. A release build has no Expo host and no
     localhost worth reaching, so falling through to a plain-HTTP dev address
     shipped an app that silently could not talk to anything on a real device.
     An unset EXPO_PUBLIC_API_URL is a configuration error — surface it loudly
     at startup rather than papering over it. */
  if (__DEV__) {
    if (expoHost && !['localhost', '127.0.0.1', '::1'].includes(expoHost)) {
      return `http://${expoHost}:4000/api`;
    }
    return Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api';
  }

  throw new Error('EXPO_PUBLIC_API_URL is not set. A release build cannot start without its API URL.');
}

const SUPABASE_URL = expoExtra.supabaseUrl || '';
const SUPABASE_ANON = expoExtra.supabaseAnonKey || '';
const API_URL = inferApiUrl();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:          secureSessionStorage,
    autoRefreshToken: true,
    persistSession:   true,
    detectSessionInUrl: false,
  },
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
    const err = await res.json().catch(() => ({ message: res.statusText }));
    /* Carry the status on the error.
       "The server refused you" and "the server could not be reached" are
       different problems with opposite correct responses — sign the person out
       for the first, keep their session for the second — and a bare Error
       makes them indistinguishable at the catch site. A transport failure
       never gets this far, so an error WITHOUT a status is a connectivity
       failure by construction. */
    throw Object.assign(
      new Error(err.error || err.message || `HTTP ${res.status}`),
      { status: res.status },
    );
  }

  return res.json() as Promise<T>;
}

/** True when a request never reached the server, as opposed to being refused
 *  by it. See the throw site above for why the absence of a status is the
 *  signal. */
export function isOffline(error: unknown): boolean {
  return error instanceof Error && typeof (error as { status?: number }).status !== 'number';
}

const api = {
  get:    <T>(path: string, auth = true) => request<T>('GET',    path, undefined, auth),
  post:   <T>(path: string, body: unknown, auth = true) => request<T>('POST',   path, body, auth),
  put:    <T>(path: string, body: unknown, auth = true) => request<T>('PUT',    path, body, auth),
  patch:  <T>(path: string, body: unknown, auth = true) => request<T>('PATCH',  path, body, auth),
  delete: <T>(path: string, auth = true) => request<T>('DELETE', path, undefined, auth),
};

export { API_URL };
export default api;

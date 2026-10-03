/**
 * apiClient.ts — Mobile API Client
 *
 * Attaches the Supabase JWT to every request to the LYNE backend.
 */

import { createClient } from '@supabase/supabase-js';
import secureSessionStorage from './secureSessionStorage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { noteNetworkFailure, noteNetworkSuccess } from './network';

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
  requireAuth = true,
  /* 15s is chosen against the slowest thing that is still working: a cold
     container answering its first query over a Jamaican mobile link. Anything
     past that is not slow, it is broken, and saying so beats spinning. */
  timeoutMs = 15_000
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (requireAuth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  /* A DEADLINE, because fetch does not have one.
     React Native's fetch never times out on its own. A request to a host that
     accepts the connection and then says nothing — a server mid-restart, a
     captive portal, a branch wifi that has dropped its uplink — sits there
     until the OS eventually gives up, which can be well over a minute and on a
     half-open socket is effectively never.

     Every spinner in this app is driven by a pending request, so with no
     deadline there is a state the UI cannot leave: at the kiosk, somebody taps
     "Get My Ticket" and watches it spin with no ticket and no error, unable to
     tell whether they joined the line. That is the worst possible failure for a
     self-service terminal, because the honest answer — "that did not work, try
     again" — is one the app already knows how to show and simply never got to.

     AbortError is deliberately re-thrown as a plain Error with NO status, which
     is how this file already distinguishes transport failure from refusal: a
     timeout means we never heard back, so isOffline and isTransient both treat
     it as connectivity and nobody is signed out over it. */
  let res: Response;
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), timeoutMs);
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (transportError) {
    if ((transportError as { name?: string })?.name === 'AbortError') {
      noteNetworkFailure();
      throw new Error('That took too long. Check your connection and try again.');
    }
    /* Could not reach the server at all. That IS the offline signal, and it is
       a more trustworthy one than the OS probe — see lib/network.ts. */
    noteNetworkFailure();
    throw transportError;
  } finally {
    clearTimeout(deadline);
  }

  /* We got a response. Even a 4xx proves the connection works, so this counts
     as reaching the server — the distinction that matters here is transport,
     not whether the server liked the request. */
  noteNetworkSuccess();

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

/**
 * True when a failure says nothing about whether the caller is signed in.
 *
 * The distinction that matters at the sign-out decision is not "did this
 * reach the server" but "did the server look at this token and reject the
 * person". Three outcomes do NOT mean that:
 *
 *   - no status at all — never arrived (isOffline)
 *   - 429 — arrived, and the server said slow down. It is a statement about
 *     request RATE, not identity.
 *   - 5xx — arrived, and the server broke. That is our fault, not theirs.
 *
 * This existed as isOffline alone, and the gap signed people out. Relaunching
 * the app calls /auth/sync-user each time, that endpoint allowed ten requests
 * per fifteen minutes PER IP, and the eleventh returned 429 — which carried a
 * status, so it read as a refusal and cleared the session. On a branch wifi
 * where many people share one address, ten launches between them logged
 * everyone out and handed them a password form for a problem a password never
 * had anything to do with.
 */
export function isTransient(error: unknown): boolean {
  if (isOffline(error)) return true;
  const status = (error as { status?: number })?.status;
  return status === 429 || (typeof status === 'number' && status >= 500);
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

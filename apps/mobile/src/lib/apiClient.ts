/**
 * apiClient.ts — Mobile API Client
 *
 * Attaches the Supabase JWT to every request to the Q ME NOW backend.
 */

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const SUPABASE_URL     = (Constants.expoConfig?.extra?.supabaseUrl     as string) || '';
const SUPABASE_ANON    = (Constants.expoConfig?.extra?.supabaseAnonKey as string) || '';
const API_URL          = (Constants.expoConfig?.extra?.apiUrl          as string) || 'http://localhost:4000/api';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage:          AsyncStorage,
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
    throw new Error(err.message || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

const api = {
  get:    <T>(path: string, auth = true) => request<T>('GET',    path, undefined, auth),
  post:   <T>(path: string, body: unknown, auth = true) => request<T>('POST',   path, body, auth),
  put:    <T>(path: string, body: unknown, auth = true) => request<T>('PUT',    path, body, auth),
  delete: <T>(path: string, auth = true) => request<T>('DELETE', path, undefined, auth),
};

export default api;

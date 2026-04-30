/**
 * apiClient.ts
 *
 * Central HTTP client for the Q ME NOW MySQL backend API.
 * Supabase Auth is still used for login/signup — this client
 * attaches the Supabase JWT to every request so the backend
 * can verify identity and look up the MySQL user/staff record.
 *
 * Usage:
 *   import api from '@/lib/apiClient';
 *   const businesses = await api.get('/businesses');
 *   const ticket = await api.post('/tickets', { queue_id, form_data });
 */

import { supabase } from '@/integrations/supabase/client';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  requiresAuth = true
): Promise<T> {
  const headers = requiresAuth
    ? await getAuthHeaders()
    : { 'Content-Type': 'application/json' };

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

const api = {
  get:    <T>(path: string, auth = true)               => request<T>('GET',    path, undefined, auth),
  post:   <T>(path: string, body: unknown, auth = true) => request<T>('POST',   path, body,      auth),
  put:    <T>(path: string, body: unknown, auth = true) => request<T>('PUT',    path, body,      auth),
  delete: <T>(path: string, auth = true)               => request<T>('DELETE', path, undefined, auth),
};

export default api;

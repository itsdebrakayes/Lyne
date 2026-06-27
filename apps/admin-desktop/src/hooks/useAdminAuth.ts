import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthError } from '@supabase/supabase-js';
import { API_URL, supabase } from '@/lib/apiClient';

type AppRole = 'line_staff' | 'manager' | 'executive';

export interface StaffRecord {
  id: string;
  email: string;
  full_name: string;
  staff_code: string;
  role_name: AppRole;
  role_label: string;
  business_id: string;
  business_name?: string;
  branch_id?: string;
  branch_name?: string;
  assigned_service_id?: string;
  assigned_service_name?: string;
}

interface AdminData {
  staffRecord: StaffRecord;
  name: string;
  role: AppRole;
}

interface AdminAuthContextValue {
  admin: AdminData | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<{ error: AuthError | Error | null }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function timeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('Authentication timed out.')), ms)),
  ]);
}

async function fetchAdmin(accessToken: string): Promise<AdminData> {
  const response = await fetch(`${API_URL}/auth/me`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(payload.error || payload.message || `HTTP ${response.status}`);
  }

  const me = await response.json() as { type: string; record: StaffRecord };
  if (me.type !== 'staff') {
    throw new Error('This account does not have admin access.');
  }

  return {
    staffRecord: me.record,
    name: me.record.full_name,
    role: me.record.role_name,
  };
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applySession = useCallback(async (accessToken: string | null | undefined) => {
    if (!accessToken) {
      setAdmin(null);
      setError(null);
      return;
    }

    const nextAdmin = await fetchAdmin(accessToken);
    setAdmin(nextAdmin);
    setError(null);
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { session } } = await timeout(supabase.auth.getSession());
      await applySession(session?.access_token);
    } catch (err) {
      setAdmin(null);
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoading(true);
      applySession(session?.access_token)
        .catch((err) => {
          setAdmin(null);
          setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
        })
        .finally(() => setLoading(false));
    });
    return () => subscription.unsubscribe();
  }, [applySession, checkAuth]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: authError } = await timeout(
        supabase.auth.signInWithPassword({ email, password })
      );
      if (authError) {
        setAdmin(null);
        setError(authError.message);
        return { error: authError };
      }
      await applySession(data.session?.access_token);
      return { error: null };
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error('Invalid credentials.');
      setAdmin(null);
      setError(nextError.message);
      return { error: nextError };
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setAdmin(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ admin, loading, error, login, logout, checkAuth }),
    [admin, loading, error, login, logout, checkAuth]
  );

  return createElement(AdminAuthContext.Provider, { value }, children);
}

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used inside AdminAuthProvider.');
  }
  return context;
};

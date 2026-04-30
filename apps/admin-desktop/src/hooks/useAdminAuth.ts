import { useState, useEffect, useCallback } from 'react';
import api, { supabase } from '@/lib/apiClient';

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

export const useAdminAuth = () => {
  const [admin, setAdmin]   = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  const checkAuth = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAdmin(null); return; }

      const me = await api.get<{ type: string; record: StaffRecord }>('/auth/me');
      if (me.type !== 'staff') {
        setAdmin(null);
        setError('This account does not have admin access.');
        return;
      }
      setAdmin({ staffRecord: me.record, name: me.record.full_name, role: me.record.role_name });
      setError(null);
    } catch {
      setAdmin(null);
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => checkAuth());
    return () => subscription.unsubscribe();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAdmin(null);
  };

  return { admin, loading, error, login, logout };
};

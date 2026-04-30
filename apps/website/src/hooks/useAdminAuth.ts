import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import api from '@/lib/apiClient';

type AppRole = 'line_staff' | 'manager' | 'executive';

interface StaffRecord {
  id: string;
  supabase_uid: string;
  email: string;
  full_name: string;
  staff_code: string;
  role_name: AppRole;
  role_label: string;
  business_id: string;
  branch_id?: string;
  branch_name?: string;
  assigned_service_id?: string;
  assigned_service_name?: string;
}

interface AdminData {
  user: User;
  staffRecord: StaffRecord;
  name: string;
  role: AppRole;
}

export const useAdminAuth = () => {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdminAuth = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError || !user) {
        setAdmin(null);
        setError(null);
        return;
      }

      // Fetch MySQL staff record via backend
      const me = await api.get<{ type: string; record: StaffRecord }>('/auth/me');

      if (me.type !== 'staff') {
        setAdmin(null);
        setError('No admin access');
        return;
      }

      setAdmin({
        user,
        staffRecord: me.record,
        name: me.record.full_name || user.email || 'Admin',
        role: me.record.role_name,
      });
      setError(null);
    } catch (err) {
      console.error('Admin auth check failed:', err);
      setAdmin(null);
      setError('Authentication failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAdminAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminAuth();
    });
    return () => subscription.unsubscribe();
  }, [checkAdminAuth]);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) return { error: signInError };
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAdmin(null);
  };

  return { admin, loading, error, login, logout, checkAdminAuth };
};

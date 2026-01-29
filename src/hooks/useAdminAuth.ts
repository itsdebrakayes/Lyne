import { useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AppRole = 'staff' | 'section_manager' | 'manager' | 'executive';

interface StaffRoleData {
  id: string;
  user_id: string;
  organization_id: string;
  branch_id: string | null;
  role: AppRole;
  assigned_service_id: string | null;
  assigned_section: string | null;
  is_active: boolean | null;
  full_name: string | null;
  email: string | null;
  staff_id: string | null;
  organizations?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  branches?: {
    id: string;
    name: string;
  } | null;
}

interface AdminData {
  user: User;
  staffRole: StaffRoleData;
  name: string;
}

export const useAdminAuth = () => {
  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdminAuth = useCallback(async () => {
    try {
      setLoading(true);
      
      // Get current session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        setAdmin(null);
        setError(null);
        return;
      }

      // Check for staff role
      const { data: staffRole, error: staffError } = await supabase
        .from('staff_roles')
        .select(`
          *,
          organizations:organization_id(id, name, slug),
          branches:branch_id(id, name)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (staffError) {
        if (staffError.code === 'PGRST116') {
          // User has no staff role - not an admin
          setAdmin(null);
          setError('No admin access');
        } else {
          throw staffError;
        }
        return;
      }

      setAdmin({
        user,
        staffRole: staffRole as StaffRoleData,
        name: staffRole.full_name || user.email || 'Admin'
      });
      setError(null);
    } catch (err) {
      console.error('Error checking admin auth:', err);
      setError('Authentication failed');
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAdminAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAdminAuth();
    });

    return () => subscription.unsubscribe();
  }, [checkAdminAuth]);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return { error: signInError };
      }

      // Check will happen via auth state change listener
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

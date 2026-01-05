import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

type AppRole = 'staff' | 'section_manager' | 'manager' | 'executive';

interface StaffRoleData {
  id: string;
  user_id: string;
  organization_id: string;
  role: AppRole;
  assigned_service_id: string | null;
  assigned_section: string | null;
  is_active: boolean | null;
  organizations?: {
    id: string;
    name: string;
    slug: string;
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

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        setAdmin(null);
        setLoading(false);
        return;
      }

      // Check if user has a staff role
      const { data: roleData, error: roleError } = await supabase
        .from('staff_roles')
        .select('*, organizations(id, name, slug)')
        .eq('user_id', session.user.id)
        .eq('is_active', true)
        .single();

      if (roleError || !roleData) {
        setError('No staff role found for this account');
        setAdmin(null);
        setLoading(false);
        return;
      }

      setAdmin({
        user: session.user,
        staffRole: roleData as StaffRoleData,
        name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Admin',
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication error');
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuth();
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return { error: signInError };
    }

    await checkAuth();
    return { error: null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setAdmin(null);
  };

  return { admin, loading, error, login, logout };
};

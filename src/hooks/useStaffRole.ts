import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'staff' | 'section_manager' | 'manager' | 'executive';

interface StaffData {
  id: string;
  user_id: string;
  organization_id: string;
  role: AppRole;
  assigned_service_id: string | null;
  assigned_section: string | null;
  is_active: boolean | null;
  created_at: string | null;
  organizations: {
    name: string;
    slug: string;
  } | null;
}

export const useStaffRole = () => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStaffRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          setLoading(false);
          return;
        }

        const { data, error: roleError } = await supabase
          .from('staff_roles')
          .select('*, organizations(name, slug)')
          .eq('user_id', session.user.id)
          .eq('is_active', true)
          .single();

        if (roleError) {
          if (roleError.code === 'PGRST116') {
            // No role found
            setError('No staff role found for this user');
          } else {
            throw roleError;
          }
        } else {
          setRole(data.role as AppRole);
          setStaffData(data as StaffData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchStaffRole();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchStaffRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { role, staffData, loading, error };
};

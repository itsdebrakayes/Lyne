import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

type AppRole = 'staff' | 'section_manager' | 'manager' | 'executive';

export interface StaffData {
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
  counter_id: string | null;
  created_at: string | null;
  organizations: {
    id: string;
    name: string;
    slug: string;
  } | null;
  branches: {
    id: string;
    name: string;
    address: string;
  } | null;
  services: {
    id: string;
    name: string;
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
        // Get current user
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          setRole(null);
          setStaffData(null);
          setLoading(false);
          return;
        }

        // Get staff role for user
        const { data, error: staffError } = await supabase
          .from('staff_roles')
          .select(`
            *,
            organizations:organization_id(id, name, slug),
            branches:branch_id(id, name, address),
            services:assigned_service_id(id, name)
          `)
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();

        if (staffError) {
          if (staffError.code === 'PGRST116') {
            // User has no staff role
            setRole(null);
            setStaffData(null);
          } else {
            throw staffError;
          }
        } else {
          setRole(data.role as AppRole);
          setStaffData(data as StaffData);
        }
      } catch (err) {
        console.error('Error fetching staff role:', err);
        setError('Failed to fetch staff role');
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

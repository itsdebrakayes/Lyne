import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import api from '@/lib/apiClient';

type AppRole = 'line_staff' | 'manager' | 'executive';

export interface StaffData {
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
  is_active: boolean;
}

export const useStaffRole = () => {
  const [role, setRole] = useState<AppRole | null>(null);
  const [staffData, setStaffData] = useState<StaffData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStaffRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setRole(null);
          setStaffData(null);
          setLoading(false);
          return;
        }

        const me = await api.get<{ type: string; record: StaffData }>('/auth/me');
        if (me.type === 'staff') {
          setRole(me.record.role_name);
          setStaffData(me.record);
        } else {
          setRole(null);
          setStaffData(null);
        }
      } catch (err) {
        console.error('Error fetching staff role:', err);
        setError('Failed to fetch staff role');
      } finally {
        setLoading(false);
      }
    };

    fetchStaffRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchStaffRole();
    });

    return () => subscription.unsubscribe();
  }, []);

  return { role, staffData, loading, error };
};

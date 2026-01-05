import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useStaffRole = () => {
  const [role, setRole] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
          setRole(data.role);
          setStaffData(data);
        }
      } catch (err) {
        setError(err.message);
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

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useServices = (organizationId) => {
  return useQuery({
    queryKey: ['services', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};

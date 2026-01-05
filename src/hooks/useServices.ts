import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Service = Tables<'services'>;

export const useServices = (organizationId: string | undefined) => {
  return useQuery({
    queryKey: ['services', organizationId],
    queryFn: async (): Promise<Service[]> => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', organizationId!)
        .eq('is_active', true)
        .order('display_order');
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId,
  });
};

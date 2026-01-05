import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Organization = Tables<'organizations'>;

export const useOrganizations = () => {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      return data;
    },
  });
};

export const useOrganization = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['organization', slug],
    queryFn: async (): Promise<Organization> => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', slug!)
        .eq('is_active', true)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });
};

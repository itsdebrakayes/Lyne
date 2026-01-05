import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

type Branch = Tables<'branches'>;

export const useBranches = (organizationId: string | undefined) => {
  return useQuery({
    queryKey: ['branches', organizationId],
    queryFn: async (): Promise<Branch[]> => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', organizationId!)
        .eq('is_open', true)
        .order('is_main_branch', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId
  });
};

export const useBranchesBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['branches-by-slug', slug],
    queryFn: async (): Promise<Branch[]> => {
      // First get the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug!)
        .single();
      
      if (orgError) throw orgError;
      
      // Then get branches
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', org.id)
        .eq('is_open', true)
        .order('is_main_branch', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!slug
  });
};

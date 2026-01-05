import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useBranches = (organizationId) => {
  return useQuery({
    queryKey: ['branches', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_open', true)
        .order('is_main_branch', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!organizationId
  });
};

export const useBranchesBySlug = (slug) => {
  return useQuery({
    queryKey: ['branches-by-slug', slug],
    queryFn: async () => {
      // First get the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
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

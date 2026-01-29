import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  photo_url: string | null;
  organization_id: string;
  is_main_branch: boolean | null;
  is_open: boolean | null;
  opening_time: string | null;
  closing_time: string | null;
  friday_closing_time: string | null;
  created_at: string | null;
}

export const useBranches = (organizationId: string | undefined) => {
  return useQuery({
    queryKey: ['branches', organizationId],
    queryFn: async (): Promise<Branch[]> => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_open', true)
        .order('is_main_branch', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId
  });
};

export const useBranchesBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['branches-by-slug', slug],
    queryFn: async (): Promise<Branch[]> => {
      if (!slug) return [];
      
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
      return data || [];
    },
    enabled: !!slug
  });
};

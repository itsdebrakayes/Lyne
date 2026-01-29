import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface Service {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  is_active: boolean | null;
  display_order: number | null;
  base_avg_time_minutes: number | null;
  organization_id: string;
  created_at: string | null;
}

export const useServices = (organizationId: string | undefined) => {
  return useQuery({
    queryKey: ['services', organizationId],
    queryFn: async (): Promise<Service[]> => {
      if (!organizationId) return [];
      
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });
};

export const useServicesBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['services-by-slug', slug],
    queryFn: async (): Promise<Service[]> => {
      if (!slug) return [];
      
      // First get the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', slug)
        .single();
      
      if (orgError) throw orgError;
      
      // Then get services
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('organization_id', org.id)
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!slug,
  });
};

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  description: string | null;
  full_description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  is_active: boolean | null;
  operating_hours: Json | null;
  created_at: string | null;
  updated_at: string | null;
}

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
      return data || [];
    },
  });
};

export const useOrganization = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['organization', slug],
    queryFn: async (): Promise<Organization | null> => {
      if (!slug) return null;
      
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', slug)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      return data;
    },
    enabled: !!slug,
  });
};

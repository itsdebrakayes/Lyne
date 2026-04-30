import { useQuery } from '@tanstack/react-query';
import api from '@/lib/apiClient';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  description?: string;
  phone?: string;
  email?: string;
  website_url?: string;
  is_active: boolean;
  tier_name: string;
  tier_label: string;
  can_view_analytics: boolean;
  can_view_predictions: boolean;
  can_view_multi_branch: boolean;
  can_view_executive_reports: boolean;
  created_at: string;
  updated_at: string;
}

export const useOrganizations = () => {
  return useQuery({
    queryKey: ['organizations'],
    queryFn: async (): Promise<Organization[]> => {
      return api.get<Organization[]>('/businesses', false);
    },
  });
};

export const useOrganization = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['organization', slug],
    queryFn: async (): Promise<Organization | null> => {
      if (!slug) return null;
      try {
        return await api.get<Organization>(`/businesses/${slug}`, false);
      } catch {
        return null;
      }
    },
    enabled: !!slug,
  });
};

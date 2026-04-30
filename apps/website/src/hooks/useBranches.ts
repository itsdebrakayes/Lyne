import { useQuery } from '@tanstack/react-query';
import api from '@/lib/apiClient';

export interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
  parish?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  is_main_branch: boolean;
  is_active: boolean;
  business_id: string;
  business_name?: string;
  business_slug?: string;
  created_at: string;
  updated_at: string;
}

export const useBranches = (businessId: string | undefined) => {
  return useQuery({
    queryKey: ['branches', businessId],
    queryFn: async (): Promise<Branch[]> => {
      if (!businessId) return [];
      return api.get<Branch[]>(`/branches?business_id=${businessId}`, false);
    },
    enabled: !!businessId,
  });
};

export const useBranchesBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['branches-by-slug', slug],
    queryFn: async (): Promise<Branch[]> => {
      if (!slug) return [];
      // Fetch the business first, then its branches
      const business = await api.get<{ id: string }>(`/businesses/${slug}`, false);
      return api.get<Branch[]>(`/branches?business_id=${business.id}`, false);
    },
    enabled: !!slug,
  });
};

export const useBranchById = (id: string | undefined) => {
  return useQuery({
    queryKey: ['branch', id],
    queryFn: async (): Promise<Branch | null> => {
      if (!id) return null;
      return api.get<Branch>(`/branches/${id}`, false);
    },
    enabled: !!id,
  });
};

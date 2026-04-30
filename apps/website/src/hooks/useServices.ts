import { useQuery } from '@tanstack/react-query';
import api from '@/lib/apiClient';

export interface Service {
  id: string;
  name: string;
  description?: string;
  ticket_prefix?: string;
  base_avg_time_minutes: number;
  is_active: boolean;
  business_id: string;
  business_name?: string;
  created_at: string;
  updated_at: string;
}

export const useServices = (businessId: string | undefined) => {
  return useQuery({
    queryKey: ['services', businessId],
    queryFn: async (): Promise<Service[]> => {
      if (!businessId) return [];
      return api.get<Service[]>(`/services?business_id=${businessId}`, false);
    },
    enabled: !!businessId,
  });
};

export const useServicesBySlug = (slug: string | undefined) => {
  return useQuery({
    queryKey: ['services-by-slug', slug],
    queryFn: async (): Promise<Service[]> => {
      if (!slug) return [];
      const business = await api.get<{ id: string }>(`/businesses/${slug}`, false);
      return api.get<Service[]>(`/services?business_id=${business.id}`, false);
    },
    enabled: !!slug,
  });
};

export const useServiceById = (id: string | undefined) => {
  return useQuery({
    queryKey: ['service', id],
    queryFn: async (): Promise<Service | null> => {
      if (!id) return null;
      try {
        return await api.get<Service>(`/services/${id}`, false);
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
};

// Services hook - SKELETON (implement your own backend)

import { useQuery } from '@tanstack/react-query';

interface Service {
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
      // TODO: Implement with your backend
      console.log('useServices fetching', { organizationId });
      return [];
    },
    enabled: !!organizationId,
  });
};

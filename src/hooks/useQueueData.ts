// Queue data hooks - SKELETON (implement your own backend)

import { useQuery } from '@tanstack/react-query';

interface QueueCount {
  service_id: string;
  count: number;
}

export const useQueueData = (organizationId: string | undefined, branchId?: string) => {
  return useQuery({
    queryKey: ['queueData', organizationId, branchId],
    queryFn: async (): Promise<QueueCount[]> => {
      // TODO: Implement with your backend
      console.log('useQueueData fetching', { organizationId, branchId });
      return [];
    },
    enabled: !!organizationId,
  });
};

interface Line {
  id: string;
  position: number;
  status: string;
  ticket_number: string;
  services?: {
    name: string;
    icon: string | null;
    color: string | null;
  };
}

export const useQueuePosition = (lineId: string | undefined) => {
  return useQuery({
    queryKey: ['queuePosition', lineId],
    queryFn: async (): Promise<Line | null> => {
      // TODO: Implement with your backend
      console.log('useQueuePosition fetching', { lineId });
      return null;
    },
    enabled: !!lineId,
  });
};

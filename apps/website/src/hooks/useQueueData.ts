import { useQuery } from '@tanstack/react-query';
import api from '@/lib/apiClient';
import type { Queue, QueueEntry } from '@/lib/api/queue';

interface QueueCount {
  service_id: string;
  count: number;
}

// Live queue counts per service for a business/branch
export const useQueueData = (businessId: string | undefined, branchId?: string) => {
  return useQuery({
    queryKey: ['queueData', businessId, branchId],
    queryFn: async (): Promise<QueueCount[]> => {
      if (!businessId) return [];
      const qs = new URLSearchParams({
        business_id: businessId,
        ...(branchId ? { branch_id: branchId } : {}),
      }).toString();
      const queues = await api.get<Queue[]>(`/queues?${qs}`, false);
      return queues.map(q => ({ service_id: q.service_id, count: q.waiting_count || 0 }));
    },
    enabled: !!businessId,
    refetchInterval: 30_000,
  });
};

export type LineWithDetails = QueueEntry & {
  services?: { id: string; name: string } | null;
  branches?: { id: string; name: string } | null;
};

// All tickets for a queue (staff view)
export const useQueueLines = (
  queueId: string | undefined,
  _options?: { branchId?: string; serviceId?: string; status?: string | string[] }
) => {
  return useQuery({
    queryKey: ['queueLines', queueId],
    queryFn: async (): Promise<LineWithDetails[]> => {
      if (!queueId) return [];
      return api.get<LineWithDetails[]>(`/tickets/queue/${queueId}`);
    },
    enabled: !!queueId,
    refetchInterval: 15_000,
  });
};

// Single ticket position (user view)
export const useQueuePosition = (ticketId: string | undefined) => {
  return useQuery({
    queryKey: ['queuePosition', ticketId],
    queryFn: async (): Promise<QueueEntry | null> => {
      if (!ticketId) return null;
      try {
        return await api.get<QueueEntry>(`/tickets/${ticketId}`, false);
      } catch {
        return null;
      }
    },
    enabled: !!ticketId,
    refetchInterval: 10_000,
  });
};

// Today's queues for a branch
export const useBranchQueues = (branchId: string | undefined) => {
  return useQuery({
    queryKey: ['branchQueues', branchId],
    queryFn: async (): Promise<Queue[]> => {
      if (!branchId) return [];
      return api.get<Queue[]>(`/queues?branch_id=${branchId}`, false);
    },
    enabled: !!branchId,
    refetchInterval: 20_000,
  });
};

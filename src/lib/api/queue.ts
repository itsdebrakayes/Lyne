// Queue-related API calls - SKELETON (implement your own backend)

import type { QueueEntry, QueueStats, QueueStatus } from '@/types/queue';

export async function fetchQueueEntries(
  organizationId: string,
  options?: {
    serviceId?: string;
    branchId?: string;
    status?: QueueStatus | QueueStatus[];
    limit?: number;
  }
): Promise<QueueEntry[]> {
  // TODO: Implement with your backend
  console.log('fetchQueueEntries called', { organizationId, options });
  return [];
}

export async function fetchQueueStats(
  organizationId: string,
  branchId?: string
): Promise<QueueStats> {
  // TODO: Implement with your backend
  console.log('fetchQueueStats called', { organizationId, branchId });
  return {
    totalInQueue: 0,
    avgWaitTime: 0,
    activeCounters: 0,
    servicesActive: 0,
    completedToday: 0,
    cancelledToday: 0
  };
}

export async function fetchQueueByService(
  organizationId: string,
  serviceId: string,
  branchId?: string
): Promise<QueueEntry[]> {
  // TODO: Implement with your backend
  console.log('fetchQueueByService called', { organizationId, serviceId, branchId });
  return [];
}

export async function fetchMyQueue(
  organizationId: string,
  staffUserId: string,
  assignedServiceId: string | null,
  branchId?: string
): Promise<QueueEntry[]> {
  // TODO: Implement with your backend
  console.log('fetchMyQueue called', { organizationId, staffUserId, assignedServiceId, branchId });
  return [];
}

export async function callCustomer(lineId: string, staffUserId: string, counterId?: string) {
  // TODO: Implement with your backend
  console.log('callCustomer called', { lineId, staffUserId, counterId });
}

export async function completeService(lineId: string, notes?: string) {
  // TODO: Implement with your backend
  console.log('completeService called', { lineId, notes });
}

export async function cancelCustomer(lineId: string, notes?: string) {
  // TODO: Implement with your backend
  console.log('cancelCustomer called', { lineId, notes });
}

export async function markNoShow(lineId: string) {
  // TODO: Implement with your backend
  console.log('markNoShow called', { lineId });
}

export async function moveCustomerUp(lineId: string, organizationId: string, serviceId: string) {
  // TODO: Implement with your backend
  console.log('moveCustomerUp called', { lineId, organizationId, serviceId });
}

export async function moveCustomerDown(lineId: string, organizationId: string, serviceId: string) {
  // TODO: Implement with your backend
  console.log('moveCustomerDown called', { lineId, organizationId, serviceId });
}

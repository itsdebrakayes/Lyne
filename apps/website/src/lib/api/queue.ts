/**
 * queue.ts — Queue & Ticket API (MySQL backend)
 *
 * Replaces the previous Supabase/PostgreSQL implementation.
 * All data is now fetched from the Q ME NOW Express backend API.
 */

import api from '@/lib/apiClient';

export type QueueStatus = 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show';

export interface QueueEntry {
  id: string;
  queue_id: string;
  user_id?: string;
  intake_form_id?: string;
  ticket_number: string;
  position: number;
  status: QueueStatus;
  estimated_wait_minutes?: number;
  joined_at: string;
  called_at?: string;
  started_serving_at?: string;
  completed_at?: string;
  served_by_staff_id?: string;
  served_at_counter_id?: string;
  // Joined fields
  user_name?: string;
  user_phone?: string;
  branch_name?: string;
  service_name?: string;
  people_ahead?: number;
}

export interface Queue {
  id: string;
  branch_id: string;
  service_id: string;
  queue_date: string;
  max_capacity: number;
  is_active: boolean;
  branch_name: string;
  service_name: string;
  ticket_prefix?: string;
  waiting_count: number;
  serving_count: number;
  total_count: number;
  avg_wait_minutes?: number;
  tickets?: QueueEntry[];
}

export interface QueueStats {
  totalInQueue: number;
  avgWaitTime: number;
  activeCounters: number;
  servicesActive: number;
  completedToday: number;
  cancelledToday: number;
}

// ── Queue operations ──────────────────────────────────────────

export async function fetchQueues(params: {
  branch_id?: string;
  service_id?: string;
  date?: string;
}): Promise<Queue[]> {
  const qs = new URLSearchParams(params as Record<string, string>).toString();
  return api.get<Queue[]>(`/queues${qs ? `?${qs}` : ''}`, false);
}

export async function fetchQueueById(id: string): Promise<Queue> {
  return api.get<Queue>(`/queues/${id}`, false);
}

export async function openQueue(data: {
  branch_id: string;
  service_id: string;
  queue_date?: string;
  max_capacity?: number;
}): Promise<Queue> {
  return api.post<Queue>('/queues', data);
}

export async function closeQueue(id: string): Promise<void> {
  await api.put(`/queues/${id}/close`, {});
}

// ── Ticket operations ─────────────────────────────────────────

export async function joinQueue(
  queueId: string,
  formData?: Record<string, unknown>
): Promise<QueueEntry> {
  return api.post<QueueEntry>('/tickets', { queue_id: queueId, form_data: formData });
}

export async function fetchTicket(id: string): Promise<QueueEntry> {
  return api.get<QueueEntry>(`/tickets/${id}`, false);
}

export async function fetchTicketsByQueue(queueId: string): Promise<QueueEntry[]> {
  return api.get<QueueEntry[]>(`/tickets/queue/${queueId}`);
}

export async function updateTicketStatus(
  id: string,
  newStatus: QueueStatus,
  notes?: string
): Promise<QueueEntry> {
  return api.put<QueueEntry>(`/tickets/${id}/status`, { new_status: newStatus, notes });
}

// Convenience wrappers matching previous API surface
export async function callCustomer(ticketId: string): Promise<QueueEntry> {
  return updateTicketStatus(ticketId, 'serving');
}

export async function completeService(ticketId: string, notes?: string): Promise<QueueEntry> {
  return updateTicketStatus(ticketId, 'completed', notes);
}

export async function cancelCustomer(ticketId: string, notes?: string): Promise<QueueEntry> {
  return updateTicketStatus(ticketId, 'cancelled', notes);
}

export async function markNoShow(ticketId: string): Promise<QueueEntry> {
  return updateTicketStatus(ticketId, 'no_show');
}

// ── Stats helper ──────────────────────────────────────────────

export async function fetchQueueStats(
  businessId: string,
  branchId?: string
): Promise<QueueStats> {
  const qs = new URLSearchParams({
    business_id: businessId,
    ...(branchId ? { branch_id: branchId } : {}),
  }).toString();

  const queues = await api.get<Queue[]>(`/queues?${qs}`, false);

  const totalInQueue   = queues.reduce((s, q) => s + (q.waiting_count  || 0), 0);
  const servingCount   = queues.reduce((s, q) => s + (q.serving_count  || 0), 0);
  const avgWaitTime    = queues.length
    ? Math.round(queues.reduce((s, q) => s + (q.avg_wait_minutes || 0), 0) / queues.length)
    : 0;

  return {
    totalInQueue,
    avgWaitTime,
    activeCounters: servingCount,
    servicesActive: queues.length,
    completedToday: 0,   // Populated from analytics endpoint if needed
    cancelledToday: 0,
  };
}

// Legacy alias used by older components
export const fetchQueueEntries = fetchTicketsByQueue;

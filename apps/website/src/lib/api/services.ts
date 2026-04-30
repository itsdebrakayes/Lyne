/**
 * services.ts — Services API (MySQL backend)
 *
 * Replaces the previous Supabase/PostgreSQL implementation.
 * All data is now fetched from the Q ME NOW Express backend API.
 */

import api from '@/lib/apiClient';

export interface Service {
  id: string;
  business_id: string;
  business_name: string;
  name: string;
  description?: string;
  ticket_prefix?: string;
  base_avg_time_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ServiceWithStats extends Service {
  queueCount: number;
  avgWaitTime: number;
  activeCounters: number;
}

export async function fetchServices(businessId?: string): Promise<Service[]> {
  const query = businessId ? `?business_id=${businessId}` : '';
  return api.get<Service[]>(`/services${query}`, false);
}

export async function fetchServicesWithStats(
  businessId: string,
  _branchId?: string
): Promise<ServiceWithStats[]> {
  // Fetch services and today's queues in parallel
  const [services, queues] = await Promise.all([
    fetchServices(businessId),
    api.get<{ service_id: string; waiting_count: number; avg_wait_minutes: number }[]>(
      `/queues?business_id=${businessId}`,
      false
    ).catch(() => []),
  ]);

  return services.map(service => {
    const queue = (queues as any[]).find((q: any) => q.service_id === service.id);
    return {
      ...service,
      queueCount:     queue?.waiting_count    ?? 0,
      avgWaitTime:    queue?.avg_wait_minutes  ?? service.base_avg_time_minutes,
      activeCounters: 1,
    };
  });
}

export async function fetchServiceById(id: string): Promise<Service | null> {
  try {
    return await api.get<Service>(`/services/${id}`, false);
  } catch {
    return null;
  }
}

export async function createService(data: Partial<Service>): Promise<Service> {
  return api.post<Service>('/services', data);
}

export async function updateService(id: string, data: Partial<Service>): Promise<Service> {
  return api.put<Service>(`/services/${id}`, data);
}

export async function deleteService(id: string): Promise<void> {
  await api.put(`/services/${id}`, { is_active: false });
}

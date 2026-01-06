// Service-related API calls

import { supabase } from '@/integrations/supabase/client';

export interface Service {
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

export interface ServiceWithStats extends Service {
  queueCount: number;
  avgWaitTime: number;
  activeCounters: number;
}

export async function fetchServices(organizationId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function fetchServicesWithStats(organizationId: string): Promise<ServiceWithStats[]> {
  // Fetch services
  const services = await fetchServices(organizationId);

  // Fetch queue counts per service
  const { data: queueData } = await supabase
    .from('lines')
    .select('service_id, joined_at')
    .eq('organization_id', organizationId)
    .in('status', ['waiting', 'serving']);

  // Fetch counter counts per service
  const { data: counterData } = await supabase
    .from('counters')
    .select('service_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  const now = new Date();

  return services.map(service => {
    const serviceQueueEntries = (queueData || []).filter(q => q.service_id === service.id);
    const queueCount = serviceQueueEntries.length;
    
    // Calculate average wait time
    let avgWaitTime = 0;
    if (serviceQueueEntries.length > 0) {
      const totalWait = serviceQueueEntries.reduce((sum, entry) => {
        if (entry.joined_at) {
          const joinedAt = new Date(entry.joined_at);
          return sum + (now.getTime() - joinedAt.getTime()) / 60000;
        }
        return sum;
      }, 0);
      avgWaitTime = Math.round(totalWait / serviceQueueEntries.length);
    }

    const activeCounters = (counterData || []).filter(c => c.service_id === service.id).length;

    return {
      ...service,
      queueCount,
      avgWaitTime,
      activeCounters
    };
  });
}

export async function fetchServiceById(serviceId: string): Promise<Service | null> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function updateService(serviceId: string, updates: Partial<Service>): Promise<void> {
  const { error } = await supabase
    .from('services')
    .update(updates)
    .eq('id', serviceId);

  if (error) throw error;
}

export async function createService(service: Omit<Service, 'id' | 'created_at'>): Promise<string> {
  const { data, error } = await supabase
    .from('services')
    .insert(service)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

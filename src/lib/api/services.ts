import { supabase } from '@/lib/supabase';

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

export async function fetchServicesWithStats(
  organizationId: string,
  branchId?: string
): Promise<ServiceWithStats[]> {
  const services = await fetchServices(organizationId);
  
  // Get queue counts for all services
  let queueQuery = supabase
    .from('lines')
    .select('service_id')
    .eq('organization_id', organizationId)
    .eq('status', 'waiting');

  if (branchId) {
    queueQuery = queueQuery.eq('branch_id', branchId);
  }

  const { data: queueData } = await queueQuery;
  
  // Count per service
  const queueCounts = new Map<string, number>();
  (queueData || []).forEach(q => {
    const count = queueCounts.get(q.service_id) || 0;
    queueCounts.set(q.service_id, count + 1);
  });

  // Get active counters per service
  let counterQuery = supabase
    .from('counters')
    .select('service_id')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (branchId) {
    counterQuery = counterQuery.eq('branch_id', branchId);
  }

  const { data: counterData } = await counterQuery;
  
  const counterCounts = new Map<string, number>();
  (counterData || []).forEach(c => {
    const count = counterCounts.get(c.service_id) || 0;
    counterCounts.set(c.service_id, count + 1);
  });

  return services.map(service => {
    const queueCount = queueCounts.get(service.id) || 0;
    const activeCounters = counterCounts.get(service.id) || 1;
    const avgWaitTime = (service.base_avg_time_minutes || 15) * Math.ceil(queueCount / activeCounters);

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

export async function deleteService(serviceId: string): Promise<void> {
  // Soft delete by setting is_active to false
  const { error } = await supabase
    .from('services')
    .update({ is_active: false })
    .eq('id', serviceId);

  if (error) throw error;
}

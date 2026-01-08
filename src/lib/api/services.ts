// Service-related API calls - SKELETON (implement your own backend)

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
  // TODO: Implement with your backend
  console.log('fetchServices called', { organizationId });
  return [];
}

export async function fetchServicesWithStats(organizationId: string): Promise<ServiceWithStats[]> {
  // TODO: Implement with your backend
  console.log('fetchServicesWithStats called', { organizationId });
  return [];
}

export async function fetchServiceById(serviceId: string): Promise<Service | null> {
  // TODO: Implement with your backend
  console.log('fetchServiceById called', { serviceId });
  return null;
}

export async function updateService(serviceId: string, updates: Partial<Service>): Promise<void> {
  // TODO: Implement with your backend
  console.log('updateService called', { serviceId, updates });
}

export async function createService(service: Omit<Service, 'id' | 'created_at'>): Promise<string> {
  // TODO: Implement with your backend
  console.log('createService called', { service });
  return '';
}

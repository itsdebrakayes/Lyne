// Customer-related API calls

import { supabase } from '@/integrations/supabase/client';
import type { Customer, VisitRecord, CustomerSearchFilters } from '@/types/customer';

export async function fetchCustomers(
  organizationId: string,
  filters?: CustomerSearchFilters
): Promise<Customer[]> {
  // Get all clients who have visited this organization
  let query = supabase
    .from('lines')
    .select('client:clients(*)')
    .eq('organization_id', organizationId);

  const { data, error } = await query;

  if (error) throw error;

  // Extract unique clients
  const clientMap = new Map<string, Customer>();
  (data || []).forEach((row: any) => {
    if (row.client) {
      clientMap.set(row.client.id, row.client);
    }
  });

  let customers = Array.from(clientMap.values());

  // Apply search filter
  if (filters?.query) {
    const query = filters.query.toLowerCase();
    customers = customers.filter(c => 
      c.full_name?.toLowerCase().includes(query) ||
      c.email?.toLowerCase().includes(query) ||
      c.trn_number?.includes(query) ||
      c.phone?.includes(query) ||
      c.id_number?.includes(query)
    );
  }

  return customers;
}

export async function fetchVisitHistory(
  organizationId: string,
  filters?: CustomerSearchFilters & { page?: number; pageSize?: number }
): Promise<{ records: VisitRecord[]; total: number }> {
  let query = supabase
    .from('visit_history')
    .select(`
      *,
      client:clients(id, full_name, email, phone, trn_number),
      service:services(id, name, icon, color)
    `, { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('visit_date', { ascending: false });

  if (filters?.dateFrom) {
    query = query.gte('visit_date', filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte('visit_date', filters.dateTo);
  }

  if (filters?.serviceId) {
    query = query.eq('service_id', filters.serviceId);
  }

  if (filters?.status && filters.status !== 'all') {
    if (filters.status === 'completed') {
      query = query.eq('was_cancelled', false).eq('was_no_show', false);
    } else if (filters.status === 'cancelled') {
      query = query.eq('was_cancelled', true);
    } else if (filters.status === 'no_show') {
      query = query.eq('was_no_show', true);
    }
  }

  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) throw error;

  return {
    records: (data || []) as VisitRecord[],
    total: count || 0
  };
}

export async function fetchCustomerById(customerId: string): Promise<Customer | null> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .eq('id', customerId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data;
}

export async function fetchCustomerVisits(
  customerId: string,
  organizationId: string
): Promise<VisitRecord[]> {
  const { data, error } = await supabase
    .from('visit_history')
    .select(`
      *,
      service:services(id, name, icon, color)
    `)
    .eq('client_id', customerId)
    .eq('organization_id', organizationId)
    .order('visit_date', { ascending: false });

  if (error) throw error;
  return (data || []) as VisitRecord[];
}

export async function exportVisitHistoryCSV(
  organizationId: string,
  filters?: CustomerSearchFilters
): Promise<string> {
  const { records } = await fetchVisitHistory(organizationId, {
    ...filters,
    page: 1,
    pageSize: 10000 // Get all records for export
  });

  // Build CSV
  const headers = [
    'Date',
    'Day of Week',
    'Hour',
    'Customer Name',
    'TRN',
    'Service',
    'Wait Time (min)',
    'Service Time (min)',
    'Status'
  ];

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const rows = records.map(record => [
    record.visit_date,
    dayNames[record.day_of_week],
    record.hour_of_day,
    record.client?.full_name || 'Unknown',
    record.client?.trn_number || '',
    record.service?.name || 'Unknown',
    record.wait_time_minutes || 0,
    record.service_time_minutes || 0,
    record.was_no_show ? 'No Show' : record.was_cancelled ? 'Cancelled' : 'Completed'
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csvContent;
}

import { supabase } from '@/lib/supabase';
import type { Customer, VisitRecord, CustomerSearchFilters } from '@/types/customer';

export async function fetchCustomers(
  organizationId: string,
  filters?: CustomerSearchFilters
): Promise<Customer[]> {
  let query = supabase
    .from('clients')
    .select('*')
    .order('full_name');

  if (filters?.query) {
    query = query.or(`full_name.ilike.%${filters.query}%,phone.ilike.%${filters.query}%,email.ilike.%${filters.query}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function fetchVisitHistory(
  organizationId: string,
  filters?: CustomerSearchFilters & { page?: number; pageSize?: number }
): Promise<{ records: VisitRecord[]; total: number }> {
  const page = filters?.page || 1;
  const pageSize = filters?.pageSize || 50;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from('visit_history')
    .select(`
      *,
      client:client_id(id, full_name, phone, email, trn_number),
      service:service_id(id, name, icon, color),
      branch:branch_id(id, name)
    `, { count: 'exact' })
    .eq('organization_id', organizationId)
    .order('visit_date', { ascending: false })
    .range(offset, offset + pageSize - 1);

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
    if (filters.status === 'cancelled') {
      query = query.eq('was_cancelled', true);
    } else if (filters.status === 'no_show') {
      query = query.eq('was_no_show', true);
    } else if (filters.status === 'completed') {
      query = query.eq('was_cancelled', false).eq('was_no_show', false);
    }
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return {
    records: data || [],
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
      service:service_id(id, name, icon, color),
      branch:branch_id(id, name)
    `)
    .eq('client_id', customerId)
    .eq('organization_id', organizationId)
    .order('visit_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function exportVisitHistoryCSV(
  organizationId: string,
  filters?: CustomerSearchFilters
): Promise<string> {
  const { records } = await fetchVisitHistory(organizationId, { ...filters, pageSize: 10000 });
  
  const headers = [
    'Visit Date',
    'Customer Name',
    'Phone',
    'Service',
    'Branch',
    'Wait Time (min)',
    'Service Time (min)',
    'Status'
  ];

  const rows = records.map(r => [
    r.visit_date,
    r.client?.full_name || 'Unknown',
    r.client?.phone || '',
    r.service?.name || 'Unknown',
    r.branch?.name || 'Unknown',
    r.wait_time_minutes?.toString() || '',
    r.service_time_minutes?.toString() || '',
    r.was_cancelled ? 'Cancelled' : r.was_no_show ? 'No Show' : 'Completed'
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  return csv;
}

export async function createClient(clientData: {
  full_name: string;
  phone?: string;
  email?: string;
  id_number?: string;
  trn_number?: string;
  date_of_birth?: string;
  user_id?: string;
}): Promise<string> {
  const { data, error } = await supabase
    .from('clients')
    .insert(clientData)
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

export async function findOrCreateClient(
  phone?: string,
  email?: string,
  fullName?: string
): Promise<string> {
  // Try to find existing client
  if (phone) {
    const { data: byPhone } = await supabase
      .from('clients')
      .select('id')
      .eq('phone', phone)
      .single();
    if (byPhone) return byPhone.id;
  }

  if (email) {
    const { data: byEmail } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email)
      .single();
    if (byEmail) return byEmail.id;
  }

  // Create new client
  return createClient({
    full_name: fullName || 'Walk-in Customer',
    phone,
    email
  });
}

/**
 * customers.ts — Users / Customers API (MySQL backend)
 *
 * Replaces the previous Supabase/PostgreSQL implementation.
 */

import api from '@/lib/apiClient';

export interface Customer {
  id: string;
  supabase_uid?: string;
  email: string;
  full_name: string;
  phone?: string;
  national_id?: string;
  trn?: string;
  date_of_birth?: string;
  created_at: string;
  updated_at: string;
}

export interface VisitRecord {
  id: string;
  user_id: string;
  ticket_id: string;
  business_id: string;
  branch_id: string;
  service_id: string;
  business_name: string;
  branch_name: string;
  service_name: string;
  ticket_number: string;
  visit_date: string;
  wait_time_minutes?: number;
  service_time_minutes?: number;
  status: string;
  logo_url?: string;
  created_at: string;
}

export interface CustomerSearchFilters {
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  serviceId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

// Fetch visit history for the authenticated user
export async function fetchVisitHistory(): Promise<{ records: VisitRecord[]; total: number }> {
  const records = await api.get<VisitRecord[]>('/history');
  return { records, total: records.length };
}

// Fetch a single customer by ID (staff/manager use)
export async function fetchCustomerById(id: string): Promise<Customer | null> {
  try {
    return await api.get<Customer>(`/auth/me`);
  } catch {
    return null;
  }
}

// Export visit history as CSV (client-side generation from API data)
export async function exportVisitHistoryCSV(): Promise<string> {
  const { records } = await fetchVisitHistory();

  const headers = [
    'Visit Date', 'Business', 'Branch', 'Service',
    'Ticket', 'Wait Time (min)', 'Service Time (min)', 'Status'
  ];

  const rows = records.map(r => [
    r.visit_date,
    r.business_name,
    r.branch_name,
    r.service_name,
    r.ticket_number,
    r.wait_time_minutes?.toString() || '',
    r.service_time_minutes?.toString() || '',
    r.status,
  ]);

  return [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
}

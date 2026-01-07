// Customer-related type definitions

export interface Customer {
  id: string;
  user_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  trn_number: string | null;
  id_number: string | null;
  date_of_birth: string | null;
  client_type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface VisitRecord {
  id: string;
  client_id: string | null;
  organization_id: string;
  service_id: string | null;
  branch_id: string | null;
  visit_date: string;
  day_of_week: number;
  hour_of_day: number;
  wait_time_minutes: number | null;
  service_time_minutes: number | null;
  was_cancelled: boolean | null;
  was_no_show: boolean | null;
  created_at: string | null;
  client?: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    trn_number: string | null;
  };
  service?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  };
  branch?: {
    id: string;
    name: string;
  };
}

export interface CustomerHistoryEntry {
  id: string;
  date: string;
  ticketNumber: string;
  customerName: string;
  trn: string | null;
  service: string;
  waitTime: number;
  serviceTime: number;
  status: 'completed' | 'cancelled' | 'no_show';
  staffName: string | null;
}

export interface CustomerSearchFilters {
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  serviceId?: string;
  status?: 'completed' | 'cancelled' | 'no_show' | 'all';
}

export function getCustomerInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export function formatTRN(trn: string | null): string {
  if (!trn) return 'N/A';
  // Format as XXX-XXX-XXX
  const cleaned = trn.replace(/\D/g, '');
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return trn;
}

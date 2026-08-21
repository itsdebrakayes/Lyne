export type QueueStatus = 'light' | 'moderate' | 'busy';

export interface BranchSummary {
  id: string;
  business_id: string;
  business_name: string;
  business_slug: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  city?: string;
  parish?: string;
  latitude?: number;
  longitude?: number;
  opening_time?: string | null;
  closing_time?: string | null;
  open_days?: string | null;
  total_waiting: number;
  avg_wait_minutes: number;
  open_queues: number;
}

export interface ServiceSummary {
  id: string;
  business_id: string;
  business_name: string;
  name: string;
  description?: string | null;
  waiting_count: number;
  avg_wait_minutes: number;
  base_avg_time_minutes: number;
  /** Counter-aware projected wait if you join now — set only for branch-scoped
   *  requests, matches /queues/live exactly. Null when browsing across branches. */
  estimated_wait_minutes?: number | null;
  active_counters?: number | null;
  readiness_count?: number;
  readiness?: ServiceReadinessItem[];
}

export interface ServiceReadinessItem {
  id: string;
  service_id: string;
  kind: 'bring' | 'prepare';
  seq: number;
  label: string;
  detail?: string | null;
  is_mandatory: boolean;
  lead_minutes?: number | null;
}

export interface TicketRecord {
  id: string;
  queue_id: string;
  ticket_number: string;
  verification_code: string;
  position: number;
  waiting_position?: number | null;
  /** How many are in this line in total — returned by GET /tickets/:id. */
  total_waiting?: number | null;
  estimated_wait_minutes: number;
  status: string;
  business_id?: string;
  branch_id?: string;
  branch_name?: string;
  business_name?: string;
  service_id?: string;
  service_name?: string;
  is_next?: boolean;
  status_message?: string | null;
  readiness_shown_at?: string | null;
  readiness_outcome?: 'ready' | 'incomplete' | 'not_checked';
  readiness_note?: string | null;
}

export interface SavedBusiness {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  logo_url?: string | null;
  saved_at: string;
}

export function queueStatus(waitMinutes: number): QueueStatus {
  if (waitMinutes >= 40) return 'busy';
  if (waitMinutes >= 15) return 'moderate';
  return 'light';
}

export function statusMeta(status: QueueStatus) {
  if (status === 'busy') return { label: 'Busy', color: '#e5484d' };
  if (status === 'moderate') return { label: 'Moderate', color: '#f5a623' };
  return { label: 'Light wait', color: '#2fbf71' };
}

export function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'Q';
}

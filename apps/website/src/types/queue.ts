/**
 * Queue-related type definitions aligned with the MySQL backend schema.
 * Field names match the Express API response shapes.
 * Legacy Supabase field names are kept as optional aliases for backward compatibility.
 */

export type QueueStatus = 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show';

export interface QueueEntry {
  id: string;
  queue_id?: string;
  ticket_number: string;
  position: number;
  status: QueueStatus;
  joined_at: string | null;
  called_at: string | null;
  started_serving_at: string | null;
  completed_at: string | null;
  estimated_wait_minutes: number | null;
  actual_wait_minutes: number | null;
  notes: string | null;
  // MySQL field names
  user_id?: string | null;
  service_id?: string;
  business_id?: string;
  branch_id: string | null;
  served_by_staff_id?: string | null;
  served_at_counter_id?: string | null;
  intake_form_id?: string | null;
  // Joined / computed fields from backend
  user_name?: string | null;
  user_phone?: string | null;
  branch_name?: string | null;
  service_name?: string | null;
  people_ahead?: number;
  // Legacy Supabase aliases (backward compatibility)
  client_id?: string;
  organization_id?: string;
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
    base_avg_time_minutes: number | null;
  };
}

export interface QueueStats {
  totalInQueue: number;
  avgWaitTime: number;
  activeCounters: number;
  servicesActive: number;
  completedToday: number;
  cancelledToday: number;
}

export interface QueueAction {
  action: 'call' | 'complete' | 'cancel' | 'move_up' | 'move_down' | 'reassign' | 'no_show';
  lineId: string;
  staffUserId?: string;
  counterId?: string;
  notes?: string;
  targetPosition?: number;
}

export interface ServiceSession {
  id: string;
  line_id: string;
  staff_user_id: string | null;
  counter_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
  outcome: string | null;
  notes: string | null;
}

export interface CounterInfo {
  id: string;
  counter_number: number;
  service_id: string;
  is_active: boolean;
  staff?: {
    user_id: string;
    name: string;
  };
  currentCustomer?: QueueEntry;
  queueCount: number;
  avgWaitTime: number;
}

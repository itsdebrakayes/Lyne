// Queue-related type definitions

export type QueueStatus = 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show';

export interface QueueEntry {
  id: string;
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
  client_id: string;
  service_id: string;
  organization_id: string;
  branch_id: string | null;
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

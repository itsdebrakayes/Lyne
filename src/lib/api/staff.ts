// Staff-related API calls - SKELETON (implement your own backend)

import type { StaffMember, CounterAssignment } from '@/types/staff';

export async function fetchStaffMembers(organizationId: string): Promise<StaffMember[]> {
  // TODO: Implement with your backend
  console.log('fetchStaffMembers called', { organizationId });
  return [];
}

export async function fetchStaffByRole(
  organizationId: string,
  role: 'staff' | 'section_manager' | 'manager' | 'executive'
): Promise<StaffMember[]> {
  // TODO: Implement with your backend
  console.log('fetchStaffByRole called', { organizationId, role });
  return [];
}

export async function fetchCurrentStaffMember(userId: string): Promise<StaffMember | null> {
  // TODO: Implement with your backend
  console.log('fetchCurrentStaffMember called', { userId });
  return null;
}

export async function fetchCounterAssignments(
  organizationId: string,
  date?: string
): Promise<CounterAssignment[]> {
  // TODO: Implement with your backend
  console.log('fetchCounterAssignments called', { organizationId, date });
  return [];
}

export async function fetchMyCounterAssignment(
  userId: string,
  date?: string
): Promise<CounterAssignment | null> {
  // TODO: Implement with your backend
  console.log('fetchMyCounterAssignment called', { userId, date });
  return null;
}

export async function fetchCountersWithStaff(organizationId: string) {
  // TODO: Implement with your backend
  console.log('fetchCountersWithStaff called', { organizationId });
  return [];
}

export async function assignStaffToCounter(
  counterId: string,
  staffUserId: string,
  date?: string
): Promise<void> {
  // TODO: Implement with your backend
  console.log('assignStaffToCounter called', { counterId, staffUserId, date });
}

export interface StaffListMember {
  id: string;
  user_id: string;
  email?: string;
  full_name?: string;
  role: string;
  assigned_service_id?: string;
  assigned_section?: string;
  is_active: boolean;
  organization_id: string;
  service_name?: string;
  counter_number?: number;
  customers_served_today?: number;
  avg_service_time?: number;
  created_at?: string;
  branch_name?: string;
  branch_id?: string;
  staff_id?: string;
  date_of_birth?: string;
  address?: string;
  counter_id?: string;
}

export interface StaffStats {
  activeToday: number;
  avgServiceTime: number;
  topPerformers: number;
}

export async function fetchAllStaff(organizationId: string): Promise<StaffListMember[]> {
  // TODO: Implement with your backend
  console.log('fetchAllStaff called', { organizationId });
  return [];
}

export async function fetchStaffStats(organizationId: string): Promise<StaffStats> {
  // TODO: Implement with your backend
  console.log('fetchStaffStats called', { organizationId });
  return {
    activeToday: 0,
    avgServiceTime: 0,
    topPerformers: 0,
  };
}

export async function fetchStaffDetail(userId: string, organizationId: string) {
  // TODO: Implement with your backend
  console.log('fetchStaffDetail called', { userId, organizationId });
  return null;
}

export async function fetchStaffPerformance(userId: string, organizationId: string) {
  // TODO: Implement with your backend
  console.log('fetchStaffPerformance called', { userId, organizationId });
  return {
    customers_served: 0,
    avg_service_time: 0,
    efficiency_score: 0,
    rank_in_org: 0,
    recent_sessions: [],
  };
}

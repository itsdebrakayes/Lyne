/**
 * staff.ts — Staff API (MySQL backend)
 *
 * Replaces the previous Supabase/PostgreSQL implementation.
 */

import api from '@/lib/apiClient';

export interface StaffMember {
  id: string;
  business_id: string;
  branch_id?: string;
  role_id: string;
  supabase_uid?: string;
  staff_code: string;
  full_name: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  assigned_service_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  role_name: string;
  role_label: string;
  branch_name?: string;
  assigned_service_name?: string;
}

export interface StaffListMember extends StaffMember {
  customers_served_today?: number;
  avg_service_time?: number;
}

export interface StaffStats {
  activeToday: number;
  avgServiceTime: number;
  topPerformers: number;
}

export interface CounterAssignment {
  id: string;
  staff_id: string;
  counter_id: string;
  assignment_date: string;
  shift_start?: string;
  shift_end?: string;
  staff_name: string;
  staff_code: string;
  role_name: string;
  counter_label: string;
  counter_number: number;
  branch_id: string;
}

export async function fetchStaffMembers(businessId: string, branchId?: string): Promise<StaffMember[]> {
  const qs = new URLSearchParams({
    business_id: businessId,
    ...(branchId ? { branch_id: branchId } : {}),
  }).toString();
  return api.get<StaffMember[]>(`/staff?${qs}`);
}

export const fetchAllStaff = fetchStaffMembers;

export async function fetchStaffById(id: string): Promise<StaffMember | null> {
  try {
    return await api.get<StaffMember>(`/staff/${id}`);
  } catch {
    return null;
  }
}

export async function fetchCurrentStaffMember(supabaseUid: string): Promise<StaffMember | null> {
  try {
    const me = await api.get<{ type: string; record: StaffMember }>('/auth/me');
    return me.type === 'staff' ? me.record : null;
  } catch {
    return null;
  }
}

export async function createStaffMember(data: Partial<StaffMember>): Promise<StaffMember> {
  return api.post<StaffMember>('/staff', data);
}

export async function updateStaffMember(id: string, data: Partial<StaffMember>): Promise<StaffMember> {
  return api.put<StaffMember>(`/staff/${id}`, data);
}

export async function fetchCounterAssignments(branchId: string, date?: string): Promise<CounterAssignment[]> {
  const qs = new URLSearchParams({
    branch_id: branchId,
    ...(date ? { date } : {}),
  }).toString();
  return api.get<CounterAssignment[]>(`/assignments?${qs}`);
}

export async function assignStaffToCounter(
  staffId: string,
  counterId: string,
  date?: string,
  shiftStart?: string,
  shiftEnd?: string
): Promise<CounterAssignment> {
  return api.post<CounterAssignment>('/assignments', {
    staff_id: staffId,
    counter_id: counterId,
    assignment_date: date,
    shift_start: shiftStart,
    shift_end: shiftEnd,
  });
}

export async function fetchStaffStats(businessId: string): Promise<StaffStats> {
  const staffList = await fetchStaffMembers(businessId);
  return {
    activeToday: staffList.filter(s => s.is_active).length,
    avgServiceTime: 0,
    topPerformers: 0,
  };
}

/**
 * fetchMyCounterAssignment — returns today's counter assignment for a given staff member.
 * Used by StaffDashboard to know which counter/service the logged-in staff is assigned to.
 */
export async function fetchMyCounterAssignment(
  staffId: string
): Promise<CounterAssignment | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const me = await api.get<{ type: string; record: StaffMember }>('/auth/me');
    if (me.type !== 'staff' || !me.record.branch_id) return null;
    const assignments = await fetchCounterAssignments(me.record.branch_id, today);
    return assignments.find(a => a.staff_id === staffId) || null;
  } catch {
    return null;
  }
}

export interface CounterWithStaff {
  id: string;
  counter_number: number;
  counter_label: string;
  branch_id: string;
  is_active: boolean;
  assigned_staff?: StaffMember | null;
}

/**
 * fetchCountersWithStaff — returns all counters for a branch with their assigned staff.
 * Used by ManagerDashboard to show counter status.
 */
export async function fetchCountersWithStaff(
  branchId: string
): Promise<CounterWithStaff[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const assignments = await fetchCounterAssignments(branchId, today);
    // Build a map of counter_id -> staff
    const staffByCounter: Record<string, CounterAssignment> = {};
    assignments.forEach(a => { staffByCounter[a.counter_id] = a; });
    // Return a synthetic list of counters from the assignments
    const counters: CounterWithStaff[] = assignments.map(a => ({
      id:             a.counter_id,
      counter_number: a.counter_number,
      counter_label:  a.counter_label,
      branch_id:      a.branch_id,
      is_active:      true,
      assigned_staff: {
        id:         a.staff_id,
        staff_code: a.staff_code,
        full_name:  a.staff_name,
        role_name:  a.role_name,
      } as StaffMember,
    }));
    return counters;
  } catch {
    return [];
  }
}

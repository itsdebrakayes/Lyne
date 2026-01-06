// Staff-related type definitions

export type AppRole = 'staff' | 'section_manager' | 'manager' | 'executive';

export interface StaffMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: AppRole;
  assigned_service_id: string | null;
  assigned_section: string | null;
  is_active: boolean | null;
  created_at: string | null;
  email?: string;
  name?: string;
  organizations?: {
    id: string;
    name: string;
    slug: string;
  };
  services?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  };
}

export interface CounterAssignment {
  id: string;
  counter_id: string;
  staff_user_id: string;
  assignment_date: string;
  shift_start: string | null;
  shift_end: string | null;
  counter?: {
    id: string;
    counter_number: number;
    service_id: string;
    is_active: boolean;
  };
}

export interface StaffPerformance {
  userId: string;
  name: string;
  customersServed: number;
  avgServiceTime: number;
  avgWaitTime: number;
  completionRate: number;
}

export function getRoleDisplayName(role: AppRole): string {
  const roleNames: Record<AppRole, string> = {
    staff: 'Staff',
    section_manager: 'Section Manager',
    manager: 'Manager',
    executive: 'Executive'
  };
  return roleNames[role] || role;
}

export function getRoleLevel(role: AppRole): number {
  const levels: Record<AppRole, number> = {
    staff: 1,
    section_manager: 2,
    manager: 3,
    executive: 4
  };
  return levels[role] || 0;
}

export function canManageQueue(role: AppRole): boolean {
  return getRoleLevel(role) >= 1;
}

export function canViewAllQueues(role: AppRole): boolean {
  return getRoleLevel(role) >= 2;
}

export function canManageStaff(role: AppRole): boolean {
  return getRoleLevel(role) >= 3;
}

export function canViewAnalytics(role: AppRole): boolean {
  return getRoleLevel(role) >= 4;
}

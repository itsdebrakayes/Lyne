// Staff-related API calls

import { supabase } from '@/integrations/supabase/client';
import type { StaffMember, CounterAssignment } from '@/types/staff';

export async function fetchStaffMembers(organizationId: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_roles')
    .select(`
      *,
      organizations(id, name, slug),
      services:assigned_service_id(id, name, icon, color)
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (error) throw error;
  return (data || []) as StaffMember[];
}

export async function fetchStaffByRole(
  organizationId: string,
  role: 'staff' | 'section_manager' | 'manager' | 'executive'
): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_roles')
    .select(`
      *,
      organizations(id, name, slug),
      services:assigned_service_id(id, name, icon, color)
    `)
    .eq('organization_id', organizationId)
    .eq('role', role)
    .eq('is_active', true);

  if (error) throw error;
  return (data || []) as StaffMember[];
}

export async function fetchCurrentStaffMember(userId: string): Promise<StaffMember | null> {
  const { data, error } = await supabase
    .from('staff_roles')
    .select(`
      *,
      organizations(id, name, slug),
      services:assigned_service_id(id, name, icon, color)
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as StaffMember;
}

export async function fetchCounterAssignments(
  organizationId: string,
  date?: string
): Promise<CounterAssignment[]> {
  const assignmentDate = date || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('counter_assignments')
    .select(`
      *,
      counter:counters(id, counter_number, service_id, is_active)
    `)
    .eq('assignment_date', assignmentDate);

  if (error) throw error;
  return (data || []) as CounterAssignment[];
}

export async function fetchMyCounterAssignment(
  userId: string,
  date?: string
): Promise<CounterAssignment | null> {
  const assignmentDate = date || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('counter_assignments')
    .select(`
      *,
      counter:counters(id, counter_number, service_id, is_active)
    `)
    .eq('staff_user_id', userId)
    .eq('assignment_date', assignmentDate)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }

  return data as CounterAssignment;
}

export async function fetchCountersWithStaff(organizationId: string) {
  const today = new Date().toISOString().split('T')[0];

  // Get all counters
  const { data: counters, error: countersError } = await supabase
    .from('counters')
    .select(`
      *,
      service:services(id, name, icon, color)
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('counter_number');

  if (countersError) throw countersError;

  // Get today's assignments
  const { data: assignments } = await supabase
    .from('counter_assignments')
    .select('counter_id, staff_user_id')
    .eq('assignment_date', today);

  // Get queue counts per service
  const { data: queueCounts } = await supabase
    .from('lines')
    .select('service_id')
    .eq('organization_id', organizationId)
    .eq('status', 'waiting');

  const assignmentMap = new Map(
    (assignments || []).map(a => [a.counter_id, a.staff_user_id])
  );

  const queueCountMap = new Map<string, number>();
  (queueCounts || []).forEach(q => {
    queueCountMap.set(q.service_id, (queueCountMap.get(q.service_id) || 0) + 1);
  });

  return (counters || []).map(counter => ({
    ...counter,
    staffUserId: assignmentMap.get(counter.id) || null,
    queueCount: queueCountMap.get(counter.service_id) || 0
  }));
}

export async function assignStaffToCounter(
  counterId: string,
  staffUserId: string,
  date?: string
): Promise<void> {
  const assignmentDate = date || new Date().toISOString().split('T')[0];

  // Check for existing assignment
  const { data: existing } = await supabase
    .from('counter_assignments')
    .select('id')
    .eq('counter_id', counterId)
    .eq('assignment_date', assignmentDate)
    .single();

  if (existing) {
    // Update existing
    const { error } = await supabase
      .from('counter_assignments')
      .update({ staff_user_id: staffUserId })
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    // Create new
    const { error } = await supabase
      .from('counter_assignments')
      .insert({
        counter_id: counterId,
        staff_user_id: staffUserId,
        assignment_date: assignmentDate
      });
    if (error) throw error;
  }
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
  // Fetch staff roles with their details including full_name and email
  const { data: staffRoles, error } = await supabase
    .from('staff_roles')
    .select(`
      id,
      user_id,
      role,
      assigned_service_id,
      assigned_section,
      is_active,
      organization_id,
      created_at,
      full_name,
      email,
      branch_id,
      staff_id,
      date_of_birth,
      address,
      counter_id,
      service:services(name),
      branch:branches(name)
    `)
    .eq('organization_id', organizationId)
    .order('role', { ascending: true });

  if (error) throw error;

  const today = new Date().toISOString().split('T')[0];
  
  // Batch fetch all counter assignments for today
  const { data: assignments } = await supabase
    .from('counter_assignments')
    .select('staff_user_id, counter:counters(counter_number, service:services(name))')
    .eq('assignment_date', today);

  const assignmentMap = new Map(
    (assignments || []).map(a => [a.staff_user_id, a.counter])
  );

  // Batch fetch service session counts
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const { data: sessionCounts } = await supabase
    .from('service_sessions')
    .select('staff_user_id')
    .gte('started_at', todayStart.toISOString());

  const servedCountMap = new Map<string, number>();
  (sessionCounts || []).forEach(s => {
    servedCountMap.set(s.staff_user_id, (servedCountMap.get(s.staff_user_id) || 0) + 1);
  });

  return (staffRoles || []).map(role => {
    const assignment = assignmentMap.get(role.user_id);
    return {
      id: role.id,
      user_id: role.user_id,
      role: role.role,
      assigned_service_id: role.assigned_service_id || undefined,
      assigned_section: role.assigned_section || undefined,
      is_active: role.is_active || false,
      organization_id: role.organization_id,
      created_at: role.created_at || undefined,
      full_name: role.full_name || undefined,
      email: role.email || undefined,
      branch_name: (role.branch as any)?.name || undefined,
      branch_id: role.branch_id || undefined,
      staff_id: role.staff_id || undefined,
      date_of_birth: role.date_of_birth || undefined,
      address: role.address || undefined,
      counter_id: role.counter_id || undefined,
      service_name: (assignment as any)?.service?.name || (role.service as any)?.name || undefined,
      counter_number: (assignment as any)?.counter_number || undefined,
      customers_served_today: servedCountMap.get(role.user_id) || 0,
    };
  });
}

export async function fetchStaffStats(organizationId: string): Promise<StaffStats> {
  const today = new Date().toISOString().split('T')[0];
  
  const { count: activeToday } = await supabase
    .from('counter_assignments')
    .select('staff_user_id', { count: 'exact', head: true })
    .eq('assignment_date', today);

  const { data: recentSessions } = await supabase
    .from('service_sessions')
    .select('duration_minutes, lines!inner(organization_id)')
    .eq('lines.organization_id', organizationId)
    .not('duration_minutes', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(100);

  let avgServiceTime = 0;
  if (recentSessions && recentSessions.length > 0) {
    const total = recentSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
    avgServiceTime = Math.round(total / recentSessions.length);
  }

  const { count: topPerformers } = await supabase
    .from('staff_performance')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('period_date', today)
    .gte('efficiency_score', 80);

  return {
    activeToday: activeToday || 0,
    avgServiceTime,
    topPerformers: topPerformers || 0,
  };
}

export async function fetchStaffDetail(userId: string, organizationId: string) {
  const { data: staffRole, error } = await supabase
    .from('staff_roles')
    .select(`
      id,
      user_id,
      role,
      assigned_service_id,
      assigned_section,
      is_active,
      created_at,
      service:services(name)
    `)
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();

  if (error) throw error;
  if (!staffRole) return null;

  const today = new Date().toISOString().split('T')[0];
  const { data: assignment } = await supabase
    .from('counter_assignments')
    .select('counter:counters(counter_number)')
    .eq('staff_user_id', userId)
    .eq('assignment_date', today)
    .single();

  return {
    ...staffRole,
    service_name: (staffRole.service as any)?.name || undefined,
    counter_number: (assignment?.counter as any)?.counter_number || undefined,
  };
}

export async function fetchStaffPerformance(userId: string, organizationId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: perf } = await supabase
    .from('staff_performance')
    .select('*')
    .eq('staff_user_id', userId)
    .eq('organization_id', organizationId)
    .eq('period_date', today)
    .single();

  const { data: recentSessions } = await supabase
    .from('service_sessions')
    .select(`
      id,
      started_at,
      completed_at,
      duration_minutes,
      outcome,
      lines!inner(service:services(name))
    `)
    .eq('staff_user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(10);

  const formattedSessions = (recentSessions || []).map(s => ({
    ...s,
    service_name: (s.lines as any)?.service?.name || 'Unknown',
  }));

  return {
    customers_served: perf?.customers_served || 0,
    avg_service_time: perf?.avg_service_time_minutes || 0,
    efficiency_score: perf?.efficiency_score || 0,
    rank_in_org: perf?.rank_in_org || 0,
    recent_sessions: formattedSessions,
  };
}

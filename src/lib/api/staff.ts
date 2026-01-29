import { supabase } from '@/lib/supabase';
import type { StaffMember, CounterAssignment } from '@/types/staff';

export async function fetchStaffMembers(organizationId: string): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_roles')
    .select(`
      *,
      organizations:organization_id(id, name, slug),
      branches:branch_id(id, name, address),
      services:assigned_service_id(id, name, icon, color),
      counters:counter_id(id, counter_number)
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('full_name');

  if (error) throw error;
  return data || [];
}

export async function fetchStaffByRole(
  organizationId: string,
  role: 'staff' | 'section_manager' | 'manager' | 'executive'
): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from('staff_roles')
    .select(`
      *,
      organizations:organization_id(id, name, slug),
      branches:branch_id(id, name, address),
      services:assigned_service_id(id, name, icon, color)
    `)
    .eq('organization_id', organizationId)
    .eq('role', role)
    .eq('is_active', true)
    .order('full_name');

  if (error) throw error;
  return data || [];
}

export async function fetchCurrentStaffMember(userId: string): Promise<StaffMember | null> {
  const { data, error } = await supabase
    .from('staff_roles')
    .select(`
      *,
      organizations:organization_id(id, name, slug),
      branches:branch_id(id, name, address),
      services:assigned_service_id(id, name, icon, color),
      counters:counter_id(id, counter_number)
    `)
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function fetchCounterAssignments(
  organizationId: string,
  date?: string
): Promise<CounterAssignment[]> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('counter_assignments')
    .select(`
      *,
      counters:counter_id(
        id, 
        counter_number, 
        organization_id,
        branch_id,
        services:service_id(id, name)
      )
    `)
    .eq('assignment_date', targetDate);

  if (error) throw error;
  
  // Filter by organization through the join
  return (data || []).filter(
    a => a.counters?.organization_id === organizationId
  );
}

export async function fetchMyCounterAssignment(
  userId: string,
  date?: string
): Promise<CounterAssignment | null> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('counter_assignments')
    .select(`
      *,
      counters:counter_id(
        id, 
        counter_number,
        services:service_id(id, name, icon, color)
      )
    `)
    .eq('staff_user_id', userId)
    .eq('assignment_date', targetDate)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function fetchCountersWithStaff(organizationId: string) {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('counters')
    .select(`
      *,
      services:service_id(id, name, icon, color),
      branches:branch_id(id, name),
      counter_assignments!counter_assignments_counter_id_fkey(
        id,
        staff_user_id,
        assignment_date
      )
    `)
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (error) throw error;
  
  // Filter assignments to today
  return (data || []).map(counter => ({
    ...counter,
    counter_assignments: counter.counter_assignments?.filter(
      (a: any) => a.assignment_date === today
    ) || []
  }));
}

export async function assignStaffToCounter(
  counterId: string,
  staffUserId: string,
  date?: string
): Promise<void> {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  // Remove any existing assignment for this counter on this date
  await supabase
    .from('counter_assignments')
    .delete()
    .eq('counter_id', counterId)
    .eq('assignment_date', targetDate);

  // Create new assignment
  const { error } = await supabase
    .from('counter_assignments')
    .insert({
      counter_id: counterId,
      staff_user_id: staffUserId,
      assignment_date: targetDate
    });

  if (error) throw error;
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
  const { data, error } = await supabase
    .from('staff_roles')
    .select(`
      *,
      services:assigned_service_id(name),
      branches:branch_id(name),
      counters:counter_id(counter_number)
    `)
    .eq('organization_id', organizationId)
    .order('full_name');

  if (error) throw error;
  
  return (data || []).map(staff => ({
    id: staff.id,
    user_id: staff.user_id,
    email: staff.email || undefined,
    full_name: staff.full_name || undefined,
    role: staff.role,
    assigned_service_id: staff.assigned_service_id || undefined,
    assigned_section: staff.assigned_section || undefined,
    is_active: staff.is_active ?? true,
    organization_id: staff.organization_id,
    service_name: staff.services?.name,
    counter_number: staff.counters?.counter_number,
    created_at: staff.created_at || undefined,
    branch_name: staff.branches?.name,
    branch_id: staff.branch_id || undefined,
    staff_id: staff.staff_id || undefined,
    date_of_birth: staff.date_of_birth || undefined,
    address: staff.address || undefined,
    counter_id: staff.counter_id || undefined,
  }));
}

export async function fetchStaffStats(organizationId: string): Promise<StaffStats> {
  const today = new Date().toISOString().split('T')[0];
  
  // Get staff with counter assignments today
  const { count: activeToday } = await supabase
    .from('counter_assignments')
    .select('id', { count: 'exact' })
    .eq('assignment_date', today);

  // Get average service time from today's performance
  const { data: perfData } = await supabase
    .from('staff_performance')
    .select('avg_service_time_minutes')
    .eq('organization_id', organizationId)
    .eq('period_date', today);

  const avgServiceTime = perfData && perfData.length > 0
    ? perfData.reduce((sum, p) => sum + (p.avg_service_time_minutes || 0), 0) / perfData.length
    : 0;

  // Get top performers (efficiency_score > 80)
  const { count: topPerformers } = await supabase
    .from('staff_performance')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('period_date', today)
    .gte('efficiency_score', 80);

  return {
    activeToday: activeToday || 0,
    avgServiceTime: Math.round(avgServiceTime),
    topPerformers: topPerformers || 0,
  };
}

export async function fetchStaffDetail(userId: string, organizationId: string) {
  const { data, error } = await supabase
    .from('staff_roles')
    .select(`
      *,
      organizations:organization_id(id, name, slug, logo_url),
      branches:branch_id(id, name, address),
      services:assigned_service_id(id, name, icon, color),
      counters:counter_id(id, counter_number)
    `)
    .eq('user_id', userId)
    .eq('organization_id', organizationId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return data;
}

export async function fetchStaffPerformance(userId: string, organizationId: string) {
  // Get recent performance data
  const { data: perfData } = await supabase
    .from('staff_performance')
    .select('*')
    .eq('staff_user_id', userId)
    .eq('organization_id', organizationId)
    .order('period_date', { ascending: false })
    .limit(30);

  // Get recent service sessions
  const { data: sessions } = await supabase
    .from('service_sessions')
    .select(`
      *,
      lines:line_id(
        ticket_number,
        services:service_id(name)
      )
    `)
    .eq('staff_user_id', userId)
    .order('started_at', { ascending: false })
    .limit(10);

  const latestPerf = perfData?.[0];
  
  return {
    customers_served: latestPerf?.customers_served || 0,
    avg_service_time: latestPerf?.avg_service_time_minutes || 0,
    efficiency_score: latestPerf?.efficiency_score || 0,
    rank_in_org: latestPerf?.rank_in_org || 0,
    recent_sessions: sessions || [],
  };
}

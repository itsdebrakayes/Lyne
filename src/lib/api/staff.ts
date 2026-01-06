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

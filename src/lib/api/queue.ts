// Queue-related API calls

import { supabase } from '@/integrations/supabase/client';
import type { QueueEntry, QueueStats, QueueStatus } from '@/types/queue';

export async function fetchQueueEntries(
  organizationId: string,
  options?: {
    serviceId?: string;
    status?: QueueStatus | QueueStatus[];
    limit?: number;
  }
): Promise<QueueEntry[]> {
  let query = supabase
    .from('lines')
    .select(`
      *,
      client:clients(id, full_name, email, phone, trn_number),
      service:services(id, name, icon, color, base_avg_time_minutes)
    `)
    .eq('organization_id', organizationId)
    .order('position', { ascending: true });

  if (options?.serviceId) {
    query = query.eq('service_id', options.serviceId);
  }

  if (options?.status) {
    if (Array.isArray(options.status)) {
      query = query.in('status', options.status);
    } else {
      query = query.eq('status', options.status);
    }
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as QueueEntry[];
}

export async function fetchQueueStats(organizationId: string): Promise<QueueStats> {
  const today = new Date().toISOString().split('T')[0];

  // Get waiting count
  const { count: waitingCount } = await supabase
    .from('lines')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'waiting');

  // Get serving count
  const { count: servingCount } = await supabase
    .from('lines')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'serving');

  // Get completed today
  const { count: completedCount } = await supabase
    .from('lines')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .gte('completed_at', today);

  // Get cancelled today
  const { count: cancelledCount } = await supabase
    .from('lines')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('status', 'cancelled')
    .gte('completed_at', today);

  // Get waiting entries for avg wait time calculation
  const { data: waitingEntries } = await supabase
    .from('lines')
    .select('joined_at')
    .eq('organization_id', organizationId)
    .eq('status', 'waiting');

  let avgWaitTime = 0;
  if (waitingEntries && waitingEntries.length > 0) {
    const now = new Date();
    const totalWait = waitingEntries.reduce((sum, entry) => {
      if (entry.joined_at) {
        const joinedAt = new Date(entry.joined_at);
        return sum + (now.getTime() - joinedAt.getTime()) / 60000;
      }
      return sum;
    }, 0);
    avgWaitTime = Math.round(totalWait / waitingEntries.length);
  }

  // Get active counters
  const { count: activeCounters } = await supabase
    .from('counters')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  // Get active services
  const { count: activeServices } = await supabase
    .from('services')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  return {
    totalInQueue: (waitingCount || 0) + (servingCount || 0),
    avgWaitTime,
    activeCounters: activeCounters || 0,
    servicesActive: activeServices || 0,
    completedToday: completedCount || 0,
    cancelledToday: cancelledCount || 0
  };
}

export async function fetchQueueByService(
  organizationId: string,
  serviceId: string
): Promise<QueueEntry[]> {
  return fetchQueueEntries(organizationId, {
    serviceId,
    status: ['waiting', 'serving']
  });
}

export async function fetchMyQueue(
  organizationId: string,
  staffUserId: string,
  assignedServiceId: string | null
): Promise<QueueEntry[]> {
  if (!assignedServiceId) return [];
  
  return fetchQueueEntries(organizationId, {
    serviceId: assignedServiceId,
    status: ['waiting', 'serving']
  });
}

export async function callCustomer(lineId: string, staffUserId: string, counterId?: string) {
  const now = new Date().toISOString();
  
  // First, get the current entry details
  const { data: currentEntry, error: fetchError } = await supabase
    .from('lines')
    .select('organization_id, service_id, position')
    .eq('id', lineId)
    .single();
  
  if (fetchError || !currentEntry) throw fetchError || new Error('Entry not found');
  
  // Shift all waiting entries up by 1 position (those with higher position)
  await supabase.rpc('shift_queue_positions', {
    p_org_id: currentEntry.organization_id,
    p_service_id: currentEntry.service_id,
    p_from_position: currentEntry.position
  });
  
  // Update line status and set position to 0 (serving)
  const { error: lineError } = await supabase
    .from('lines')
    .update({
      status: 'serving',
      position: 0,
      called_at: now,
      started_serving_at: now
    })
    .eq('id', lineId);

  if (lineError) throw lineError;

  // Create service session
  const { error: sessionError } = await supabase
    .from('service_sessions')
    .insert({
      line_id: lineId,
      staff_user_id: staffUserId,
      counter_id: counterId,
      started_at: now
    });

  if (sessionError) throw sessionError;
}

export async function completeService(lineId: string, notes?: string) {
  const now = new Date().toISOString();
  
  // Update line status
  const { error: lineError } = await supabase
    .from('lines')
    .update({
      status: 'completed',
      completed_at: now,
      notes
    })
    .eq('id', lineId);

  if (lineError) throw lineError;

  // Get the line data for visit history
  const { data: lineData } = await supabase
    .from('lines')
    .select('*')
    .eq('id', lineId)
    .single();

  if (lineData) {
    const joinedAt = new Date(lineData.joined_at || lineData.created_at);
    const startedAt = lineData.started_serving_at ? new Date(lineData.started_serving_at) : new Date();
    const completedAt = new Date(now);
    
    const waitTime = Math.round((startedAt.getTime() - joinedAt.getTime()) / 60000);
    const serviceTime = Math.round((completedAt.getTime() - startedAt.getTime()) / 60000);

    // Create visit history entry
    await supabase.from('visit_history').insert({
      client_id: lineData.client_id,
      organization_id: lineData.organization_id,
      service_id: lineData.service_id,
      visit_date: now.split('T')[0],
      day_of_week: new Date().getDay(),
      hour_of_day: new Date().getHours(),
      wait_time_minutes: waitTime,
      service_time_minutes: serviceTime,
      was_cancelled: false,
      was_no_show: false
    });
  }

  // Update service session
  await supabase
    .from('service_sessions')
    .update({
      completed_at: now,
      notes
    })
    .eq('line_id', lineId)
    .is('completed_at', null);
}

export async function cancelCustomer(lineId: string, notes?: string) {
  const now = new Date().toISOString();
  
  const { error } = await supabase
    .from('lines')
    .update({
      status: 'cancelled',
      completed_at: now,
      notes
    })
    .eq('id', lineId);

  if (error) throw error;
}

export async function markNoShow(lineId: string) {
  const now = new Date().toISOString();
  
  const { error } = await supabase
    .from('lines')
    .update({
      status: 'no_show',
      completed_at: now
    })
    .eq('id', lineId);

  if (error) throw error;
}

export async function moveCustomerUp(lineId: string, organizationId: string, serviceId: string) {
  // Get current position
  const { data: current } = await supabase
    .from('lines')
    .select('position')
    .eq('id', lineId)
    .single();

  if (!current || current.position <= 1) return;

  const targetPosition = current.position - 1;

  // Find the entry at target position
  const { data: target } = await supabase
    .from('lines')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('service_id', serviceId)
    .eq('position', targetPosition)
    .eq('status', 'waiting')
    .single();

  if (target) {
    // Swap positions
    await supabase.from('lines').update({ position: current.position }).eq('id', target.id);
    await supabase.from('lines').update({ position: targetPosition }).eq('id', lineId);
  }
}

export async function moveCustomerDown(lineId: string, organizationId: string, serviceId: string) {
  // Get current position and max position
  const { data: current } = await supabase
    .from('lines')
    .select('position')
    .eq('id', lineId)
    .single();

  const { data: maxEntry } = await supabase
    .from('lines')
    .select('position')
    .eq('organization_id', organizationId)
    .eq('service_id', serviceId)
    .eq('status', 'waiting')
    .order('position', { ascending: false })
    .limit(1)
    .single();

  if (!current || !maxEntry || current.position >= maxEntry.position) return;

  const targetPosition = current.position + 1;

  // Find the entry at target position
  const { data: target } = await supabase
    .from('lines')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('service_id', serviceId)
    .eq('position', targetPosition)
    .eq('status', 'waiting')
    .single();

  if (target) {
    // Swap positions
    await supabase.from('lines').update({ position: current.position }).eq('id', target.id);
    await supabase.from('lines').update({ position: targetPosition }).eq('id', lineId);
  }
}

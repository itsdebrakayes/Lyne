import { supabase } from '@/lib/supabase';
import type { QueueEntry, QueueStats, QueueStatus } from '@/types/queue';

export async function fetchQueueEntries(
  organizationId: string,
  options?: {
    serviceId?: string;
    branchId?: string;
    status?: QueueStatus | QueueStatus[];
    limit?: number;
  }
): Promise<QueueEntry[]> {
  let query = supabase
    .from('lines')
    .select(`
      *,
      services:service_id(id, name, icon, color),
      clients:client_id(id, full_name, phone),
      branches:branch_id(id, name)
    `)
    .eq('organization_id', organizationId)
    .order('position', { ascending: true });

  if (options?.serviceId) {
    query = query.eq('service_id', options.serviceId);
  }

  if (options?.branchId) {
    query = query.eq('branch_id', options.branchId);
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
  return data || [];
}

export async function fetchQueueStats(
  organizationId: string,
  branchId?: string
): Promise<QueueStats> {
  // Get waiting count
  let waitingQuery = supabase
    .from('lines')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'waiting');

  if (branchId) {
    waitingQuery = waitingQuery.eq('branch_id', branchId);
  }

  const { count: waitingCount } = await waitingQuery;

  // Get average wait time from recent completions
  const today = new Date().toISOString().split('T')[0];
  let avgQuery = supabase
    .from('lines')
    .select('actual_wait_minutes')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .gte('completed_at', today)
    .not('actual_wait_minutes', 'is', null);

  if (branchId) {
    avgQuery = avgQuery.eq('branch_id', branchId);
  }

  const { data: avgData } = await avgQuery;
  const avgWait = avgData && avgData.length > 0
    ? avgData.reduce((sum, r) => sum + (r.actual_wait_minutes || 0), 0) / avgData.length
    : 0;

  // Get active counters count
  let countersQuery = supabase
    .from('counters')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (branchId) {
    countersQuery = countersQuery.eq('branch_id', branchId);
  }

  const { count: activeCounters } = await countersQuery;

  // Get services count
  const { count: servicesCount } = await supabase
    .from('services')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  // Get completed today
  let completedQuery = supabase
    .from('lines')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .gte('completed_at', today);

  if (branchId) {
    completedQuery = completedQuery.eq('branch_id', branchId);
  }

  const { count: completedToday } = await completedQuery;

  // Get cancelled today
  let cancelledQuery = supabase
    .from('lines')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('status', 'cancelled')
    .gte('completed_at', today);

  if (branchId) {
    cancelledQuery = cancelledQuery.eq('branch_id', branchId);
  }

  const { count: cancelledToday } = await cancelledQuery;

  return {
    totalInQueue: waitingCount || 0,
    avgWaitTime: Math.round(avgWait),
    activeCounters: activeCounters || 0,
    servicesActive: servicesCount || 0,
    completedToday: completedToday || 0,
    cancelledToday: cancelledToday || 0
  };
}

export async function fetchQueueByService(
  organizationId: string,
  serviceId: string,
  branchId?: string
): Promise<QueueEntry[]> {
  return fetchQueueEntries(organizationId, {
    serviceId,
    branchId,
    status: 'waiting'
  });
}

export async function fetchMyQueue(
  organizationId: string,
  staffUserId: string,
  assignedServiceId: string | null,
  branchId?: string
): Promise<QueueEntry[]> {
  if (!assignedServiceId) return [];
  
  return fetchQueueEntries(organizationId, {
    serviceId: assignedServiceId,
    branchId,
    status: ['waiting', 'serving']
  });
}

export async function callCustomer(lineId: string, staffUserId: string, counterId?: string) {
  const { error } = await supabase
    .from('lines')
    .update({
      status: 'serving',
      called_at: new Date().toISOString(),
      started_serving_at: new Date().toISOString()
    })
    .eq('id', lineId);

  if (error) throw error;

  // Create service session
  await supabase
    .from('service_sessions')
    .insert({
      line_id: lineId,
      staff_user_id: staffUserId,
      counter_id: counterId,
      started_at: new Date().toISOString()
    });
}

export async function completeService(lineId: string, notes?: string) {
  const now = new Date().toISOString();
  
  // Get line data to calculate wait time
  const { data: line } = await supabase
    .from('lines')
    .select('joined_at, started_serving_at')
    .eq('id', lineId)
    .single();

  let actualWaitMinutes = null;
  if (line?.joined_at && line?.started_serving_at) {
    const joined = new Date(line.joined_at);
    const started = new Date(line.started_serving_at);
    actualWaitMinutes = Math.round((started.getTime() - joined.getTime()) / 60000);
  }

  const { error } = await supabase
    .from('lines')
    .update({
      status: 'completed',
      completed_at: now,
      actual_wait_minutes: actualWaitMinutes,
      notes: notes || null
    })
    .eq('id', lineId);

  if (error) throw error;

  // Update service session
  await supabase
    .from('service_sessions')
    .update({
      completed_at: now,
      outcome: 'completed',
      notes
    })
    .eq('line_id', lineId)
    .is('completed_at', null);
}

export async function cancelCustomer(lineId: string, notes?: string) {
  const { data: line } = await supabase
    .from('lines')
    .select('organization_id, service_id, position')
    .eq('id', lineId)
    .single();

  if (!line) throw new Error('Line not found');

  const { error } = await supabase
    .from('lines')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
      notes: notes || null
    })
    .eq('id', lineId);

  if (error) throw error;

  // Shift positions
  await supabase.rpc('shift_queue_positions', {
    p_org_id: line.organization_id,
    p_service_id: line.service_id,
    p_from_position: line.position
  });
}

export async function markNoShow(lineId: string) {
  const { data: line } = await supabase
    .from('lines')
    .select('organization_id, service_id, position')
    .eq('id', lineId)
    .single();

  if (!line) throw new Error('Line not found');

  const { error } = await supabase
    .from('lines')
    .update({
      status: 'no_show',
      completed_at: new Date().toISOString()
    })
    .eq('id', lineId);

  if (error) throw error;

  // Shift positions
  await supabase.rpc('shift_queue_positions', {
    p_org_id: line.organization_id,
    p_service_id: line.service_id,
    p_from_position: line.position
  });
}

export async function moveCustomerUp(lineId: string, organizationId: string, serviceId: string) {
  const { data: line } = await supabase
    .from('lines')
    .select('position')
    .eq('id', lineId)
    .single();

  if (!line || line.position <= 1) return;

  // Swap with the one above
  const { data: above } = await supabase
    .from('lines')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('service_id', serviceId)
    .eq('position', line.position - 1)
    .eq('status', 'waiting')
    .single();

  if (above) {
    await supabase.from('lines').update({ position: line.position }).eq('id', above.id);
    await supabase.from('lines').update({ position: line.position - 1 }).eq('id', lineId);
  }
}

export async function moveCustomerDown(lineId: string, organizationId: string, serviceId: string) {
  const { data: line } = await supabase
    .from('lines')
    .select('position')
    .eq('id', lineId)
    .single();

  if (!line) return;

  // Swap with the one below
  const { data: below } = await supabase
    .from('lines')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('service_id', serviceId)
    .eq('position', line.position + 1)
    .eq('status', 'waiting')
    .single();

  if (below) {
    await supabase.from('lines').update({ position: line.position }).eq('id', below.id);
    await supabase.from('lines').update({ position: line.position + 1 }).eq('id', lineId);
  }
}

export async function joinQueue(
  organizationId: string,
  serviceId: string,
  branchId: string,
  clientId: string
): Promise<{ lineId: string; ticketNumber: string; position: number }> {
  // Get next position
  const { count } = await supabase
    .from('lines')
    .select('id', { count: 'exact' })
    .eq('organization_id', organizationId)
    .eq('service_id', serviceId)
    .eq('branch_id', branchId)
    .eq('status', 'waiting');

  const position = (count || 0) + 1;

  // Generate ticket number
  const { data: service } = await supabase
    .from('services')
    .select('name')
    .eq('id', serviceId)
    .single();

  const prefix = service?.name?.substring(0, 3).toUpperCase() || 'TKT';
  const ticketNumber = `${prefix}-${String(position).padStart(3, '0')}`;

  // Get estimated wait time
  const { data: serviceData } = await supabase
    .from('services')
    .select('base_avg_time_minutes')
    .eq('id', serviceId)
    .single();

  const estimatedWait = (serviceData?.base_avg_time_minutes || 15) * position;

  // Insert line
  const { data, error } = await supabase
    .from('lines')
    .insert({
      organization_id: organizationId,
      service_id: serviceId,
      branch_id: branchId,
      client_id: clientId,
      ticket_number: ticketNumber,
      position,
      status: 'waiting',
      joined_at: new Date().toISOString(),
      estimated_wait_minutes: estimatedWait
    })
    .select()
    .single();

  if (error) throw error;

  return {
    lineId: data.id,
    ticketNumber: data.ticket_number,
    position: data.position
  };
}

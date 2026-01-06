// Analytics-related API calls

import { supabase } from '@/integrations/supabase/client';
import type { 
  AnalyticsSummary, 
  DailyStats, 
  ServiceStats, 
  HourlyDistribution,
  TrendData,
  ActivityEvent 
} from '@/types/analytics';

export async function fetchAnalyticsSummary(
  organizationId: string,
  dateRange: 'today' | 'week' | 'month' = 'today'
): Promise<AnalyticsSummary> {
  const now = new Date();
  let startDate: Date;
  let previousStart: Date;
  let previousEnd: Date;

  switch (dateRange) {
    case 'week':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    default: // today
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      previousStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      previousEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  const startDateStr = startDate.toISOString().split('T')[0];
  const previousStartStr = previousStart.toISOString().split('T')[0];
  const previousEndStr = previousEnd.toISOString().split('T')[0];

  // Fetch current period data
  const { data: currentData } = await supabase
    .from('visit_history')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('visit_date', startDateStr);

  // Fetch previous period data
  const { data: previousData } = await supabase
    .from('visit_history')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('visit_date', previousStartStr)
    .lt('visit_date', previousEndStr);

  const current = currentData || [];
  const previous = previousData || [];

  // Calculate metrics
  const currentTotal = current.length;
  const previousTotal = previous.length;

  const currentCompleted = current.filter(v => !v.was_cancelled && !v.was_no_show);
  const previousCompleted = previous.filter(v => !v.was_cancelled && !v.was_no_show);

  const currentAvgWait = currentCompleted.length > 0
    ? currentCompleted.reduce((sum, v) => sum + (v.wait_time_minutes || 0), 0) / currentCompleted.length
    : 0;
  const previousAvgWait = previousCompleted.length > 0
    ? previousCompleted.reduce((sum, v) => sum + (v.wait_time_minutes || 0), 0) / previousCompleted.length
    : 0;

  const currentCompletionRate = currentTotal > 0
    ? (currentCompleted.length / currentTotal) * 100
    : 0;
  const previousCompletionRate = previousTotal > 0
    ? (previousCompleted.length / previousTotal) * 100
    : 0;

  const currentNoShows = current.filter(v => v.was_no_show).length;
  const previousNoShows = previous.filter(v => v.was_no_show).length;
  const currentNoShowRate = currentTotal > 0 ? (currentNoShows / currentTotal) * 100 : 0;
  const previousNoShowRate = previousTotal > 0 ? (previousNoShows / previousTotal) * 100 : 0;

  // Hourly distribution
  const hourlyMap = new Map<number, { count: number; totalWait: number }>();
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { count: 0, totalWait: 0 });
  }
  
  current.forEach(v => {
    const hourData = hourlyMap.get(v.hour_of_day)!;
    hourData.count++;
    hourData.totalWait += v.wait_time_minutes || 0;
  });

  const hourlyDistribution: HourlyDistribution[] = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
    hour,
    count: data.count,
    avgWaitTime: data.count > 0 ? Math.round(data.totalWait / data.count) : 0
  }));

  // Find peak hour
  const peakHour = hourlyDistribution.reduce((max, h) => h.count > max.count ? h : max, { hour: 0, count: 0, avgWaitTime: 0 });

  // Service breakdown
  const { data: services } = await supabase
    .from('services')
    .select('id, name, color')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  const serviceBreakdown: ServiceStats[] = (services || []).map(service => {
    const serviceVisits = current.filter(v => v.service_id === service.id);
    const completed = serviceVisits.filter(v => !v.was_cancelled && !v.was_no_show);
    
    return {
      serviceId: service.id,
      serviceName: service.name,
      serviceColor: service.color,
      totalVisitors: serviceVisits.length,
      avgWaitTime: completed.length > 0
        ? Math.round(completed.reduce((sum, v) => sum + (v.wait_time_minutes || 0), 0) / completed.length)
        : 0,
      avgServiceTime: completed.length > 0
        ? Math.round(completed.reduce((sum, v) => sum + (v.service_time_minutes || 0), 0) / completed.length)
        : 0,
      completionRate: serviceVisits.length > 0
        ? (completed.length / serviceVisits.length) * 100
        : 0
    };
  });

  return {
    totalVisitors: createTrendData(currentTotal, previousTotal),
    avgWaitTime: createTrendData(currentAvgWait, previousAvgWait, true),
    completionRate: createTrendData(currentCompletionRate, previousCompletionRate),
    peakHour: { hour: peakHour.hour, count: peakHour.count },
    noShowRate: createTrendData(currentNoShowRate, previousNoShowRate, true),
    customerSatisfaction: createTrendData(85, 82), // Placeholder
    hourlyDistribution,
    serviceBreakdown,
    dailyTrend: []
  };
}

function createTrendData(current: number, previous: number, lowerIsBetter = false): TrendData {
  const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  let trend: 'up' | 'down' | 'stable';
  
  if (Math.abs(change) < 1) {
    trend = 'stable';
  } else if (change > 0) {
    trend = lowerIsBetter ? 'down' : 'up';
  } else {
    trend = lowerIsBetter ? 'up' : 'down';
  }

  return {
    current: Math.round(current * 10) / 10,
    previous: Math.round(previous * 10) / 10,
    changePercent: Math.round(change * 10) / 10,
    trend
  };
}

export async function fetchRecentActivity(
  organizationId: string,
  limit = 20
): Promise<ActivityEvent[]> {
  const { data } = await supabase
    .from('lines')
    .select(`
      id,
      ticket_number,
      status,
      joined_at,
      called_at,
      completed_at,
      client:clients(full_name),
      service:services(name)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  const events: ActivityEvent[] = [];

  data.forEach((line: any) => {
    if (line.completed_at && line.status === 'completed') {
      events.push({
        id: `${line.id}-complete`,
        type: 'queue_complete',
        timestamp: line.completed_at,
        description: `Completed service for ${line.client?.full_name || 'Unknown'}`,
        customerName: line.client?.full_name,
        serviceName: line.service?.name,
        ticketNumber: line.ticket_number
      });
    }

    if (line.called_at && (line.status === 'serving' || line.status === 'completed')) {
      events.push({
        id: `${line.id}-call`,
        type: 'queue_call',
        timestamp: line.called_at,
        description: `Called ${line.client?.full_name || 'Unknown'} for ${line.service?.name || 'service'}`,
        customerName: line.client?.full_name,
        serviceName: line.service?.name,
        ticketNumber: line.ticket_number
      });
    }

    if (line.joined_at) {
      events.push({
        id: `${line.id}-join`,
        type: 'queue_join',
        timestamp: line.joined_at,
        description: `${line.client?.full_name || 'Unknown'} joined ${line.service?.name || 'queue'}`,
        customerName: line.client?.full_name,
        serviceName: line.service?.name,
        ticketNumber: line.ticket_number
      });
    }
  });

  // Sort by timestamp descending
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return events.slice(0, limit);
}

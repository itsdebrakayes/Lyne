import { supabase } from '@/lib/supabase';
import type { 
  AnalyticsSummary, 
  ActivityEvent,
  HourlyDistribution,
  ServiceStats,
  DailyStats
} from '@/types/analytics';

export async function fetchAnalyticsSummary(
  organizationId: string,
  dateRange: 'today' | 'week' | 'month' = 'today'
): Promise<AnalyticsSummary> {
  const now = new Date();
  let startDate: Date;
  let previousStartDate: Date;
  
  switch (dateRange) {
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      previousStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.toISOString().split('T')[0]);
      previousStartDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
  }

  const startStr = startDate.toISOString();
  const previousStartStr = previousStartDate.toISOString();
  const previousEndStr = startDate.toISOString();

  // Current period visitors
  const { data: currentVisits } = await supabase
    .from('visit_history')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('visit_date', startStr.split('T')[0]);

  // Previous period visitors
  const { data: previousVisits } = await supabase
    .from('visit_history')
    .select('*')
    .eq('organization_id', organizationId)
    .gte('visit_date', previousStartStr.split('T')[0])
    .lt('visit_date', previousEndStr.split('T')[0]);

  const currentTotal = currentVisits?.length || 0;
  const previousTotal = previousVisits?.length || 0;
  const totalChange = previousTotal > 0 
    ? ((currentTotal - previousTotal) / previousTotal) * 100 
    : 0;

  // Calculate average wait time
  const currentWaitTimes = currentVisits?.filter(v => v.wait_time_minutes != null) || [];
  const previousWaitTimes = previousVisits?.filter(v => v.wait_time_minutes != null) || [];
  
  const currentAvgWait = currentWaitTimes.length > 0
    ? currentWaitTimes.reduce((sum, v) => sum + (v.wait_time_minutes || 0), 0) / currentWaitTimes.length
    : 0;
  const previousAvgWait = previousWaitTimes.length > 0
    ? previousWaitTimes.reduce((sum, v) => sum + (v.wait_time_minutes || 0), 0) / previousWaitTimes.length
    : 0;
  const waitChange = previousAvgWait > 0
    ? ((currentAvgWait - previousAvgWait) / previousAvgWait) * 100
    : 0;

  // Completion rate
  const currentCancelled = currentVisits?.filter(v => v.was_cancelled).length || 0;
  const currentNoShow = currentVisits?.filter(v => v.was_no_show).length || 0;
  const currentCompleted = currentTotal - currentCancelled - currentNoShow;
  const completionRate = currentTotal > 0 ? (currentCompleted / currentTotal) * 100 : 0;

  const previousCancelled = previousVisits?.filter(v => v.was_cancelled).length || 0;
  const previousNoShow = previousVisits?.filter(v => v.was_no_show).length || 0;
  const previousCompleted = previousTotal - previousCancelled - previousNoShow;
  const previousCompletionRate = previousTotal > 0 ? (previousCompleted / previousTotal) * 100 : 0;
  const completionChange = previousCompletionRate > 0
    ? completionRate - previousCompletionRate
    : 0;

  // Peak hour
  const hourCounts = new Map<number, number>();
  const hourWaitTimes = new Map<number, number[]>();
  currentVisits?.forEach(v => {
    const count = hourCounts.get(v.hour_of_day) || 0;
    hourCounts.set(v.hour_of_day, count + 1);
    
    const waits = hourWaitTimes.get(v.hour_of_day) || [];
    if (v.wait_time_minutes != null) {
      waits.push(v.wait_time_minutes);
    }
    hourWaitTimes.set(v.hour_of_day, waits);
  });
  
  let peakHour = 9;
  let peakCount = 0;
  hourCounts.forEach((count, hour) => {
    if (count > peakCount) {
      peakCount = count;
      peakHour = hour;
    }
  });

  // No-show rate
  const noShowRate = currentTotal > 0 ? (currentNoShow / currentTotal) * 100 : 0;
  const previousNoShowRate = previousTotal > 0 ? (previousNoShow / previousTotal) * 100 : 0;
  const noShowChange = noShowRate - previousNoShowRate;

  // Hourly distribution
  const hourlyDistribution: HourlyDistribution[] = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 8; // 8 AM to 8 PM
    const waits = hourWaitTimes.get(hour) || [];
    const avgWaitTime = waits.length > 0 
      ? waits.reduce((a, b) => a + b, 0) / waits.length 
      : 0;
    return {
      hour,
      count: hourCounts.get(hour) || 0,
      avgWaitTime: Math.round(avgWaitTime)
    };
  });

  // Service breakdown
  const serviceMap = new Map<string, { count: number; waitTimes: number[]; serviceTimes: number[] }>();
  currentVisits?.forEach(v => {
    if (v.service_id) {
      const existing = serviceMap.get(v.service_id) || { count: 0, waitTimes: [], serviceTimes: [] };
      existing.count++;
      if (v.wait_time_minutes != null) existing.waitTimes.push(v.wait_time_minutes);
      if (v.service_time_minutes != null) existing.serviceTimes.push(v.service_time_minutes);
      serviceMap.set(v.service_id, existing);
    }
  });

  const { data: services } = await supabase
    .from('services')
    .select('id, name, color')
    .eq('organization_id', organizationId);

  const serviceBreakdown: ServiceStats[] = (services || []).map(s => {
    const stats = serviceMap.get(s.id) || { count: 0, waitTimes: [], serviceTimes: [] };
    const avgWait = stats.waitTimes.length > 0 
      ? stats.waitTimes.reduce((a, b) => a + b, 0) / stats.waitTimes.length 
      : 0;
    const avgService = stats.serviceTimes.length > 0 
      ? stats.serviceTimes.reduce((a, b) => a + b, 0) / stats.serviceTimes.length 
      : 0;
    
    return {
      serviceId: s.id,
      serviceName: s.name,
      serviceColor: s.color,
      totalVisitors: stats.count,
      avgWaitTime: Math.round(avgWait),
      avgServiceTime: Math.round(avgService),
      completionRate: 85 // Would need per-service calculation
    };
  });

  // Daily trend
  const dailyMap = new Map<string, { 
    count: number; 
    waitTimes: number[]; 
    serviceTimes: number[];
    cancelled: number;
    noShow: number;
    hourCounts: Map<number, number>;
  }>();
  
  currentVisits?.forEach(v => {
    const existing = dailyMap.get(v.visit_date) || { 
      count: 0, 
      waitTimes: [], 
      serviceTimes: [],
      cancelled: 0,
      noShow: 0,
      hourCounts: new Map()
    };
    existing.count++;
    if (v.wait_time_minutes != null) existing.waitTimes.push(v.wait_time_minutes);
    if (v.service_time_minutes != null) existing.serviceTimes.push(v.service_time_minutes);
    if (v.was_cancelled) existing.cancelled++;
    if (v.was_no_show) existing.noShow++;
    const hourCount = existing.hourCounts.get(v.hour_of_day) || 0;
    existing.hourCounts.set(v.hour_of_day, hourCount + 1);
    dailyMap.set(v.visit_date, existing);
  });

  const dailyTrend: DailyStats[] = Array.from(dailyMap.entries())
    .map(([date, stats]) => {
      const avgWait = stats.waitTimes.length > 0 
        ? stats.waitTimes.reduce((a, b) => a + b, 0) / stats.waitTimes.length 
        : 0;
      const avgService = stats.serviceTimes.length > 0 
        ? stats.serviceTimes.reduce((a, b) => a + b, 0) / stats.serviceTimes.length 
        : 0;
      
      let peakHour = 9;
      let peakHourCount = 0;
      stats.hourCounts.forEach((count, hour) => {
        if (count > peakHourCount) {
          peakHourCount = count;
          peakHour = hour;
        }
      });

      return {
        date,
        totalVisitors: stats.count,
        avgWaitTime: Math.round(avgWait),
        avgServiceTime: Math.round(avgService),
        completedCount: stats.count - stats.cancelled - stats.noShow,
        cancelledCount: stats.cancelled,
        noShowCount: stats.noShow,
        peakHour,
        peakHourCount
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalVisitors: {
      current: currentTotal,
      previous: previousTotal,
      changePercent: Math.round(totalChange),
      trend: totalChange > 0 ? 'up' : totalChange < 0 ? 'down' : 'stable'
    },
    avgWaitTime: {
      current: Math.round(currentAvgWait),
      previous: Math.round(previousAvgWait),
      changePercent: Math.round(waitChange),
      trend: waitChange < 0 ? 'up' : waitChange > 0 ? 'down' : 'stable' // Lower wait is better
    },
    completionRate: {
      current: Math.round(completionRate),
      previous: Math.round(previousCompletionRate),
      changePercent: Math.round(completionChange),
      trend: completionChange > 0 ? 'up' : completionChange < 0 ? 'down' : 'stable'
    },
    peakHour: {
      hour: peakHour,
      count: peakCount
    },
    noShowRate: {
      current: Math.round(noShowRate),
      previous: Math.round(previousNoShowRate),
      changePercent: Math.round(noShowChange),
      trend: noShowChange < 0 ? 'up' : noShowChange > 0 ? 'down' : 'stable' // Lower no-show is better
    },
    customerSatisfaction: {
      current: 85, // Placeholder - would need feedback table
      previous: 82,
      changePercent: 3,
      trend: 'up'
    },
    hourlyDistribution,
    serviceBreakdown,
    dailyTrend
  };
}

export async function fetchRecentActivity(
  organizationId: string,
  limit = 20
): Promise<ActivityEvent[]> {
  // Get recent queue activity
  const { data: lines } = await supabase
    .from('lines')
    .select(`
      id,
      ticket_number,
      status,
      joined_at,
      called_at,
      completed_at,
      clients:client_id(full_name),
      services:service_id(name)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const activities: ActivityEvent[] = [];

  (lines || []).forEach(line => {
    const clientName = Array.isArray(line.clients) 
      ? line.clients[0]?.full_name 
      : (line.clients as any)?.full_name;
    const serviceName = Array.isArray(line.services) 
      ? line.services[0]?.name 
      : (line.services as any)?.name;

    if (line.completed_at) {
      activities.push({
        id: `${line.id}-complete`,
        type: line.status === 'completed' ? 'queue_complete' : 'queue_cancel',
        description: `${clientName || 'Customer'} - ${serviceName || 'Service'} ${line.status === 'completed' ? 'completed' : 'cancelled'}`,
        timestamp: line.completed_at,
        ticketNumber: line.ticket_number,
        customerName: clientName || undefined,
        serviceName: serviceName || undefined
      });
    }
    
    if (line.called_at) {
      activities.push({
        id: `${line.id}-called`,
        type: 'queue_call',
        description: `${line.ticket_number} called for ${serviceName || 'service'}`,
        timestamp: line.called_at,
        ticketNumber: line.ticket_number,
        serviceName: serviceName || undefined
      });
    }
    
    if (line.joined_at) {
      activities.push({
        id: `${line.id}-joined`,
        type: 'queue_join',
        description: `${clientName || 'Customer'} joined ${serviceName || 'queue'}`,
        timestamp: line.joined_at,
        ticketNumber: line.ticket_number,
        customerName: clientName || undefined,
        serviceName: serviceName || undefined
      });
    }
  });

  // Sort by timestamp and limit
  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

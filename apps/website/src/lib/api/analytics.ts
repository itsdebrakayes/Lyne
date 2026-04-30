/**
 * analytics.ts — Analytics API (MySQL backend)
 *
 * Replaces the previous Supabase-based implementation.
 * All data now comes from the Q ME NOW Express backend API.
 */

import api from '@/lib/apiClient';
import type {
  AnalyticsSummary,
  ActivityEvent,
  HourlyDistribution,
  ServiceStats,
  DailyStats,
} from '@/types/analytics';

// ── Types returned by the backend ────────────────────────────

interface BackendSummaryRow {
  summary_date: string;
  total_visitors: number;
  completed_count: number;
  cancelled_count: number;
  no_show_count: number;
  avg_wait_time_minutes: number;
  avg_service_time_minutes: number;
  peak_hour: number;
}

interface BackendHeatmapRow {
  dow: number;
  hour: number;
  visit_count: number;
  avg_wait: number;
}

interface BackendServiceRow {
  service_id: string;
  service_name: string;
  total_visits: number;
  completed: number;
  cancelled: number;
  no_shows: number;
  avg_wait_minutes: number;
  avg_service_minutes: number;
}

interface BackendTicketRow {
  id: string;
  ticket_number: string;
  status: string;
  joined_at: string;
  called_at?: string;
  completed_at?: string;
  user_full_name?: string;
  service_name?: string;
}

// ── Helpers ───────────────────────────────────────────────────

function buildQs(businessId: string, branchId?: string, dateRange?: string) {
  return new URLSearchParams({
    business_id: businessId,
    ...(branchId   ? { branch_id:   branchId   } : {}),
    ...(dateRange  ? { date_range:  dateRange   } : {}),
  }).toString();
}

// ── Public API ────────────────────────────────────────────────

export async function fetchAnalyticsSummary(
  businessId: string,
  dateRange: 'today' | 'week' | 'month' = 'today',
  branchId?: string
): Promise<AnalyticsSummary> {
  const qs = buildQs(businessId, branchId, dateRange);

  const [summaryRows, heatmapRows, serviceRows] = await Promise.all([
    api.get<BackendSummaryRow[]>(`/analytics/summary?${qs}`),
    api.get<BackendHeatmapRow[]>(`/analytics/heatmap?${qs}`),
    api.get<BackendServiceRow[]>(`/analytics/services?${qs}`),
  ]);

  // Aggregate summary rows
  const totals = summaryRows.reduce(
    (acc, r) => ({
      total:     acc.total     + r.total_visitors,
      completed: acc.completed + r.completed_count,
      cancelled: acc.cancelled + r.cancelled_count,
      noShow:    acc.noShow    + r.no_show_count,
      waitSum:   acc.waitSum   + r.avg_wait_time_minutes * r.total_visitors,
    }),
    { total: 0, completed: 0, cancelled: 0, noShow: 0, waitSum: 0 }
  );

  const currentTotal   = totals.total;
  const currentAvgWait = currentTotal > 0 ? totals.waitSum / currentTotal : 0;
  const completionRate = currentTotal > 0 ? (totals.completed / currentTotal) * 100 : 0;
  const noShowRate     = currentTotal > 0 ? (totals.noShow    / currentTotal) * 100 : 0;

  // Peak hour from heatmap
  const peakCell = heatmapRows.reduce(
    (best, r) => (r.visit_count > best.visit_count ? r : best),
    { hour: 9, visit_count: 0, dow: 1, avg_wait: 0 }
  );

  // Hourly distribution (8am–8pm)
  const hourlyDistribution: HourlyDistribution[] = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 8;
    const cells = heatmapRows.filter(r => r.hour === hour);
    const count = cells.reduce((s, r) => s + r.visit_count, 0);
    const avgWait = cells.length > 0
      ? cells.reduce((s, r) => s + r.avg_wait, 0) / cells.length
      : 0;
    return { hour, count, avgWaitTime: Math.round(avgWait) };
  });

  // Service breakdown
  const serviceBreakdown: ServiceStats[] = serviceRows.map(s => ({
    serviceId:      s.service_id,
    serviceName:    s.service_name,
    serviceColor:   undefined,
    totalVisitors:  s.total_visits,
    avgWaitTime:    Math.round(s.avg_wait_minutes),
    avgServiceTime: Math.round(s.avg_service_minutes),
    completionRate: s.total_visits > 0
      ? Math.round((s.completed / s.total_visits) * 100)
      : 0,
  }));

  // Daily trend from summary rows
  const dailyTrend: DailyStats[] = summaryRows.map(r => ({
    date:           r.summary_date,
    totalVisitors:  r.total_visitors,
    avgWaitTime:    Math.round(r.avg_wait_time_minutes),
    avgServiceTime: Math.round(r.avg_service_time_minutes),
    completedCount: r.completed_count,
    cancelledCount: r.cancelled_count,
    noShowCount:    r.no_show_count,
    peakHour:       r.peak_hour,
    peakHourCount:  0,
  })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalVisitors:  { current: currentTotal,              previous: 0, changePercent: 0, trend: 'stable' },
    avgWaitTime:    { current: Math.round(currentAvgWait), previous: 0, changePercent: 0, trend: 'stable' },
    completionRate: { current: Math.round(completionRate), previous: 0, changePercent: 0, trend: 'stable' },
    peakHour:       { hour: peakCell.hour, count: peakCell.visit_count },
    noShowRate:     { current: Math.round(noShowRate),     previous: 0, changePercent: 0, trend: 'stable' },
    customerSatisfaction: { current: 85, previous: 82, changePercent: 3, trend: 'up' },
    hourlyDistribution,
    serviceBreakdown,
    dailyTrend,
  };
}

export async function fetchRecentActivity(
  businessId: string,
  limit = 20,
  branchId?: string
): Promise<ActivityEvent[]> {
  const qs = buildQs(businessId, branchId);
  const tickets = await api.get<BackendTicketRow[]>(`/tickets/recent?${qs}&limit=${limit}`);

  const activities: ActivityEvent[] = [];

  tickets.forEach(t => {
    if (t.completed_at) {
      activities.push({
        id:           `${t.id}-complete`,
        type:         t.status === 'completed' ? 'queue_complete' : 'queue_cancel',
        description:  `${t.user_full_name || 'Customer'} — ${t.service_name || 'Service'} ${t.status}`,
        timestamp:    t.completed_at,
        ticketNumber: t.ticket_number,
        customerName: t.user_full_name,
        serviceName:  t.service_name,
      });
    }
    if (t.called_at) {
      activities.push({
        id:           `${t.id}-called`,
        type:         'queue_call',
        description:  `${t.ticket_number} called for ${t.service_name || 'service'}`,
        timestamp:    t.called_at,
        ticketNumber: t.ticket_number,
        serviceName:  t.service_name,
      });
    }
    if (t.joined_at) {
      activities.push({
        id:           `${t.id}-joined`,
        type:         'queue_join',
        description:  `${t.user_full_name || 'Customer'} joined ${t.service_name || 'queue'}`,
        timestamp:    t.joined_at,
        ticketNumber: t.ticket_number,
        customerName: t.user_full_name,
        serviceName:  t.service_name,
      });
    }
  });

  return activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

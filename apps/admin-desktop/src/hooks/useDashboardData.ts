/**
 * useDashboardData — shared data layer for the Manager & Executive dashboards.
 *
 * Fetches queues, analytics summaries, service/branch/staff insights, targets,
 * heatmap, demand and every predictive_results insight for the signed-in staff
 * member's business (branch-scoped for managers, business-wide for executives),
 * and returns them as flat, ready-to-render arrays.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/lib/apiClient';

export type QueueRow = {
  id: string; branch_id?: string; branch_name?: string; service_id?: string; service_name?: string;
  waiting_count?: number; serving_count?: number; total_count?: number; avg_wait_minutes?: number; status?: string;
};
export type SummaryRow = {
  summary_date: string; total_visitors?: number; completed_count?: number; no_show_count?: number;
  left_count?: number; avg_wait_time_minutes?: number; avg_service_time_minutes?: number; completion_rate?: number;
  // analytics_summaries is per business × branch × service × date — the API
  // returns a.* so these are present and let us scope totals per branch/service.
  branch_id?: string; branch_name?: string; service_id?: string;
};
export type ServiceInsight = {
  service_id?: string; service_name: string; total_visits?: number; completed?: number; no_shows?: number;
  avg_wait_minutes?: number; avg_service_minutes?: number; dropoff_pct?: number;
};
export type StaffInsight = {
  staff_id?: string; full_name: string; staff_code?: string; tickets_handled?: number; avg_handle_minutes?: number;
};
export type BranchTrend = {
  branch_id?: string; branch_name?: string; business_name?: string; visit_date?: string; total_visits?: number;
  avg_wait_minutes?: number; completed?: number; no_shows?: number; completion_rate?: number;
};
export type ManagerScore = {
  manager_id: string; manager_name: string; staff_code?: string; branch_id?: string; branch_name?: string;
  total_visits: number; completed_count: number; no_show_count: number; avg_wait_minutes?: number;
  avg_service_minutes?: number; completion_rate: number; no_show_rate: number; staff_utilization: number;
  manager_score: number; rank: number;
};
export type HeatmapCell = {
  dow: number; hour: number; visit_count?: number; avg_wait?: number; avg_wait_minutes?: number; completed?: number; no_shows?: number;
};
export type DemandCell = { row_id: string; row_name: string; bucket: number; visit_count?: number; avg_wait?: number };
export type BusinessTargets = {
  business_id: string; target_wait_minutes: number; target_completion_rate: number; target_no_show_rate: number;
  horizon_months: number; target_date?: string | null; note?: string | null; set_by_name?: string | null;
  updated_at?: string; is_default?: boolean;
};
// A branch's effective targets: the three operational metrics resolved as
// branch → company → default, plus the company target it works within.
export type BranchTargets = BusinessTargets & { branch_id: string; company: BusinessTargets };
export type ExecutiveKpis = {
  month: string; total_employees: number; active_employees: number; previous_active_employees: number;
  active_change_pct: number; leave_employees: number; new_employees: number;
  new_staff?: Array<{ id: string; full_name: string; staff_code?: string; branch_name?: string; created_at?: string }>;
};
export type PredictionRow = {
  id?: string; insight_type: string; insight_data?: unknown; generated_at?: string;
  branch_name?: string; service_name?: string; is_stale?: boolean | number;
};
export type BalkingData = {
  total_joins: number; total_reneged: number; renege_rate_pct: number; avg_renege_minutes: number | null;
  balk_wait_minutes: number | null; histogram: Array<{ wait_bucket: string; joins: number; reneged: number }>; insight: string;
};
export type ChannelMix = {
  total: number; self_service_pct: number; staffed_intake: number;
  channels: Array<{ channel: 'app' | 'walk_in' | 'kiosk'; count: number; pct: number; avg_wait: number | null; abandon_pct: number | null }>;
  trend: Array<{ week_start: string; total: number; app_pct: number }>;
};
export type ProductivitySignals = {
  generated_at: string;
  slowdowns: Array<{ counter_label: string; service_name: string; staff_name?: string; current_avg: number; baseline: number; sample: number; message: string }>;
  idle: Array<{ staff_name: string; counter_label: string; service_name: string; idle_minutes: number; waiting: number; message: string }>;
};

export const DEFAULT_TARGETS: BusinessTargets = {
  business_id: '', target_wait_minutes: 20, target_completion_rate: 80, target_no_show_rate: 10,
  horizon_months: 6, is_default: true,
};

export function analysisMonthKey(rows: SummaryRow[] = []) {
  const dates = rows.map((r) => String(r.summary_date || '').slice(0, 10)).filter(Boolean).sort();
  const newest = dates[dates.length - 1];
  return newest ? newest.slice(0, 7) : new Date().toISOString().slice(0, 7);
}

export function useDashboardData(serviceId = '') {
  const { admin } = useAdminAuth();
  const businessId = admin?.staffRecord.business_id;
  const branchId = admin?.staffRecord.branch_id;
  const branchScoped = admin?.role === 'manager' || admin?.role === 'supervisor';
  const canAnalytics = branchScoped || admin?.role === 'executive';
  const analyticsQuery = businessId
    ? `business_id=${businessId}${branchId && branchScoped ? `&branch_id=${branchId}` : ''}${serviceId ? `&service_id=${serviceId}` : ''}`
    : '';

  const queues = useQuery({
    queryKey: ['ops-queues', businessId, branchId, admin?.role],
    queryFn: () => api.get<QueueRow[]>('/queues/mine'),
    enabled: Boolean(admin), refetchInterval: 10_000,
  });
  // The summary endpoint defaults to only 30 days. Ask for a wider window so the
  // drill-down's 30/90-day ranges are genuinely 30/90 days, not silently capped.
  const historyFrom = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  const summary = useQuery({
    queryKey: ['ops-summary', analyticsQuery, historyFrom],
    queryFn: () => api.get<SummaryRow[]>(`/analytics/summary?${analyticsQuery}&from=${historyFrom}`),
    enabled: Boolean(canAnalytics && analyticsQuery), refetchInterval: 60_000,
  });
  // Scope services to exactly the SAME dates the dashboards headline — the last
  // 7 dates that actually have data. A calendar guess (today-6) drifts whenever
  // a day has no records, which made the Services tab disagree with Overview.
  const weekWindow = useMemo(() => {
    const ds = [...new Set((summary.data || []).map((r) => String(r.summary_date).slice(0, 10)))].sort();
    const last7 = ds.slice(-7);
    return { from: last7[0], to: last7[last7.length - 1] };
  }, [summary.data]);
  const services = useQuery({
    queryKey: ['ops-services', analyticsQuery, weekWindow.from, weekWindow.to],
    queryFn: () => api.get<ServiceInsight[]>(`/analytics/services?${analyticsQuery}&from=${weekWindow.from}&to=${weekWindow.to}`),
    // wait for the summary so we know which 7 dates to scope to
    enabled: Boolean(canAnalytics && analyticsQuery && weekWindow.from), refetchInterval: 60_000,
  });
  const staff = useQuery({
    queryKey: ['ops-staff-insights', analyticsQuery],
    queryFn: () => api.get<StaffInsight[]>(`/analytics/staff?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && analyticsQuery), refetchInterval: 60_000,
  });
  const branchTrends = useQuery({
    queryKey: ['ops-branch-trends', analyticsQuery],
    queryFn: () => api.get<BranchTrend[]>(`/analytics/branch-trends?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && analyticsQuery), refetchInterval: 60_000,
  });
  const heatmap = useQuery({
    queryKey: ['ops-heatmap', analyticsQuery],
    queryFn: () => api.get<HeatmapCell[]>(`/analytics/heatmap?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && analyticsQuery), refetchInterval: 60_000,
  });
  // Rows are services for managers, branches for executives.
  const demandRows = admin?.role === 'executive' ? 'branch' : 'service';
  const demandHourly = useQuery({
    queryKey: ['ops-demand-hourly', analyticsQuery, demandRows],
    queryFn: () => api.get<DemandCell[]>(`/analytics/demand?${analyticsQuery}&rows=${demandRows}&by=hour`),
    enabled: Boolean(canAnalytics && analyticsQuery), refetchInterval: 60_000,
  });
  const demandWeekly = useQuery({
    queryKey: ['ops-demand-weekly', analyticsQuery, demandRows],
    queryFn: () => api.get<DemandCell[]>(`/analytics/demand?${analyticsQuery}&rows=${demandRows}&by=dow`),
    enabled: Boolean(canAnalytics && analyticsQuery), refetchInterval: 60_000,
  });
  const targets = useQuery({
    queryKey: ['ops-targets', businessId],
    queryFn: () => api.get<BusinessTargets>(`/targets?business_id=${businessId}`),
    enabled: Boolean(canAnalytics && businessId), refetchInterval: 120_000,
  });
  // A branch manager/supervisor also measures against their OWN branch target
  // (which overlays the company target). Executives stay company-scoped.
  const branchTargets = useQuery({
    queryKey: ['ops-branch-targets', branchId],
    queryFn: () => api.get<BranchTargets>(`/targets/branch?branch_id=${branchId}`),
    enabled: Boolean(branchScoped && branchId), refetchInterval: 120_000,
  });
  const employeeKpis = useQuery({
    queryKey: ['ops-executive-kpis', businessId, analysisMonthKey(summary.data || [])],
    queryFn: () => api.get<ExecutiveKpis>(`/analytics/executive-kpis?business_id=${businessId}&month=${analysisMonthKey(summary.data || [])}`),
    enabled: Boolean(admin?.role === 'executive' && businessId), refetchInterval: 60_000,
  });
  const predictions = useQuery({
    queryKey: ['ops-predictions', businessId],
    queryFn: () => api.get<PredictionRow[]>(`/predictions?business_id=${businessId}&max_age_minutes=60`),
    enabled: Boolean(canAnalytics && businessId), refetchInterval: 60_000,
  });
  const pipeline = useQuery({
    queryKey: ['ops-pipeline', businessId],
    queryFn: () => api.get<any>(`/pipeline/status?business_id=${businessId}`),
    enabled: Boolean(canAnalytics && businessId), refetchInterval: 60_000,
  });
  const balking = useQuery({
    queryKey: ['ops-balking', businessId, branchId, admin?.role, serviceId],
    queryFn: () => api.get<BalkingData>(`/analytics/balking?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && businessId), refetchInterval: 60_000,
  });
  const channels = useQuery({
    queryKey: ['ops-channels', analyticsQuery],
    queryFn: () => api.get<ChannelMix>(`/analytics/channels?${analyticsQuery}&days=90`),
    enabled: Boolean(canAnalytics && analyticsQuery), refetchInterval: 120_000,
  });
  // Live productivity signals (idle windows / slowdowns) — refreshes often; it's
  // a "do something now" board, not a trend.
  const productivity = useQuery({
    queryKey: ['ops-productivity', analyticsQuery],
    queryFn: () => api.get<ProductivitySignals>(`/analytics/productivity?${analyticsQuery}`),
    enabled: Boolean(canAnalytics && analyticsQuery), refetchInterval: 25_000,
  });

  return {
    admin, businessId, branchId,
    queues: queues.data || [],
    summary: summary.data || [],
    services: services.data || [],
    staff: staff.data || [],
    branchTrends: branchTrends.data || [],
    heatmap: heatmap.data || [],
    demandHourly: demandHourly.data || [],
    demandWeekly: demandWeekly.data || [],
    targets: targets.data || DEFAULT_TARGETS,
    branchTargets: branchTargets.data || null,
    // The target a branch-scoped screen actually measures against: the branch's
    // own target when set, otherwise the company target. Executive screens just
    // use `targets`.
    effectiveTarget: (branchScoped ? branchTargets.data : undefined) || targets.data || DEFAULT_TARGETS,
    employeeKpis: employeeKpis.data,
    predictions: predictions.data || [],
    pipeline: pipeline.data,
    balking: balking.data || null,
    channels: channels.data || null,
    productivity: productivity.data || null,
    refreshAll: () => Promise.all([queues.refetch(), summary.refetch(), services.refetch(), staff.refetch(),
      branchTrends.refetch(), heatmap.refetch(), demandHourly.refetch(), demandWeekly.refetch(),
      targets.refetch(), branchTargets.refetch(), employeeKpis.refetch(), predictions.refetch(), pipeline.refetch(), balking.refetch(), channels.refetch(), productivity.refetch()]),
  };
}

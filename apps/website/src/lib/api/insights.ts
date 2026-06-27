/**
 * insights.ts — Analytics & Predictive Insights API (MySQL backend)
 *
 * Replaces the previous stubbed implementation.
 * All data now comes from the Q ME NOW Express backend API.
 */

import api from '@/lib/apiClient';

// ── Types ─────────────────────────────────────────────────────

export type InsightType =
  | 'best_time_to_visit'
  | 'peak_hours'
  | 'service_ranking'
  | 'wait_time_prediction'
  | 'branch_performance';

export interface AnalyticsInsight {
  id: string;
  business_id: string;
  branch_id?: string;
  branch_name?: string;
  insight_type: InsightType;
  insight_data: Record<string, unknown>;
  model_version?: string;
  generated_at: string;
}

export interface HeatmapCell {
  dow: number;
  hour: number;
  visit_count: number;
  avg_wait: number;
  completed: number;
  no_shows: number;
}

export interface PeakHoursData {
  heatmap: HeatmapCell[];
  peak_day: number;
  peak_hour: number;
  off_peak_day: number;
  off_peak_hour: number;
}

export interface ServicePerformance {
  service_id: string;
  service_name: string;
  total_visits: number;
  completed: number;
  cancelled: number;
  no_shows: number;
  avg_wait_minutes: number;
  avg_service_minutes: number;
  dropoff_pct: number;
}

export interface StaffMetric {
  staff_id: string;
  full_name: string;
  staff_code: string;
  tickets_handled: number;
  avg_handle_minutes: number;
}

export interface StaffMetricsOutput {
  staff: StaffMetric[];
  top_performer?: StaffMetric;
  avg_handle_time: number;
}

export interface ClientPredictionsOutput {
  best_day: string;
  best_hour: number;
  best_month: string;
  expected_wait_minutes: number;
  description: string;
}

export interface OpsInsightsOutput {
  summary: {
    total_visitors: number;
    completed_count: number;
    cancelled_count: number;
    no_show_count: number;
    avg_wait_time_minutes: number;
  };
  service_performance: ServicePerformance[];
}

export interface AnomalyAlert {
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  detected_at: string;
}

// ── Analytics ─────────────────────────────────────────────────

export async function fetchLatestInsight(
  businessId: string,
  insightType: InsightType,
  branchId?: string
): Promise<AnalyticsInsight | null> {
  try {
    const qs = new URLSearchParams({
      business_id: businessId,
      type: insightType,
      ...(branchId ? { branch_id: branchId } : {}),
    }).toString();
    const results = await api.get<AnalyticsInsight[]>(`/predictions/public?${qs}`, false);
    return results[0] ?? null;
  } catch {
    return null;
  }
}

export async function fetchAllInsights(businessId: string): Promise<AnalyticsInsight[]> {
  try {
    return await api.get<AnalyticsInsight[]>(`/predictions?business_id=${businessId}`, false);
  } catch {
    return [];
  }
}

export async function fetchPeakHoursHeatmap(businessId: string, branchId?: string): Promise<PeakHoursData | null> {
  try {
    const qs = new URLSearchParams({
      business_id: businessId,
      ...(branchId ? { branch_id: branchId } : {}),
    }).toString();
    const cells = await api.get<HeatmapCell[]>(`/analytics/heatmap?${qs}`);
    if (!cells.length) return null;

    // Derive peak / off-peak from heatmap
    const sorted = [...cells].sort((a, b) => b.visit_count - a.visit_count);
    const peak    = sorted[0];
    const offPeak = sorted[sorted.length - 1];

    return {
      heatmap: cells,
      peak_day:      peak.dow,
      peak_hour:     peak.hour,
      off_peak_day:  offPeak.dow,
      off_peak_hour: offPeak.hour,
    };
  } catch {
    return null;
  }
}

export async function fetchOpsInsights(businessId: string, branchId?: string): Promise<OpsInsightsOutput | null> {
  try {
    const qs = new URLSearchParams({
      business_id: businessId,
      ...(branchId ? { branch_id: branchId } : {}),
    }).toString();

    const [summary, services] = await Promise.all([
      api.get<{ avg_wait_time_minutes: number; total_visitors: number; completed_count: number; cancelled_count: number; no_show_count: number }[]>(
        `/analytics/summary?${qs}`
      ),
      api.get<ServicePerformance[]>(`/analytics/services?${qs}`),
    ]);

    const totals = summary.reduce(
      (acc, row) => ({
        total_visitors:        acc.total_visitors        + (row.total_visitors || 0),
        completed_count:       acc.completed_count       + (row.completed_count || 0),
        cancelled_count:       acc.cancelled_count       + (row.cancelled_count || 0),
        no_show_count:         acc.no_show_count         + (row.no_show_count || 0),
        avg_wait_time_minutes: acc.avg_wait_time_minutes + (row.avg_wait_time_minutes || 0),
      }),
      { total_visitors: 0, completed_count: 0, cancelled_count: 0, no_show_count: 0, avg_wait_time_minutes: 0 }
    );

    if (summary.length > 0) {
      totals.avg_wait_time_minutes = Math.round(totals.avg_wait_time_minutes / summary.length);
    }

    return { summary: totals, service_performance: services };
  } catch {
    return null;
  }
}

export async function fetchStaffMetricsInsight(businessId: string, branchId?: string): Promise<StaffMetricsOutput | null> {
  try {
    const qs = new URLSearchParams({
      business_id: businessId,
      ...(branchId ? { branch_id: branchId } : {}),
    }).toString();
    const staff = await api.get<StaffMetric[]>(`/analytics/staff?${qs}`);
    if (!staff.length) return null;

    const avgHandle = staff.reduce((s, m) => s + m.avg_handle_minutes, 0) / staff.length;
    const top = [...staff].sort((a, b) => b.tickets_handled - a.tickets_handled)[0];

    return { staff, top_performer: top, avg_handle_time: Math.round(avgHandle) };
  } catch {
    return null;
  }
}

export async function fetchBestTimesToVisit(businessId: string, branchId?: string): Promise<ClientPredictionsOutput | null> {
  const insight = await fetchLatestInsight(businessId, 'best_time_to_visit', branchId);
  if (!insight) return null;
  return insight.insight_data as unknown as ClientPredictionsOutput;
}

export async function fetchAnomalies(_businessId: string): Promise<AnomalyAlert[]> {
  // Anomaly detection is generated by the Jupyter pipeline and stored as predictive_results.
  // For now return empty; the ML pipeline will populate this.
  return [];
}

export async function fetchRecommendations(businessId: string): Promise<string[]> {
  const ops = await fetchOpsInsights(businessId);
  if (!ops) return [];

  const recs: string[] = [];
  const { avg_wait_time_minutes, no_show_count, total_visitors } = ops.summary;

  if (avg_wait_time_minutes > 30) recs.push('Average wait time exceeds 30 minutes — consider adding staff during peak hours.');
  if (total_visitors > 0 && no_show_count / total_visitors > 0.1) recs.push('No-show rate is above 10% — consider sending earlier notifications.');

  const slowest = ops.service_performance.sort((a, b) => b.avg_wait_minutes - a.avg_wait_minutes)[0];
  if (slowest) recs.push(`"${slowest.service_name}" has the longest average wait (${slowest.avg_wait_minutes} min) — review staffing for this service.`);

  return recs;
}

export async function hasInsights(businessId: string): Promise<boolean> {
  const insights = await fetchAllInsights(businessId);
  return insights.length > 0;
}

export async function getInsightFreshness(businessId: string): Promise<{
  hasInsights: boolean;
  latestDate: string | null;
  ageInDays: number | null;
}> {
  const insights = await fetchAllInsights(businessId);
  if (!insights.length) return { hasInsights: false, latestDate: null, ageInDays: null };

  const latest = insights.sort((a, b) =>
    new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime()
  )[0];

  const ageInDays = Math.floor(
    (Date.now() - new Date(latest.generated_at).getTime()) / 86_400_000
  );

  return { hasInsights: true, latestDate: latest.generated_at, ageInDays };
}

// Insight-related type definitions for notebook integration

export type InsightType = 
  | 'peak_hours'
  | 'dropoff_periods'
  | 'best_times'
  | 'anomalies'
  | 'service_efficiency'
  | 'staff_metrics'
  | 'recommendations'
  | 'client_predictions'
  | 'ops_insights'
  | 'data_health';

// Database record
export interface AnalyticsInsight {
  id: string;
  organization_id: string;
  insight_type: InsightType;
  data: Record<string, unknown>;
  period_start: string;
  period_end: string;
  generated_at: string;
  notebook_version: string | null;
  expires_at: string | null;
}

// Heatmap cell for peak hours visualization
export interface HeatmapCell {
  dow: number;
  dow_name: string;
  hour: number;
  avg_traffic: number;
  level?: 'low' | 'medium' | 'high' | 'peak';
}

// Peak hours insight data
export interface PeakHoursData {
  heatmap: HeatmapCell[];
  top_slots: Array<{
    dow: number;
    dow_name: string;
    hour: number;
    avg_traffic: number;
    rank: number;
  }>;
}

// Drop-off periods
export interface DropOffPeriod {
  hour: number;
  dropoff_count: number;
  dropoff_rate: number;
}

export interface DropOffByService {
  service_id: string;
  service_name: string;
  dropoff_rate: number;
}

export interface DropOffData {
  by_hour: DropOffPeriod[];
  by_service: DropOffByService[];
  notes?: string[];
}

// Best times to visit
export interface BestTimeSlot {
  dow: number;
  dow_name: string;
  hour: number;
  score: number;
  reason: string;
}

export interface BestTimesData {
  recommended_slots: BestTimeSlot[];
}

// Anomalies
export interface AnomalyAlert {
  date: string;
  metric: string;
  value: number;
  expected: number;
  z_score: number;
  severity: 'info' | 'warning' | 'critical';
}

// Service efficiency
export interface ServiceEfficiency {
  service_id: string;
  service_name: string;
  utilization: number;
  status: 'under_resourced' | 'optimal' | 'over_resourced';
  avg_wait_time?: number;
  total_visits?: number;
}

export interface ServiceUsageData {
  ranked: Array<{
    service_id: string;
    service_name: string;
    total_visits: number;
    percentage: number;
    rank: number;
  }>;
}

// Staff performance from notebook
export interface StaffMetricData {
  staff_user_id: string;
  customers_served: {
    day: number;
    week: number;
    month: number;
  };
  avg_service_time_minutes: number;
  avg_wait_time_minutes: number;
  completion_rate: number;
  efficiency_score: number;
  rank: number;
  trend_weekly?: Array<{
    week: string;
    score: number;
  }>;
}

export interface StaffMetricsOutput {
  generated_at: string;
  period: { start: string; end: string };
  staff: StaffMetricData[];
  rankings: {
    top_performers: string[];
    needs_support: string[];
  };
}

// Client predictions
export interface ClientPrediction {
  date: string;
  dow_name: string;
  best_windows: Array<{
    start: string;
    end: string;
    expected_wait: number;
  }>;
}

export interface WeeklyPattern {
  dow: number;
  dow_name: string;
  best_hour: number;
  worst_hour: number;
  avg_traffic: number;
}

export interface ClientPredictionsOutput {
  generated_at: string;
  organization_id: string;
  best_times_this_month: ClientPrediction[];
  weekly_pattern: WeeklyPattern[];
  predicted_congestion: Array<{
    date: string;
    hourly: Array<{ hour: number; level: number }>;
  }>;
  model_info?: { mae: number; r2: number };
  recommendation: string;
}

// Combined ops insights (from Notebook 02)
export interface OpsInsightsOutput {
  generated_at: string;
  period: { start: string; end: string };
  peak_hours: PeakHoursData;
  dropoff_periods: DropOffData;
  best_times: BestTimesData;
  anomalies: AnomalyAlert[];
  service_usage: ServiceUsageData;
  resource_efficiency: ServiceEfficiency[];
  recommendations: string[];
}

// Helper functions
export function getDayName(dow: number): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dow] || '';
}

export function getHourRange(hour: number): string {
  const endHour = hour + 1;
  const formatHour = (h: number) => {
    if (h === 0 || h === 24) return '12 AM';
    if (h === 12) return '12 PM';
    if (h < 12) return `${h} AM`;
    return `${h - 12} PM`;
  };
  return `${formatHour(hour)} - ${formatHour(endHour)}`;
}

export function getHeatmapLevel(traffic: number, maxTraffic: number): 'low' | 'medium' | 'high' | 'peak' {
  const ratio = traffic / maxTraffic;
  if (ratio < 0.25) return 'low';
  if (ratio < 0.5) return 'medium';
  if (ratio < 0.75) return 'high';
  return 'peak';
}

export function getSeverityColor(severity: 'info' | 'warning' | 'critical'): string {
  switch (severity) {
    case 'info': return 'text-blue-600 bg-blue-100';
    case 'warning': return 'text-amber-600 bg-amber-100';
    case 'critical': return 'text-red-600 bg-red-100';
  }
}

export function getEfficiencyStatusColor(status: 'under_resourced' | 'optimal' | 'over_resourced'): string {
  switch (status) {
    case 'under_resourced': return 'text-red-600';
    case 'optimal': return 'text-green-600';
    case 'over_resourced': return 'text-amber-600';
  }
}

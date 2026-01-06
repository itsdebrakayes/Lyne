// Analytics-related type definitions

export interface DailyStats {
  date: string;
  totalVisitors: number;
  avgWaitTime: number;
  avgServiceTime: number;
  completedCount: number;
  cancelledCount: number;
  noShowCount: number;
  peakHour: number;
  peakHourCount: number;
}

export interface ServiceStats {
  serviceId: string;
  serviceName: string;
  serviceColor: string | null;
  totalVisitors: number;
  avgWaitTime: number;
  avgServiceTime: number;
  completionRate: number;
}

export interface HourlyDistribution {
  hour: number;
  count: number;
  avgWaitTime: number;
}

export interface TrendData {
  current: number;
  previous: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface AnalyticsSummary {
  totalVisitors: TrendData;
  avgWaitTime: TrendData;
  completionRate: TrendData;
  peakHour: { hour: number; count: number };
  noShowRate: TrendData;
  customerSatisfaction: TrendData;
  hourlyDistribution: HourlyDistribution[];
  serviceBreakdown: ServiceStats[];
  dailyTrend: DailyStats[];
}

export interface ActivityEvent {
  id: string;
  type: 'queue_join' | 'queue_call' | 'queue_complete' | 'queue_cancel' | 'queue_no_show';
  timestamp: string;
  description: string;
  customerName?: string;
  serviceName?: string;
  staffName?: string;
  ticketNumber?: string;
}

export function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up': return '↑';
    case 'down': return '↓';
    case 'stable': return '→';
  }
}

export function formatTrendPercent(percent: number): string {
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(1)}%`;
}

export function getHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

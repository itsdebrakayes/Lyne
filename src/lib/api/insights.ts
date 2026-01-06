import { supabase } from '@/integrations/supabase/client';
import type { 
  AnalyticsInsight, 
  InsightType, 
  OpsInsightsOutput,
  StaffMetricsOutput,
  ClientPredictionsOutput,
  PeakHoursData,
  AnomalyAlert
} from '@/types/insights';

// Fetch the latest insight of a specific type
export async function fetchLatestInsight(
  organizationId: string,
  insightType: InsightType
): Promise<AnalyticsInsight | null> {
  const { data, error } = await supabase
    .from('analytics_insights')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('insight_type', insightType)
    .is('expires_at', null)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.log(`No ${insightType} insight found:`, error.message);
    return null;
  }

  return data as AnalyticsInsight;
}

// Fetch all active insights for an organization
export async function fetchAllInsights(organizationId: string): Promise<AnalyticsInsight[]> {
  const { data, error } = await supabase
    .from('analytics_insights')
    .select('*')
    .eq('organization_id', organizationId)
    .is('expires_at', null)
    .order('generated_at', { ascending: false });

  if (error) {
    console.error('Error fetching insights:', error);
    return [];
  }

  return data as AnalyticsInsight[];
}

// Fetch peak hours heatmap data
export async function fetchPeakHoursHeatmap(organizationId: string): Promise<PeakHoursData | null> {
  const insight = await fetchLatestInsight(organizationId, 'peak_hours');
  if (!insight) {
    // Try ops_insights which includes peak_hours
    const opsInsight = await fetchLatestInsight(organizationId, 'ops_insights');
    if (opsInsight) {
      return (opsInsight.data as OpsInsightsOutput).peak_hours;
    }
    return null;
  }
  return insight.data as PeakHoursData;
}

// Fetch anomalies for alert display
export async function fetchAnomalies(organizationId: string): Promise<AnomalyAlert[]> {
  const insight = await fetchLatestInsight(organizationId, 'anomalies');
  if (!insight) {
    const opsInsight = await fetchLatestInsight(organizationId, 'ops_insights');
    if (opsInsight) {
      return (opsInsight.data as OpsInsightsOutput).anomalies || [];
    }
    return [];
  }
  return insight.data as AnomalyAlert[];
}

// Fetch AI recommendations
export async function fetchRecommendations(organizationId: string): Promise<string[]> {
  const insight = await fetchLatestInsight(organizationId, 'recommendations');
  if (!insight) {
    const opsInsight = await fetchLatestInsight(organizationId, 'ops_insights');
    if (opsInsight) {
      return (opsInsight.data as OpsInsightsOutput).recommendations || [];
    }
    return [];
  }
  return insight.data as string[];
}

// Fetch full ops insights
export async function fetchOpsInsights(organizationId: string): Promise<OpsInsightsOutput | null> {
  const insight = await fetchLatestInsight(organizationId, 'ops_insights');
  if (!insight) return null;
  return insight.data as OpsInsightsOutput;
}

// Fetch staff performance from staff_performance table
export async function fetchStaffPerformance(
  organizationId: string,
  dateFrom?: string,
  dateTo?: string
) {
  let query = supabase
    .from('staff_performance')
    .select('*')
    .eq('organization_id', organizationId)
    .order('efficiency_score', { ascending: false });

  if (dateFrom) {
    query = query.gte('period_date', dateFrom);
  }
  if (dateTo) {
    query = query.lte('period_date', dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching staff performance:', error);
    return [];
  }

  return data;
}

// Fetch staff metrics from notebook output
export async function fetchStaffMetricsInsight(organizationId: string): Promise<StaffMetricsOutput | null> {
  const insight = await fetchLatestInsight(organizationId, 'staff_metrics');
  if (!insight) return null;
  return insight.data as StaffMetricsOutput;
}

// Fetch best times for client-facing feature
export async function fetchBestTimesToVisit(organizationId: string): Promise<ClientPredictionsOutput | null> {
  const insight = await fetchLatestInsight(organizationId, 'client_predictions');
  if (!insight) return null;
  return insight.data as ClientPredictionsOutput;
}

// Check if insights exist for an organization
export async function hasInsights(organizationId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('analytics_insights')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .is('expires_at', null);

  if (error) {
    console.error('Error checking insights:', error);
    return false;
  }

  return (count || 0) > 0;
}

// Get insight freshness (how old is the latest insight)
export async function getInsightFreshness(organizationId: string): Promise<{
  hasInsights: boolean;
  latestDate: string | null;
  ageInDays: number | null;
}> {
  const { data, error } = await supabase
    .from('analytics_insights')
    .select('generated_at')
    .eq('organization_id', organizationId)
    .is('expires_at', null)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return { hasInsights: false, latestDate: null, ageInDays: null };
  }

  const generatedAt = new Date(data.generated_at);
  const now = new Date();
  const ageInDays = Math.floor((now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60 * 24));

  return {
    hasInsights: true,
    latestDate: data.generated_at,
    ageInDays
  };
}

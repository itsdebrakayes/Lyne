import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAnomalies } from '@/lib/api/insights';
import { useStaffRole } from '@/hooks/useStaffRole';
import { getSeverityColor } from '@/types/insights';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, TrendingUp, TrendingDown, Info } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface AnomalyAlertsProps {
  className?: string;
  maxItems?: number;
}

export function AnomalyAlerts({ className, maxItems = 5 }: AnomalyAlertsProps) {
  const { staffData } = useStaffRole();
  const organizationId = staffData?.organization_id;

  const { data: anomalies, isLoading } = useQuery({
    queryKey: ['anomalies', organizationId],
    queryFn: () => fetchAnomalies(organizationId!),
    enabled: !!organizationId,
  });

  if (isLoading) {
    return (
      <div className={className}>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  const displayAnomalies = (anomalies || []).slice(0, maxItems);

  if (displayAnomalies.length === 0) {
    return (
      <div className={`glass rounded-xl p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-foreground mb-4">Anomaly Alerts</h3>
        <div className="text-center py-6 text-muted-foreground">
          <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No anomalies detected.</p>
          <p className="text-sm mt-1">All metrics are within normal ranges.</p>
        </div>
      </div>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-4 w-4" />;
      case 'warning': return <TrendingUp className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
    }
  };

  const getMetricLabel = (metric: string): string => {
    const labels: Record<string, string> = {
      'total_arrivals': 'Total Arrivals',
      'avg_wait_time': 'Average Wait Time',
      'dropoff_rate': 'Drop-off Rate',
      'no_show_rate': 'No-Show Rate',
      'service_time': 'Service Time',
    };
    return labels[metric] || metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className={`glass rounded-xl p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-foreground mb-4">Anomaly Alerts</h3>
      
      <div className="space-y-3">
        {displayAnomalies.map((anomaly, index) => (
          <div 
            key={index}
            className={`flex items-start gap-3 p-3 rounded-lg ${getSeverityColor(anomaly.severity)}`}
          >
            <div className="mt-0.5">
              {getSeverityIcon(anomaly.severity)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">
                  {getMetricLabel(anomaly.metric)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(anomaly.date), 'MMM d')}
                </span>
              </div>
              <p className="text-sm mt-1">
                Recorded <strong>{anomaly.value.toFixed(1)}</strong> vs expected{' '}
                <strong>{anomaly.expected.toFixed(1)}</strong>
              </p>
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                {anomaly.z_score > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                <span>{Math.abs(anomaly.z_score).toFixed(1)}σ from mean</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(anomalies?.length || 0) > maxItems && (
        <p className="text-center text-sm text-muted-foreground mt-4">
          +{(anomalies?.length || 0) - maxItems} more anomalies
        </p>
      )}
    </div>
  );
}

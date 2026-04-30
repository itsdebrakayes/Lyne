import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchPeakHoursHeatmap } from '@/lib/api/insights';
import { useStaffRole } from '@/hooks/useStaffRole';
import { getDayName, getHeatmapLevel, getHourRange } from '@/types/insights';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PeakHoursHeatmapProps {
  className?: string;
}

const DAYS = [1, 2, 3, 4, 5]; // Mon-Fri for business hours
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16]; // 8 AM - 5 PM

export function PeakHoursHeatmap({ className }: PeakHoursHeatmapProps) {
  const { staffData } = useStaffRole();
  const organizationId = staffData?.organization_id;

  const { data: peakHours, isLoading } = useQuery({
    queryKey: ['peak-hours-heatmap', organizationId],
    queryFn: () => fetchPeakHoursHeatmap(organizationId!),
    enabled: !!organizationId,
  });

  if (isLoading) {
    return (
      <div className={className}>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!peakHours) {
    return (
      <div className={`glass rounded-xl p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-foreground mb-4">Peak Hours Heatmap</h3>
        <div className="text-center py-8 text-muted-foreground">
          <p>No peak hours data available yet.</p>
          <p className="text-sm mt-2">Run the analytics notebook to generate insights.</p>
        </div>
      </div>
    );
  }

  // Find max traffic for color scaling
  const maxTraffic = Math.max(...peakHours.heatmap.map(h => h.avg_traffic), 1);

  // Create a lookup map for quick access
  const heatmapLookup = new Map<string, number>();
  peakHours.heatmap.forEach(cell => {
    heatmapLookup.set(`${cell.dow}-${cell.hour}`, cell.avg_traffic);
  });

  const getTraffic = (dow: number, hour: number): number => {
    return heatmapLookup.get(`${dow}-${hour}`) || 0;
  };

  const getCellColor = (traffic: number): string => {
    const level = getHeatmapLevel(traffic, maxTraffic);
    switch (level) {
      case 'low': return 'bg-green-100 dark:bg-green-900/30';
      case 'medium': return 'bg-yellow-100 dark:bg-yellow-900/30';
      case 'high': return 'bg-orange-100 dark:bg-orange-900/30';
      case 'peak': return 'bg-red-100 dark:bg-red-900/30';
    }
  };

  return (
    <div className={`glass rounded-xl p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-foreground mb-4">Peak Hours Heatmap</h3>
      
      <TooltipProvider>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-xs text-muted-foreground pb-2 pr-2">Day</th>
                {HOURS.map(hour => (
                  <th key={hour} className="text-center text-xs text-muted-foreground pb-2 px-1">
                    {hour > 12 ? `${hour - 12}PM` : hour === 12 ? '12PM' : `${hour}AM`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(dow => (
                <tr key={dow}>
                  <td className="text-sm text-foreground pr-3 py-1">
                    {getDayName(dow).slice(0, 3)}
                  </td>
                  {HOURS.map(hour => {
                    const traffic = getTraffic(dow, hour);
                    return (
                      <td key={hour} className="p-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div 
                              className={`w-8 h-8 rounded ${getCellColor(traffic)} cursor-default transition-transform hover:scale-110`}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{getDayName(dow)} {getHourRange(hour)}</p>
                            <p className="text-sm text-muted-foreground">
                              Avg: {traffic.toFixed(1)} visitors
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-100 dark:bg-green-900/30" />
          <span>Low</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-yellow-100 dark:bg-yellow-900/30" />
          <span>Medium</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-orange-100 dark:bg-orange-900/30" />
          <span>High</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-100 dark:bg-red-900/30" />
          <span>Peak</span>
        </div>
      </div>
    </div>
  );
}

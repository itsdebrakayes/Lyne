import * as React from 'react';
import { useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, TrendingDown, CheckCircle, AlertCircle, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import api from '@/lib/apiClient';
import { useOrganization } from '@/hooks/useOrganizations';
import { cn } from '@/lib/utils';
import { useBranches } from '@/hooks/useBranches';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 9 }, (_, i) => i + 8); // 8 AM to 4 PM

interface CongestionData {
  day: number;
  hour: number;
  level: 'low' | 'moderate' | 'high';
  avgWait: number;
}

export default function BestTime() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const preSelectedBranch = searchParams.get('branch');
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(preSelectedBranch || undefined);

  // Fetch organization and branches via MySQL backend
  const { data: org, isLoading: loadingOrg } = useOrganization(slug);
  const { data: branches } = useBranches(org?.id);

  // Set default branch when branches load
  React.useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranchId) {
      const mainBranch = branches.find(b => b.is_main_branch) || branches[0];
      setSelectedBranchId(mainBranch.id);
    }
  }, [branches, selectedBranchId]);

  const selectedBranch = branches?.find(b => b.id === selectedBranchId);

  // Fetch congestion heatmap from MySQL backend
  const { data: congestionData, isLoading: loadingData } = useQuery({
    queryKey: ['best-time', org?.id, selectedBranchId],
    queryFn: async () => {
      const qs = new URLSearchParams({
        business_id: org!.id,
        ...(selectedBranchId ? { branch_id: selectedBranchId } : {}),
      }).toString();

      const cells = await api.get<{ dow: number; hour: number; visit_count: number; avg_wait: number }[]>(
        `/analytics/heatmap?${qs}`
      );

      const heatmap: CongestionData[] = [];
      for (const day of [0, 1, 2, 3, 4, 5, 6]) {
        for (const hour of HOURS) {
          const cell = cells.find(c => c.dow === day && c.hour === hour);
          const avgWait = cell ? Math.round(cell.avg_wait) : 0;
          const level = avgWait < 10 ? 'low' : avgWait < 20 ? 'moderate' : 'high';
          heatmap.push({ day, hour, level, avgWait });
        }
      }

      return { heatmap };
    },
    enabled: !!org?.id,
  });

  if (loadingOrg || loadingData) {
    return (
      <div className="min-h-screen bg-background p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!org) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">Organization Not Found</h1>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Find best times
  const bestTimes = congestionData?.heatmap
    ?.filter(d => d.level === 'low' && d.day >= 1 && d.day <= 5) // Weekdays with low congestion
    .slice(0, 3) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <Link to={`/client/${slug}`} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to {org.name}
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Branch Selector with Photo */}
        {branches && branches.length > 0 && (
          <div className="glass rounded-xl p-6">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Branch Photo */}
              {selectedBranch?.photo_url && (
                <div className="w-full md:w-64 h-48 rounded-lg overflow-hidden flex-shrink-0">
                  <img
                    src={selectedBranch.photo_url}
                    alt={selectedBranch.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">Select Branch</span>
                </div>
                
                {branches.length > 1 ? (
                  <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                    <SelectTrigger className="w-full md:w-80 bg-card border-border">
                      <SelectValue placeholder="Select a branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          <div className="flex flex-col items-start">
                            <span>{branch.name}</span>
                            <span className="text-xs text-muted-foreground">{branch.address}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-muted-foreground">{branches[0].name}</p>
                )}

                {selectedBranch && (
                  <div className="mt-4 text-sm text-muted-foreground space-y-1">
                    <p>{selectedBranch.address}</p>
                    {selectedBranch.phone && <p>📞 {selectedBranch.phone}</p>}
                    <p>🕐 {selectedBranch.opening_time?.slice(0, 5)} - {selectedBranch.closing_time?.slice(0, 5)}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">Best Time to Visit</h1>
          <p className="text-muted-foreground text-lg">
            Find the optimal time to visit {selectedBranch?.name || org.name} with shorter wait times
          </p>
        </div>

        {/* Recommendations */}
        {bestTimes.length > 0 && (
          <div className="glass rounded-xl p-6">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-status-light" />
              Recommended Times
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {bestTimes.map((time, idx) => (
                <div key={idx} className="bg-status-light/10 border border-status-light/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-status-light" />
                    <span className="font-semibold text-foreground">{DAYS[time.day]}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {time.hour > 12 ? time.hour - 12 : time.hour}:00 {time.hour >= 12 ? 'PM' : 'AM'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    ~{time.avgWait} min wait time
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Congestion Heatmap */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Weekly Congestion Map
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="p-2 text-left text-sm text-muted-foreground">Time</th>
                  {DAYS.map(day => (
                    <th key={day} className="p-2 text-center text-sm text-muted-foreground">
                      {day.slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour}>
                    <td className="p-2 text-sm font-medium text-foreground">
                      {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}
                    </td>
                    {DAYS.map((_, dayIdx) => {
                      const cell = congestionData?.heatmap?.find(
                        d => d.day === dayIdx && d.hour === hour
                      );
                      
                      return (
                        <td key={dayIdx} className="p-1">
                          <div
                            className={cn(
                              "h-10 rounded flex items-center justify-center text-xs font-medium",
                              cell?.level === 'low' && "bg-status-light/20 text-status-light",
                              cell?.level === 'moderate' && "bg-status-moderate/20 text-status-moderate",
                              cell?.level === 'high' && "bg-status-busy/20 text-status-busy",
                              !cell && "bg-muted/50"
                            )}
                          >
                            {cell?.avgWait || 0}m
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-status-light/30" />
              <span className="text-sm text-muted-foreground">Low (&lt;10 min)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-status-moderate/30" />
              <span className="text-sm text-muted-foreground">Moderate (10-20 min)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-status-busy/30" />
              <span className="text-sm text-muted-foreground">High (&gt;20 min)</span>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="glass rounded-xl p-6">
          <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            Tips for a Faster Visit
          </h2>
          <ul className="space-y-3 text-muted-foreground">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-status-light flex-shrink-0 mt-0.5" />
              <span>Visit during off-peak hours, typically mid-morning (10-11 AM) or early afternoon (2-3 PM)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-status-light flex-shrink-0 mt-0.5" />
              <span>Avoid Mondays and the first hour after opening as these tend to be busiest</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-status-light flex-shrink-0 mt-0.5" />
              <span>Have all required documents ready before arriving to speed up your service</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-5 w-5 text-status-light flex-shrink-0 mt-0.5" />
              <span>Use the virtual queue to join remotely and arrive when it's your turn</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
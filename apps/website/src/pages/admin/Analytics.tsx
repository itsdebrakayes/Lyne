import * as React from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Calendar, TrendingUp, Users, Clock, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/admin/StatCard';
import { InsightsPanel } from '@/components/admin/InsightsPanel';
import { Skeleton } from '@/components/ui/skeleton';
import { useStaffRole } from '@/hooks/useStaffRole';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

export default function Analytics() {
  const { staffData } = useStaffRole();
  const [dateRange, setDateRange] = useState('7d');
  const [exporting, setExporting] = useState(false);
  
  const organizationId = staffData?.organization_id;

  // Calculate date range
  const getDateRange = () => {
    const end = new Date();
    const start = new Date();
    
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
    }
    
    return { 
      start: start.toISOString().split('T')[0], 
      end: end.toISOString().split('T')[0] 
    };
  };

  // Fetch analytics data
  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ['analytics', organizationId, dateRange],
    queryFn: async () => {
      const { start, end } = getDateRange();
      
      // Get visit history for trends
      const { data: visits } = await supabase
        .from('visit_history')
        .select('*')
        .eq('organization_id', organizationId!)
        .gte('visit_date', start)
        .lte('visit_date', end)
        .order('visit_date', { ascending: true });

      // Aggregate by date
      const dailyStats = new Map<string, { visitors: number; waitTime: number; serviceTime: number; count: number }>();
      
      for (const visit of visits || []) {
        const date = visit.visit_date;
        const existing = dailyStats.get(date) || { visitors: 0, waitTime: 0, serviceTime: 0, count: 0 };
        existing.visitors++;
        existing.waitTime += visit.wait_time_minutes || 0;
        existing.serviceTime += visit.service_time_minutes || 0;
        existing.count++;
        dailyStats.set(date, existing);
      }

      const chartData = Array.from(dailyStats.entries()).map(([date, stats]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        visitors: stats.visitors,
        avgWait: stats.count > 0 ? Math.round(stats.waitTime / stats.count) : 0,
        avgService: stats.count > 0 ? Math.round(stats.serviceTime / stats.count) : 0,
      }));

      // Calculate totals
      const totalVisitors = visits?.length || 0;
      const avgWaitTime = visits && visits.length > 0
        ? Math.round(visits.reduce((sum, v) => sum + (v.wait_time_minutes || 0), 0) / visits.length)
        : 0;
      const avgServiceTime = visits && visits.length > 0
        ? Math.round(visits.reduce((sum, v) => sum + (v.service_time_minutes || 0), 0) / visits.length)
        : 0;

      return {
        totalVisitors,
        avgWaitTime,
        avgServiceTime,
        chartData,
      };
    },
    enabled: !!organizationId,
  });

  // Export function
  const handleExport = async () => {
    if (!organizationId) return;
    
    setExporting(true);
    try {
      const { start, end } = getDateRange();
      
      const { data, error } = await supabase.functions.invoke('export-table-data', {
        body: {
          tables: ['visits', 'queue_events', 'staff_service_log', 'services', 'counters'],
          organization_id: organizationId,
          date_from: start,
          date_to: end,
        },
      });

      if (error) throw error;

      // Download each CSV
      for (const [tableName, csvContent] of Object.entries(data.exports || {})) {
        if (typeof csvContent === 'string' && !csvContent.startsWith('Error')) {
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `${tableName}_${start}_${end}.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
        }
      }

      toast.success('Data exported successfully', {
        description: 'CSV files have been downloaded. Place them in analytics/data_exports/ to run notebooks.',
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error('Export failed', { description: error.message });
    } finally {
      setExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-2">Loading analytics data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-2">Performance insights and trends</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleExport} disabled={exporting} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Visitors"
          value={analyticsData?.totalVisitors || 0}
          icon={Users}
          iconColor="text-primary"
        />
        <StatCard
          label="Avg Wait Time"
          value={`${analyticsData?.avgWaitTime || 0}m`}
          icon={Clock}
          iconColor="text-status-moderate"
        />
        <StatCard
          label="Avg Service Time"
          value={`${analyticsData?.avgServiceTime || 0}m`}
          icon={TrendingUp}
          iconColor="text-status-light"
        />
        <StatCard
          label="Data Points"
          value={analyticsData?.chartData?.length || 0}
          icon={BarChart3}
          iconColor="text-secondary"
        />
      </div>

      {/* Charts */}
      {analyticsData?.chartData && analyticsData.chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Visitors Chart */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Daily Visitors</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Bar dataKey="visitors" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Wait Time Trend */}
          <div className="glass rounded-xl p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Wait Time Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analyticsData.chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="avgWait" 
                  name="Avg Wait (min)"
                  stroke="hsl(var(--status-moderate))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="avgService" 
                  name="Avg Service (min)"
                  stroke="hsl(var(--status-light))" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Insights Panel */}
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-4">AI-Powered Insights</h2>
        <InsightsPanel />
      </div>
    </div>
  );
}
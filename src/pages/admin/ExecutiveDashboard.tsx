import * as React from 'react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, Clock, TrendingUp, Activity, Calendar, 
  AlertTriangle, CheckCircle, XCircle, BarChart3 
} from 'lucide-react';
import { format } from 'date-fns';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import { StatCard } from '@/components/admin/StatCard';
import { ActivityFeed } from '@/components/admin/ActivityFeed';
import { ExportButton, downloadCSV } from '@/components/admin/ExportButton';
import { useStaffRole } from '@/hooks/useStaffRole';
import { fetchAnalyticsSummary, fetchRecentActivity } from '@/lib/api/analytics';
import { exportVisitHistoryCSV } from '@/lib/api/customers';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { getHourLabel } from '@/types/analytics';

const ExecutiveDashboard = () => {
  const { staffData } = useStaffRole();
  const [userName, setUserName] = useState('Executive');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const [exporting, setExporting] = useState(false);

  const organizationId = staffData?.organization_id;
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  // Get user name
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserName(user.email.split('@')[0]);
      }
    };
    fetchUser();
  }, []);

  // Fetch analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['analytics', organizationId, dateRange],
    queryFn: () => fetchAnalyticsSummary(organizationId!, dateRange),
    enabled: !!organizationId,
    refetchInterval: 60000
  });

  // Fetch recent activity
  const { data: recentActivity = [] } = useQuery({
    queryKey: ['recentActivity', organizationId],
    queryFn: () => fetchRecentActivity(organizationId!, 20),
    enabled: !!organizationId,
    refetchInterval: 30000
  });

  const handleExport = async () => {
    if (!organizationId) return;
    setExporting(true);
    try {
      const csv = await exportVisitHistoryCSV(organizationId);
      downloadCSV(csv, `visit-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setExporting(false);
    }
  };

  // Chart colors
  const COLORS = ['hsl(215, 85%, 55%)', 'hsl(180, 75%, 50%)', 'hsl(270, 70%, 60%)', 'hsl(38, 92%, 58%)', 'hsl(145, 65%, 52%)'];

  // Prepare hourly data for chart
  const hourlyChartData = (analytics?.hourlyDistribution || [])
    .filter(h => h.hour >= 8 && h.hour <= 18)
    .map(h => ({
      hour: getHourLabel(h.hour),
      visitors: h.count,
      avgWait: h.avgWaitTime
    }));

  // Prepare service data for pie chart
  const serviceChartData = (analytics?.serviceBreakdown || []).map(s => ({
    name: s.serviceName,
    value: s.totalVisitors,
    color: s.serviceColor || COLORS[0]
  }));

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {userName}
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Calendar className="w-4 h-4" />
            {currentDate}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Buttons */}
          <div className="flex gap-1 bg-muted rounded-lg p-1">
            {(['today', 'week', 'month'] as const).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={dateRange === range ? 'default' : 'ghost'}
                onClick={() => setDateRange(range)}
                className="capitalize"
              >
                {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
              </Button>
            ))}
          </div>

          <ExportButton onExport={handleExport} loading={exporting} />
        </div>
      </div>

      {/* Stats Cards - 2 Rows */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Visitors"
          value={analytics?.totalVisitors.current || 0}
          icon={Users}
          iconColor="text-primary"
          trend={analytics?.totalVisitors ? {
            value: analytics.totalVisitors.changePercent,
            label: 'from previous period',
            isPositive: analytics.totalVisitors.changePercent > 0
          } : undefined}
        />
        <StatCard
          label="Avg Wait Time"
          value={`${analytics?.avgWaitTime.current || 0} min`}
          icon={Clock}
          iconColor="text-status-moderate"
          trend={analytics?.avgWaitTime ? {
            value: analytics.avgWaitTime.changePercent,
            label: 'from previous period',
            isPositive: analytics.avgWaitTime.changePercent < 0
          } : undefined}
        />
        <StatCard
          label="Completion Rate"
          value={`${analytics?.completionRate.current || 0}%`}
          icon={CheckCircle}
          iconColor="text-status-light"
          trend={analytics?.completionRate ? {
            value: analytics.completionRate.changePercent,
            label: 'from previous period',
            isPositive: analytics.completionRate.changePercent > 0
          } : undefined}
        />
        <StatCard
          label="Peak Hour"
          value={analytics?.peakHour ? getHourLabel(analytics.peakHour.hour) : '-'}
          icon={Activity}
          iconColor="text-accent"
        />
        <StatCard
          label="No-Show Rate"
          value={`${analytics?.noShowRate.current || 0}%`}
          icon={XCircle}
          iconColor="text-status-busy"
          trend={analytics?.noShowRate ? {
            value: analytics.noShowRate.changePercent,
            label: 'from previous period',
            isPositive: analytics.noShowRate.changePercent < 0
          } : undefined}
        />
        <StatCard
          label="Customer Satisfaction"
          value={`${analytics?.customerSatisfaction.current || 0}%`}
          icon={TrendingUp}
          iconColor="text-secondary"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Distribution Chart */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Visitor Traffic by Hour</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
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
        </div>

        {/* Service Distribution Pie Chart */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Visitors by Service</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={serviceChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {serviceChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Wait Time by Service */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Avg Wait Time by Service</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics?.serviceBreakdown || []}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="serviceName" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={100} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number) => [`${value} min`, 'Avg Wait']}
                />
                <Bar dataKey="avgWaitTime" fill="hsl(var(--status-moderate))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Recent Activity</h3>
          <ActivityFeed events={recentActivity} maxHeight="240px" />
        </div>
      </div>
    </div>
  );
};

export default ExecutiveDashboard;

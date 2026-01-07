import * as React from 'react';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, Clock, TrendingUp, Activity, Calendar, 
  CheckCircle, XCircle, BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { format } from 'date-fns';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

import { TrendStatCard } from '@/components/admin/TrendStatCard';
import { ModernAreaChart } from '@/components/admin/ModernAreaChart';
import { ModernDonutChart } from '@/components/admin/ModernDonutChart';
import { AIInsightsPanel } from '@/components/admin/AIInsightsPanel';
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
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('week');
  const [exporting, setExporting] = useState(false);

  const organizationId = staffData?.organization_id;
  const organizationName = staffData?.organizations?.name || 'Your Organization';
  const currentDate = format(new Date(), 'EEEE, MMMM d, yyyy');

  // Get user name
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const emailName = user.email.split('@')[0];
        // Capitalize first letter
        setUserName(emailName.charAt(0).toUpperCase() + emailName.slice(1));
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

  // Prepare hourly data for area chart
  const hourlyChartData = (analytics?.hourlyDistribution || [])
    .filter(h => h.hour >= 8 && h.hour <= 17)
    .map(h => ({
      name: getHourLabel(h.hour),
      Visitors: h.count,
      'Wait Time': h.avgWaitTime
    }));

  // If no data, generate mock
  const mockHourlyData = [
    { name: '8AM', Visitors: 12, 'Wait Time': 8 },
    { name: '9AM', Visitors: 25, 'Wait Time': 12 },
    { name: '10AM', Visitors: 45, 'Wait Time': 22 },
    { name: '11AM', Visitors: 62, 'Wait Time': 35 },
    { name: '12PM', Visitors: 58, 'Wait Time': 32 },
    { name: '1PM', Visitors: 48, 'Wait Time': 25 },
    { name: '2PM', Visitors: 35, 'Wait Time': 18 },
    { name: '3PM', Visitors: 28, 'Wait Time': 14 },
    { name: '4PM', Visitors: 18, 'Wait Time': 10 },
    { name: '5PM', Visitors: 8, 'Wait Time': 6 },
  ];

  const chartData = hourlyChartData.length > 0 ? hourlyChartData : mockHourlyData;

  // Prepare service data for donut chart
  const serviceChartData = (analytics?.serviceBreakdown || []).map(s => ({
    name: s.serviceName,
    value: s.totalVisitors
  }));

  // Mock service data if empty
  const mockServiceData = [
    { name: 'Cashier', value: 142 },
    { name: 'TRN Services', value: 98 },
    { name: 'Property Titles', value: 76 },
    { name: 'Motor Vehicle', value: 65 },
    { name: 'Compliance', value: 45 },
  ];

  const donutData = serviceChartData.length > 0 ? serviceChartData : mockServiceData;
  const totalVisitors = donutData.reduce((sum, d) => sum + d.value, 0);

  // Trend data for sparklines
  const visitorTrend = [12, 18, 25, 22, 35, 42, 38];
  const waitTimeTrend = [15, 18, 22, 25, 20, 18, 16];
  const completionTrend = [85, 82, 88, 90, 87, 92, 94];

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {userName}! 👋
          </h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <Calendar className="w-4 h-4" />
            {currentDate} • {organizationName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Date Range Buttons */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            {(['today', 'week', 'month'] as const).map((range) => (
              <Button
                key={range}
                size="sm"
                variant={dateRange === range ? 'default' : 'ghost'}
                onClick={() => setDateRange(range)}
                className="capitalize"
              >
                {range === 'today' ? 'Today' : range === 'week' ? 'Week' : 'Month'}
              </Button>
            ))}
          </div>

          <ExportButton onExport={handleExport} loading={exporting} />
        </div>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <TrendStatCard
          label="Total Visitors"
          value={analytics?.totalVisitors.current || 247}
          change={analytics?.totalVisitors.changePercent || 12.5}
          trendLine={visitorTrend}
          icon={<Users className="w-5 h-5" />}
        />
        <TrendStatCard
          label="Avg Wait Time"
          value={`${analytics?.avgWaitTime.current || 18} min`}
          change={analytics?.avgWaitTime.changePercent || -8.2}
          trendLine={waitTimeTrend}
          lowerIsBetter
          icon={<Clock className="w-5 h-5" />}
        />
        <TrendStatCard
          label="Completion Rate"
          value={`${analytics?.completionRate.current || 94}%`}
          change={analytics?.completionRate.changePercent || 5.3}
          trendLine={completionTrend}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <TrendStatCard
          label="No-Show Rate"
          value={`${analytics?.noShowRate.current || 4.2}%`}
          change={analytics?.noShowRate.changePercent || -15.0}
          lowerIsBetter
          icon={<XCircle className="w-5 h-5" />}
        />
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visitor Traffic Area Chart - Takes 2 columns */}
        <div className="lg:col-span-2">
          <ModernAreaChart
            data={chartData}
            dataKeys={[
              { key: 'Visitors', name: 'Visitors', color: 'hsl(215, 85%, 55%)', gradientId: 'visitorsGradient' },
              { key: 'Wait Time', name: 'Wait Time (min)', color: 'hsl(180, 75%, 50%)', gradientId: 'waitGradient' }
            ]}
            title="Visitor Traffic & Wait Times"
            subtitle="Hourly distribution throughout the day"
            height={300}
          />
        </div>

        {/* Service Distribution Donut */}
        <ModernDonutChart
          data={donutData}
          title="Traffic by Service"
          subtitle="Distribution of visitors"
          centerValue={totalVisitors}
          centerLabel="Total"
          height={300}
        />
      </div>

      {/* Second Row - AI Insights and Service Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights Panel */}
        <AIInsightsPanel organizationName={organizationName} />

        {/* Wait Time by Service - Horizontal Bar */}
        <div className="glass rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Wait Time by Service</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics?.serviceBreakdown || [
                  { serviceName: 'TRN Services', avgWaitTime: 28 },
                  { serviceName: 'Property Titles', avgWaitTime: 22 },
                  { serviceName: 'Motor Vehicle', avgWaitTime: 18 },
                  { serviceName: 'Cashier', avgWaitTime: 12 },
                  { serviceName: 'Compliance', avgWaitTime: 15 },
                ]}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis 
                  dataKey="serviceName" 
                  type="category" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12} 
                  width={100}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px'
                  }}
                  formatter={(value: number) => [`${value} min`, 'Avg Wait']}
                />
                <Bar 
                  dataKey="avgWaitTime" 
                  fill="hsl(var(--status-moderate))" 
                  radius={[0, 6, 6, 0]}
                  background={{ fill: 'hsl(var(--muted))', radius: 6 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="glass rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4 text-foreground">Recent Activity</h3>
        <ActivityFeed events={recentActivity} maxHeight="300px" />
      </div>
    </div>
  );
};

export default ExecutiveDashboard;

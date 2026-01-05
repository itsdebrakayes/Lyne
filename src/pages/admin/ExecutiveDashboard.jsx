import React, { useState } from 'react';
import { 
  Clock, Users, TrendingUp, Calendar, Download, Filter,
  Activity, FileText, ChevronRight
} from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ExportModal } from '@/components/ExportModal';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from 'recharts';

// Mock data
const weeklyData = [
  { day: 'Mon', visitors: 120, avgWait: 15 },
  { day: 'Tue', visitors: 145, avgWait: 18 },
  { day: 'Wed', visitors: 132, avgWait: 14 },
  { day: 'Thu', visitors: 167, avgWait: 22 },
  { day: 'Fri', visitors: 189, avgWait: 25 },
  { day: 'Sat', visitors: 98, avgWait: 12 },
  { day: 'Sun', visitors: 45, avgWait: 8 },
];

const peakHoursData = [
  { hour: '8am', count: 12 },
  { hour: '9am', count: 25 },
  { hour: '10am', count: 45 },
  { hour: '11am', count: 38 },
  { hour: '12pm', count: 22 },
  { hour: '1pm', count: 18 },
  { hour: '2pm', count: 35 },
  { hour: '3pm', count: 42 },
  { hour: '4pm', count: 28 },
  { hour: '5pm', count: 15 },
];

const recentActivity = [
  { id: '1', action: 'Customer served', service: 'Documents', time: '2 min ago', status: 'complete' },
  { id: '2', action: 'New customer joined', service: 'Payments', time: '5 min ago', status: 'new' },
  { id: '3', action: 'Counter opened', service: 'Enquiries', time: '10 min ago', status: 'info' },
  { id: '4', action: 'Customer left queue', service: 'Documents', time: '15 min ago', status: 'warning' },
];

const recentExports = [
  { id: '1', name: 'queue_report_jan.csv', size: '2.4 MB', date: 'Jan 5, 2026' },
  { id: '2', name: 'analytics_dec.xlsx', size: '4.1 MB', date: 'Dec 31, 2025' },
  { id: '3', name: 'customer_data.json', size: '1.8 MB', date: 'Dec 28, 2025' },
];

const ExecutiveDashboard = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [showExport, setShowExport] = useState(false);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const stats = [
    { label: 'Total Visitors Today', value: '234', change: '+12%', icon: Users },
    { label: 'Avg Wait Time', value: '16 min', change: '-8%', icon: Clock },
    { label: 'Completion Rate', value: '94%', change: '+3%', icon: TrendingUp },
    { label: 'Active Services', value: '6', change: '0', icon: Activity },
  ];

  const getActivityBadge = (status) => {
    switch (status) {
      case 'complete':
        return <Badge className="bg-status-light/20 text-status-light border-0">Complete</Badge>;
      case 'new':
        return <Badge className="bg-primary/20 text-primary border-0">New</Badge>;
      case 'warning':
        return <Badge className="bg-status-moderate/20 text-status-moderate border-0">Left</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, Executive</h1>
          <p className="text-muted-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            {currentDate}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => setShowExport(true)} className="gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <GlassCard key={stat.label} className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold mt-1">{stat.value}</p>
                <p className={`text-sm mt-1 ${
                  stat.change.startsWith('+') ? 'text-status-light' :
                  stat.change.startsWith('-') ? 'text-status-busy' :
                  'text-muted-foreground'
                }`}>
                  {stat.change} from yesterday
                </p>
              </div>
              <div className="p-3 rounded-xl bg-primary/10">
                <stat.icon className="w-6 h-6 text-primary" />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly Visitors Chart */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold mb-4">Weekly Visitors</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="visitors" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </GlassCard>

          {/* Peak Hours Chart */}
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold mb-4">Peak Hours Today</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={peakHoursData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </div>

        {/* Right Column - Activity & Files */}
        <div className="space-y-6">
          {/* Recent Activity */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Activity</h3>
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.service} • {activity.time}
                    </p>
                  </div>
                  {getActivityBadge(activity.status)}
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Recent Exports */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Recent Exports</h3>
              <Button variant="ghost" size="sm">
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="space-y-3">
              {recentExports.map((file) => (
                <div key={file.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.size} • {file.date}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        open={showExport}
        onOpenChange={setShowExport}
        format="csv"
        filename={`executive_report_${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
};

export default ExecutiveDashboard;

import * as React from 'react';
import { GlassCard } from '@/components/GlassCard';
import { Clock, Users, TrendingUp, Activity, Calendar } from 'lucide-react';

const ExecutiveDashboard = () => {
  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const stats = [
    { label: 'Total Visitors Today', value: '234', change: '+12%', icon: Users },
    { label: 'Avg Wait Time', value: '16 min', change: '-8%', icon: Clock },
    { label: 'Completion Rate', value: '94%', change: '+3%', icon: TrendingUp },
    { label: 'Active Services', value: '6', change: '0', icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Welcome back, Executive</h1><p className="text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4" />{currentDate}</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <GlassCard key={stat.label} className="p-6">
            <div className="flex items-start justify-between">
              <div><p className="text-sm text-muted-foreground">{stat.label}</p><p className="text-3xl font-bold mt-1">{stat.value}</p><p className={`text-sm mt-1 ${stat.change.startsWith('+') ? 'text-status-light' : stat.change.startsWith('-') ? 'text-status-busy' : 'text-muted-foreground'}`}>{stat.change} from yesterday</p></div>
              <div className="p-3 rounded-xl bg-primary/10"><stat.icon className="w-6 h-6 text-primary" /></div>
            </div>
          </GlassCard>
        ))}
      </div>
      <GlassCard className="p-6"><p className="text-muted-foreground text-center">Charts and analytics coming soon...</p></GlassCard>
    </div>
  );
};

export default ExecutiveDashboard;

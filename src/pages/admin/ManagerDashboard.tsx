import * as React from 'react';
import { GlassCard } from '@/components/GlassCard';
import { Clock, Users, Monitor, Grid3X3 } from 'lucide-react';

const ManagerDashboard = () => {
  const stats = [
    { label: 'Total in Queue', value: '47', icon: Users, color: 'text-primary' },
    { label: 'Avg Wait Time', value: '18 min', icon: Clock, color: 'text-secondary' },
    { label: 'Active Counters', value: '8', icon: Monitor, color: 'text-accent' },
    { label: 'Services Active', value: '5', icon: Grid3X3, color: 'text-tertiary' },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Manager Dashboard</h1><p className="text-muted-foreground">Overview of all services and queues</p></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <GlassCard key={stat.label} className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-muted"><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
              <div><p className="text-2xl font-bold">{stat.value}</p><p className="text-sm text-muted-foreground">{stat.label}</p></div>
            </div>
          </GlassCard>
        ))}
      </div>
      <GlassCard className="p-6"><p className="text-muted-foreground text-center">Queue management table coming soon...</p></GlassCard>
    </div>
  );
};

export default ManagerDashboard;

import * as React from 'react';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Clock, Users, Timer } from 'lucide-react';
import { useStaffRole } from '@/hooks/useStaffRole';

const mockQueueData = [
  { id: '1', name: 'John Smith', ticketNumber: 'A-001', waitTime: '12 min', avatar: 'JS' },
  { id: '2', name: 'Sarah Johnson', ticketNumber: 'A-002', waitTime: '8 min', avatar: 'SJ' },
  { id: '3', name: 'Michael Brown', ticketNumber: 'A-003', waitTime: '5 min', avatar: 'MB' },
  { id: '4', name: 'Emily Davis', ticketNumber: 'A-004', waitTime: '3 min', avatar: 'ED' },
];

const StaffDashboard = () => {
  const { staffData } = useStaffRole();
  const staffName = (staffData as { organizations?: { name: string } })?.organizations?.name || 'Staff Member';
  const stats = [
    { label: 'People in Queue', value: '12', icon: Users, color: 'bg-primary' },
    { label: 'Avg Wait Time', value: '15 min', icon: Clock, color: 'bg-secondary' },
    { label: 'My Service Time', value: '2h 30m', icon: Timer, color: 'bg-accent' },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Hi, {staffName}!</h1><p className="text-muted-foreground">Documents Queue</p></div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <GlassCard key={stat.label} className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.color}/20`}><stat.icon className="w-6 h-6 text-primary" /></div>
              <div><p className="text-2xl font-bold">{stat.value}</p><p className="text-sm text-muted-foreground">{stat.label}</p></div>
            </div>
          </GlassCard>
        ))}
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Queue</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockQueueData.map((customer) => (
            <GlassCard key={customer.id} className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <Avatar><AvatarFallback className="bg-primary/20 text-primary">{customer.avatar}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{customer.name}</p><p className="text-sm text-muted-foreground">{customer.ticketNumber}</p></div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">Waiting: {customer.waitTime}</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1">Call</Button>
                <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10">Remove</Button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;

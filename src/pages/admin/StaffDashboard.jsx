import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Users, Timer } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useStaffRole } from '@/hooks/useStaffRole';

// Mock data for staff dashboard
const mockQueueData = [
  { id: '1', name: 'John Smith', ticketNumber: 'A-001', waitTime: '12 min', avatar: 'JS' },
  { id: '2', name: 'Sarah Johnson', ticketNumber: 'A-002', waitTime: '8 min', avatar: 'SJ' },
  { id: '3', name: 'Michael Brown', ticketNumber: 'A-003', waitTime: '5 min', avatar: 'MB' },
  { id: '4', name: 'Emily Davis', ticketNumber: 'A-004', waitTime: '3 min', avatar: 'ED' },
];

const StaffDashboard = () => {
  const navigate = useNavigate();
  const { staffData } = useStaffRole();
  const staffName = staffData?.organizations?.name || 'Staff Member';

  const stats = [
    { label: 'People in Queue', value: '12', icon: Users, color: 'bg-primary' },
    { label: 'Avg Wait Time', value: '15 min', icon: Clock, color: 'bg-secondary' },
    { label: 'My Service Time', value: '2h 30m', icon: Timer, color: 'bg-accent' },
  ];

  const handleCallToCounter = (customerId) => {
    console.log('Calling customer:', customerId);
  };

  const handleRemove = (customerId) => {
    console.log('Removing customer:', customerId);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Hi, {staffName}!</h1>
        <p className="text-muted-foreground">Documents Queue</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <GlassCard key={stat.label} className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${stat.color}/20`}>
                <stat.icon className={`w-6 h-6 text-primary`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Queue List */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Your Queue</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {mockQueueData.map((customer) => (
            <GlassCard key={customer.id} className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <Avatar>
                  <AvatarFallback className="bg-primary/20 text-primary">
                    {customer.avatar}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{customer.name}</p>
                  <p className="text-sm text-muted-foreground">{customer.ticketNumber}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Waiting: {customer.waitTime}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => handleCallToCounter(customer.id)}
                  className="flex-1"
                >
                  Call
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRemove(customer.id)}
                  className="text-destructive hover:bg-destructive/10"
                >
                  Remove
                </Button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;

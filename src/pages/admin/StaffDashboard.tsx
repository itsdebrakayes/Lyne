import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, Clock, Timer, Monitor } from 'lucide-react';
import { toast } from 'sonner';

import { StatCard } from '@/components/admin/StatCard';
import { QueueCard } from '@/components/admin/QueueCard';
import { useStaffRole } from '@/hooks/useStaffRole';
import { useAdminQueueRealtime } from '@/hooks/useAdminQueueRealtime';
import { fetchMyQueue, callCustomer, completeService, cancelCustomer, moveCustomerUp, moveCustomerDown } from '@/lib/api/queue';
import { fetchMyCounterAssignment } from '@/lib/api/staff';
import { fetchServiceById } from '@/lib/api/services';
import { supabase } from '@/integrations/supabase/client';
import type { QueueEntry } from '@/types/queue';

const StaffDashboard = () => {
  const { staffData } = useStaffRole();
  const [userName, setUserName] = useState('Staff');

  // Get user name from auth
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserName(user.email.split('@')[0]);
      }
    };
    fetchUser();
  }, []);

  const organizationId = staffData?.organization_id;
  const assignedServiceId = staffData?.assigned_service_id;
  const branchId = staffData?.branch_id;

  // Real-time updates (filtered by branch)
  useAdminQueueRealtime({
    organizationId,
    branchId: branchId || undefined,
    showNotifications: true
  });

  // Fetch counter assignment
  const { data: counterAssignment } = useQuery({
    queryKey: ['counterAssignment', staffData?.user_id],
    queryFn: () => fetchMyCounterAssignment(staffData!.user_id),
    enabled: !!staffData?.user_id
  });

  // Fetch assigned service info
  const { data: serviceInfo } = useQuery({
    queryKey: ['service', assignedServiceId],
    queryFn: () => fetchServiceById(assignedServiceId!),
    enabled: !!assignedServiceId
  });

  // Fetch queue entries for assigned service and branch
  const { data: queueEntries = [], refetch: refetchQueue } = useQuery({
    queryKey: ['queueEntries', organizationId, assignedServiceId, branchId],
    queryFn: () => fetchMyQueue(organizationId!, staffData!.user_id, assignedServiceId!, branchId || undefined),
    enabled: !!organizationId && !!assignedServiceId,
    refetchInterval: 30000
  });

  // Calculate stats
  const stats = useMemo(() => {
    const waitingEntries = queueEntries.filter(e => e.status === 'waiting');
    const now = new Date();
    
    let avgWaitTime = 0;
    if (waitingEntries.length > 0) {
      const totalWait = waitingEntries.reduce((sum, entry) => {
        if (entry.joined_at) {
          return sum + (now.getTime() - new Date(entry.joined_at).getTime()) / 60000;
        }
        return sum;
      }, 0);
      avgWaitTime = Math.round(totalWait / waitingEntries.length);
    }

    return {
      peopleInQueue: waitingEntries.length,
      avgWaitTime,
      counterNumber: counterAssignment?.counter?.counter_number || '-'
    };
  }, [queueEntries, counterAssignment]);

  // Mutations for queue actions
  const callMutation = useMutation({
    mutationFn: async (lineId: string) => {
      await callCustomer(lineId, staffData!.user_id, counterAssignment?.counter_id);
    },
    onSuccess: () => {
      toast.success('Customer called');
      refetchQueue();
    },
    onError: (error: any) => {
      toast.error('Failed to call customer', { description: error.message });
    }
  });

  const completeMutation = useMutation({
    mutationFn: async (lineId: string) => {
      await completeService(lineId);
    },
    onSuccess: () => {
      toast.success('Service completed');
      refetchQueue();
    },
    onError: (error: any) => {
      toast.error('Failed to complete service', { description: error.message });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (lineId: string) => {
      await cancelCustomer(lineId);
    },
    onSuccess: () => {
      toast.success('Customer removed from queue');
      refetchQueue();
    },
    onError: (error: any) => {
      toast.error('Failed to remove customer', { description: error.message });
    }
  });

  const moveUpMutation = useMutation({
    mutationFn: async (entry: QueueEntry) => {
      await moveCustomerUp(entry.id, organizationId!, entry.service_id);
    },
    onSuccess: () => {
      refetchQueue();
    }
  });

  const moveDownMutation = useMutation({
    mutationFn: async (entry: QueueEntry) => {
      await moveCustomerDown(entry.id, organizationId!, entry.service_id);
    },
    onSuccess: () => {
      refetchQueue();
    }
  });

  const waitingEntries = queueEntries.filter(e => e.status === 'waiting');
  const servingEntry = queueEntries.find(e => e.status === 'serving');

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome, {userName}
        </h1>
        <p className="text-muted-foreground mt-1">
          {serviceInfo?.name || 'No service assigned'} • Counter {stats.counterNumber}
          {staffData?.branches?.name && ` • ${staffData.branches.name}`}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="People in My Queue"
          value={stats.peopleInQueue}
          icon={Users}
          iconColor="text-primary"
        />
        <StatCard
          label="Avg Wait Time"
          value={`${stats.avgWaitTime} min`}
          icon={Clock}
          iconColor="text-status-moderate"
        />
        <StatCard
          label="My Counter"
          value={stats.counterNumber}
          icon={Monitor}
          iconColor="text-secondary"
        />
      </div>

      {/* Currently Serving */}
      {servingEntry && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Currently Serving</h2>
          <QueueCard
            entry={servingEntry}
            onComplete={() => completeMutation.mutate(servingEntry.id)}
            onRemove={() => cancelMutation.mutate(servingEntry.id)}
            isServing={true}
          />
        </div>
      )}

      {/* Queue */}
      <div>
        <h2 className="text-lg font-semibold mb-3 text-foreground">
          Queue ({waitingEntries.length})
        </h2>
        {waitingEntries.length === 0 ? (
          <div className="glass rounded-xl p-8 text-center">
            <p className="text-muted-foreground">No customers waiting in queue</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {waitingEntries.map((entry, index) => (
              <QueueCard
                key={entry.id}
                entry={entry}
                onCall={() => callMutation.mutate(entry.id)}
                onMoveUp={() => moveUpMutation.mutate(entry)}
                onMoveDown={() => moveDownMutation.mutate(entry)}
                onRemove={() => cancelMutation.mutate(entry.id)}
                isFirst={index === 0}
                isLast={index === waitingEntries.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;

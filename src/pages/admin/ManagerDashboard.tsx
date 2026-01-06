import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, Clock, Monitor, Grid3X3, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

import { StatCard } from '@/components/admin/StatCard';
import { QueueCard } from '@/components/admin/QueueCard';
import { FilterBar } from '@/components/admin/FilterBar';
import { useStaffRole } from '@/hooks/useStaffRole';
import { useAdminQueueRealtime } from '@/hooks/useAdminQueueRealtime';
import { fetchQueueEntries, fetchQueueStats, callCustomer, completeService, cancelCustomer } from '@/lib/api/queue';
import { fetchServicesWithStats } from '@/lib/api/services';
import { fetchCountersWithStaff } from '@/lib/api/staff';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { QueueEntry } from '@/types/queue';

const ManagerDashboard = () => {
  const { staffData } = useStaffRole();
  const [userName, setUserName] = useState('Manager');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedCounter, setSelectedCounter] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all']));

  const organizationId = staffData?.organization_id;

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

  // Real-time updates
  useAdminQueueRealtime({
    organizationId,
    showNotifications: true
  });

  // Fetch queue stats
  const { data: queueStats } = useQuery({
    queryKey: ['queueStats', organizationId],
    queryFn: () => fetchQueueStats(organizationId!),
    enabled: !!organizationId,
    refetchInterval: 30000
  });

  // Fetch all queue entries
  const { data: allQueueEntries = [], refetch: refetchQueue } = useQuery({
    queryKey: ['queueEntries', organizationId],
    queryFn: () => fetchQueueEntries(organizationId!, { status: ['waiting', 'serving'] }),
    enabled: !!organizationId,
    refetchInterval: 30000
  });

  // Fetch services with stats
  const { data: services = [] } = useQuery({
    queryKey: ['servicesWithStats', organizationId],
    queryFn: () => fetchServicesWithStats(organizationId!),
    enabled: !!organizationId
  });

  // Fetch counters
  const { data: counters = [] } = useQuery({
    queryKey: ['countersWithStaff', organizationId],
    queryFn: () => fetchCountersWithStaff(organizationId!),
    enabled: !!organizationId
  });

  // Filter entries
  const filteredEntries = useMemo(() => {
    let entries = allQueueEntries;

    if (selectedService !== 'all') {
      entries = entries.filter(e => e.service_id === selectedService);
    }

    if (selectedStatus !== 'all') {
      entries = entries.filter(e => e.status === selectedStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      entries = entries.filter(e => 
        e.client?.full_name?.toLowerCase().includes(query) ||
        e.ticket_number.toLowerCase().includes(query)
      );
    }

    return entries;
  }, [allQueueEntries, selectedService, selectedStatus, searchQuery]);

  // Group entries by service
  const entriesByService = useMemo(() => {
    const grouped: Record<string, { service: any; entries: QueueEntry[] }> = {};

    services.forEach(service => {
      grouped[service.id] = {
        service,
        entries: filteredEntries.filter(e => e.service_id === service.id)
      };
    });

    return grouped;
  }, [services, filteredEntries]);

  // Mutations
  const callMutation = useMutation({
    mutationFn: async (lineId: string) => {
      await callCustomer(lineId, staffData!.user_id);
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
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (lineId: string) => {
      await cancelCustomer(lineId);
    },
    onSuccess: () => {
      toast.success('Customer removed');
      refetchQueue();
    }
  });

  const toggleSection = (serviceId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(serviceId)) {
      newExpanded.delete(serviceId);
    } else {
      newExpanded.add(serviceId);
    }
    setExpandedSections(newExpanded);
  };

  const serviceOptions = services.map(s => ({ value: s.id, label: s.name }));
  const counterOptions = counters.map(c => ({ 
    value: c.id, 
    label: `Counter ${c.counter_number}` 
  }));

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome, {userName}
        </h1>
        <p className="text-muted-foreground mt-1">
          {staffData?.organizations?.name || 'Organization'} • Manager Dashboard
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total in Queue"
          value={queueStats?.totalInQueue || 0}
          icon={Users}
          iconColor="text-primary"
        />
        <StatCard
          label="Avg Wait Time"
          value={`${queueStats?.avgWaitTime || 0} min`}
          icon={Clock}
          iconColor="text-status-moderate"
        />
        <StatCard
          label="Active Counters"
          value={queueStats?.activeCounters || 0}
          icon={Monitor}
          iconColor="text-secondary"
        />
        <StatCard
          label="Services Active"
          value={queueStats?.servicesActive || 0}
          icon={Grid3X3}
          iconColor="text-accent"
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        services={serviceOptions}
        counters={counterOptions}
        selectedService={selectedService}
        selectedCounter={selectedCounter}
        selectedStatus={selectedStatus}
        searchQuery={searchQuery}
        onServiceChange={setSelectedService}
        onCounterChange={setSelectedCounter}
        onStatusChange={setSelectedStatus}
        onSearchChange={setSearchQuery}
      />

      {/* Queue Sections by Service */}
      <div className="space-y-4">
        {Object.entries(entriesByService).map(([serviceId, { service, entries }]) => {
          if (selectedService !== 'all' && selectedService !== serviceId) return null;
          
          const isExpanded = expandedSections.has(serviceId) || expandedSections.has('all');
          const waitingCount = entries.filter(e => e.status === 'waiting').length;
          const servingCount = entries.filter(e => e.status === 'serving').length;

          return (
            <Collapsible
              key={serviceId}
              open={isExpanded}
              onOpenChange={() => toggleSection(serviceId)}
            >
              <div className="glass rounded-xl overflow-hidden">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: service.color || 'hsl(var(--primary))' }}
                      />
                      <span className="font-semibold text-foreground">{service.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {waitingCount} waiting • {servingCount} serving
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    )}
                  </Button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="p-4 pt-0 border-t border-border">
                    {entries.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">
                        No customers in this queue
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {entries.map((entry, index) => (
                          <QueueCard
                            key={entry.id}
                            entry={entry}
                            onCall={() => callMutation.mutate(entry.id)}
                            onComplete={() => completeMutation.mutate(entry.id)}
                            onRemove={() => cancelMutation.mutate(entry.id)}
                            isFirst={index === 0}
                            isLast={index === entries.length - 1}
                            isServing={entry.status === 'serving'}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
};

export default ManagerDashboard;

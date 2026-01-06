import * as React from 'react';
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { QueueCard } from '@/components/admin/QueueCard';
import { FilterBar } from '@/components/admin/FilterBar';
import { useStaffRole } from '@/hooks/useStaffRole';
import { useAdminQueueRealtime } from '@/hooks/useAdminQueueRealtime';
import { fetchQueueEntries, callCustomer, completeService, cancelCustomer } from '@/lib/api/queue';
import { fetchServices } from '@/lib/api/services';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Services() {
  const { staffData } = useStaffRole();
  const [selectedService, setSelectedService] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const organizationId = staffData?.organization_id;

  useAdminQueueRealtime({ organizationId, showNotifications: true });

  const { data: services = [] } = useQuery({
    queryKey: ['services', organizationId],
    queryFn: () => fetchServices(organizationId!),
    enabled: !!organizationId
  });

  const { data: allEntries = [], refetch } = useQuery({
    queryKey: ['allQueueEntries', organizationId],
    queryFn: () => fetchQueueEntries(organizationId!),
    enabled: !!organizationId,
    refetchInterval: 30000
  });

  const filteredEntries = useMemo(() => {
    let entries = allEntries;
    if (selectedService !== 'all') entries = entries.filter(e => e.service_id === selectedService);
    if (selectedStatus !== 'all') entries = entries.filter(e => e.status === selectedStatus);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      entries = entries.filter(e => e.client?.full_name?.toLowerCase().includes(q) || e.ticket_number.toLowerCase().includes(q));
    }
    return entries;
  }, [allEntries, selectedService, selectedStatus, searchQuery]);

  const callMutation = useMutation({
    mutationFn: (lineId: string) => callCustomer(lineId, staffData!.user_id),
    onSuccess: () => { toast.success('Customer called'); refetch(); }
  });

  const completeMutation = useMutation({
    mutationFn: (lineId: string) => completeService(lineId),
    onSuccess: () => { toast.success('Service completed'); refetch(); }
  });

  const cancelMutation = useMutation({
    mutationFn: (lineId: string) => cancelCustomer(lineId),
    onSuccess: () => { toast.success('Customer removed'); refetch(); }
  });

  const serviceOptions = services.map(s => ({ value: s.id, label: s.name }));
  const statusCounts = {
    all: allEntries.length,
    waiting: allEntries.filter(e => e.status === 'waiting').length,
    serving: allEntries.filter(e => e.status === 'serving').length,
    completed: allEntries.filter(e => e.status === 'completed').length,
    cancelled: allEntries.filter(e => e.status === 'cancelled').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold text-foreground">Services</h1>
        <p className="text-muted-foreground mt-2">Manage queue services and customers</p>
      </div>

      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList>
          <TabsTrigger value="all">All ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="waiting">Waiting ({statusCounts.waiting})</TabsTrigger>
          <TabsTrigger value="serving">Serving ({statusCounts.serving})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({statusCounts.completed})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({statusCounts.cancelled})</TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar
        services={serviceOptions}
        selectedService={selectedService}
        selectedStatus={selectedStatus}
        searchQuery={searchQuery}
        onServiceChange={setSelectedService}
        onStatusChange={setSelectedStatus}
        onSearchChange={setSearchQuery}
        statuses={[]}
      />

      {filteredEntries.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-muted-foreground">No customers found matching filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((entry, i) => (
            <QueueCard
              key={entry.id}
              entry={entry}
              onCall={() => callMutation.mutate(entry.id)}
              onComplete={() => completeMutation.mutate(entry.id)}
              onRemove={() => cancelMutation.mutate(entry.id)}
              isFirst={i === 0}
              isLast={i === filteredEntries.length - 1}
              isServing={entry.status === 'serving'}
              showActions={entry.status === 'waiting' || entry.status === 'serving'}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import * as React from 'react';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UseAdminQueueRealtimeOptions {
  organizationId: string | undefined;
  branchId?: string;
  onQueueChange?: () => void;
  showNotifications?: boolean;
}

export function useAdminQueueRealtime({
  organizationId,
  branchId,
  onQueueChange,
  showNotifications = true
}: UseAdminQueueRealtimeOptions) {
  const queryClient = useQueryClient();

  const handleChange = useCallback((payload: any) => {
    // Invalidate relevant queries
    queryClient.invalidateQueries({ queryKey: ['queueData', organizationId, branchId] });
    queryClient.invalidateQueries({ queryKey: ['queueLines', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['queueStats', organizationId, branchId] });
    queryClient.invalidateQueries({ queryKey: ['servicesWithStats', organizationId] });

    // Call optional callback
    onQueueChange?.();

    // Show notifications for new queue joins (only for matching branch)
    if (showNotifications && payload.eventType === 'INSERT') {
      const newEntry = payload.new;
      if (newEntry.status === 'waiting' && (!branchId || newEntry.branch_id === branchId)) {
        toast.info('New customer joined the queue', {
          description: `Ticket #${newEntry.ticket_number}`
        });
      }
    }
  }, [organizationId, branchId, queryClient, onQueueChange, showNotifications]);

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`admin-queue-${organizationId}-${branchId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lines',
          filter: `organization_id=eq.${organizationId}`
        },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, branchId, handleChange]);
}

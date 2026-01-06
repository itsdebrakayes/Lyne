import * as React from 'react';
import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface UseAdminQueueRealtimeOptions {
  organizationId: string | undefined;
  onQueueChange?: () => void;
  showNotifications?: boolean;
}

export function useAdminQueueRealtime({
  organizationId,
  onQueueChange,
  showNotifications = true
}: UseAdminQueueRealtimeOptions) {
  const queryClient = useQueryClient();

  const handleChange = useCallback((payload: any) => {
    // Invalidate relevant queries
    queryClient.invalidateQueries({ queryKey: ['queueEntries', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['queueStats', organizationId] });
    queryClient.invalidateQueries({ queryKey: ['servicesWithStats', organizationId] });

    // Call optional callback
    onQueueChange?.();

    // Show notifications for new queue joins
    if (showNotifications && payload.eventType === 'INSERT') {
      const newEntry = payload.new;
      if (newEntry.status === 'waiting') {
        toast.info('New customer joined the queue', {
          description: `Ticket #${newEntry.ticket_number}`
        });
      }
    }
  }, [organizationId, queryClient, onQueueChange, showNotifications]);

  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`admin-queue-${organizationId}`)
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
  }, [organizationId, handleChange]);
}

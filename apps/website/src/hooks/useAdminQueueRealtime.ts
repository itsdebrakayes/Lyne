/**
 * useAdminQueueRealtime.ts
 *
 * Replaces Supabase realtime subscriptions with polling against the MySQL backend.
 * Invalidates React Query caches every 10 seconds to keep dashboards live.
 */

import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseAdminQueueRealtimeOptions {
  businessId: string | undefined;
  branchId?: string;
  onQueueChange?: () => void;
  pollIntervalMs?: number;
}

export function useAdminQueueRealtime({
  businessId,
  branchId,
  onQueueChange,
  pollIntervalMs = 10_000,
}: UseAdminQueueRealtimeOptions) {
  const queryClient = useQueryClient();

  const refresh = useCallback(() => {
    if (!businessId) return;
    queryClient.invalidateQueries({ queryKey: ['queueData',        businessId, branchId] });
    queryClient.invalidateQueries({ queryKey: ['queueLines',       businessId] });
    queryClient.invalidateQueries({ queryKey: ['branchQueues',     branchId] });
    queryClient.invalidateQueries({ queryKey: ['servicesWithStats', businessId] });
    onQueueChange?.();
  }, [businessId, branchId, queryClient, onQueueChange]);

  useEffect(() => {
    if (!businessId) return;
    const timer = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(timer);
  }, [businessId, refresh, pollIntervalMs]);
}

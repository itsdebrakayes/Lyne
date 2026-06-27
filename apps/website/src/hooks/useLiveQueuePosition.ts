/**
 * useLiveQueuePosition.ts
 *
 * Polls the MySQL backend every 10 seconds to keep the user's
 * live queue position and estimated wait time up to date.
 * Replaces the previous Supabase realtime subscription.
 */

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/apiClient';
import type { QueueEntry } from '@/lib/api/queue';

export type LineData = QueueEntry & {
  branch_name?: string;
  service_name?: string;
  people_ahead?: number;
};

export const useLiveQueuePosition = (ticketId: string | undefined) => {
  const [lineData, setLineData]   = useState<LineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);

  const fetchLineData = useCallback(async () => {
    if (!ticketId) { setIsLoading(false); return; }
    try {
      setIsLoading(true);
      const data = await api.get<LineData>(`/tickets/${ticketId}`, false);
      setLineData(data);
      setError(null);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('404')) {
        setLineData(null);
        setError('Ticket not found');
      } else {
        setError('Failed to fetch queue position');
      }
    } finally {
      setIsLoading(false);
    }
  }, [ticketId]);

  const leaveQueue = useCallback(async () => {
    if (!ticketId) return false;
    try {
      await api.put(`/tickets/${ticketId}/status`, { new_status: 'cancelled' });
      setLineData(null);
      return true;
    } catch (err) {
      console.error('Error leaving queue:', err);
      setError('Failed to leave queue');
      return false;
    }
  }, [ticketId]);

  // Initial fetch
  useEffect(() => { fetchLineData(); }, [fetchLineData]);

  // Polling — every 10 seconds
  useEffect(() => {
    if (!ticketId) return;
    const timer = setInterval(fetchLineData, 10_000);
    return () => clearInterval(timer);
  }, [ticketId, fetchLineData]);

  return { lineData, isLoading, error, leaveQueue, refetch: fetchLineData };
};

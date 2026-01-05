import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueueNotifications } from './useQueueNotifications';

interface LineData {
  id: string;
  ticket_number: string;
  position: number;
  status: string;
  estimated_wait_minutes: number | null;
  service_id: string;
  organization_id: string;
  joined_at: string;
  called_at: string | null;
  services: {
    name: string;
    icon: string | null;
    color: string | null;
    base_avg_time_minutes: number | null;
  } | null;
}

export const useLiveQueuePosition = (lineId: string | undefined) => {
  const [lineData, setLineData] = useState<LineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { checkForNotifications } = useQueueNotifications(lineId);

  const fetchLineData = useCallback(async () => {
    if (!lineId) return null;

    try {
      const { data, error: fetchError } = await supabase
        .from('lines')
        .select('*, services(name, icon, color, base_avg_time_minutes)')
        .eq('id', lineId)
        .single();

      if (fetchError) {
        console.error('Error fetching line:', fetchError);
        setError('Failed to load queue data');
        return null;
      }

      return data as LineData;
    } catch (e) {
      console.error('Exception fetching line:', e);
      setError('Failed to load queue data');
      return null;
    }
  }, [lineId]);

  const recalculatePosition = useCallback(async (data: LineData) => {
    // Get count of people ahead in the same service queue
    const { count } = await supabase
      .from('lines')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', data.organization_id)
      .eq('service_id', data.service_id)
      .eq('status', 'waiting')
      .lt('joined_at', data.joined_at);

    const newPosition = (count || 0) + 1;
    const avgServiceTime = data.services?.base_avg_time_minutes || 5;
    const newEstimatedWait = (newPosition - 1) * avgServiceTime;

    return {
      ...data,
      position: newPosition,
      estimated_wait_minutes: newEstimatedWait,
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const data = await fetchLineData();
      if (data) {
        const recalculated = await recalculatePosition(data);
        setLineData(recalculated);
        checkForNotifications({
          position: recalculated.position,
          estimatedWaitMinutes: recalculated.estimated_wait_minutes || 0,
          status: recalculated.status,
        });
      }
      setIsLoading(false);
    };

    init();
  }, [lineId, fetchLineData, recalculatePosition, checkForNotifications]);

  // Polling every 10 seconds
  useEffect(() => {
    if (!lineId) return;

    const interval = setInterval(async () => {
      const data = await fetchLineData();
      if (data) {
        const recalculated = await recalculatePosition(data);
        setLineData(recalculated);
        checkForNotifications({
          position: recalculated.position,
          estimatedWaitMinutes: recalculated.estimated_wait_minutes || 0,
          status: recalculated.status,
        });
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [lineId, fetchLineData, recalculatePosition, checkForNotifications]);

  // Real-time subscription for immediate updates
  useEffect(() => {
    if (!lineId || !lineData) return;

    const channel = supabase
      .channel(`line-updates-${lineId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lines',
          filter: `organization_id=eq.${lineData.organization_id}`,
        },
        async () => {
          // Refetch and recalculate on any change to the queue
          const data = await fetchLineData();
          if (data) {
            const recalculated = await recalculatePosition(data);
            setLineData(recalculated);
            checkForNotifications({
              position: recalculated.position,
              estimatedWaitMinutes: recalculated.estimated_wait_minutes || 0,
              status: recalculated.status,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lineId, lineData?.organization_id, fetchLineData, recalculatePosition, checkForNotifications]);

  const leaveQueue = useCallback(async () => {
    if (!lineId) return false;

    try {
      const { error: updateError } = await supabase
        .from('lines')
        .update({ status: 'cancelled' })
        .eq('id', lineId);

      if (updateError) {
        console.error('Error leaving queue:', updateError);
        return false;
      }

      return true;
    } catch (e) {
      console.error('Exception leaving queue:', e);
      return false;
    }
  }, [lineId]);

  return {
    lineData,
    isLoading,
    error,
    leaveQueue,
    refetch: fetchLineData,
  };
};

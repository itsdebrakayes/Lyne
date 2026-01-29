import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface LineData {
  id: string;
  ticket_number: string;
  position: number;
  status: string;
  estimated_wait_minutes: number | null;
  service_id: string;
  organization_id: string;
  branch_id: string | null;
  joined_at: string | null;
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

  const fetchLineData = useCallback(async () => {
    if (!lineId) {
      setIsLoading(false);
      return null;
    }

    try {
      setIsLoading(true);
      const { data, error: fetchError } = await supabase
        .from('lines')
        .select(`
          *,
          services:service_id(name, icon, color, base_avg_time_minutes)
        `)
        .eq('id', lineId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setLineData(null);
          setError('Queue entry not found');
        } else {
          throw fetchError;
        }
      } else {
        setLineData(data);
        setError(null);
      }
      
      return data;
    } catch (err) {
      console.error('Error fetching line data:', err);
      setError('Failed to fetch queue position');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [lineId]);

  const leaveQueue = useCallback(async () => {
    if (!lineId || !lineData) return false;

    try {
      const { error: updateError } = await supabase
        .from('lines')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', lineId);

      if (updateError) throw updateError;

      // Shift positions for remaining customers
      await supabase.rpc('shift_queue_positions', {
        p_org_id: lineData.organization_id,
        p_service_id: lineData.service_id,
        p_from_position: lineData.position
      });

      setLineData(null);
      return true;
    } catch (err) {
      console.error('Error leaving queue:', err);
      setError('Failed to leave queue');
      return false;
    }
  }, [lineId, lineData]);

  // Initial fetch
  useEffect(() => {
    fetchLineData();
  }, [fetchLineData]);

  // Real-time subscription
  useEffect(() => {
    if (!lineId) return;

    const channel = supabase
      .channel(`line-${lineId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lines',
          filter: `id=eq.${lineId}`
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setLineData(null);
          } else {
            // Refetch to get joined data
            fetchLineData();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lineId, fetchLineData]);

  return {
    lineData,
    isLoading,
    error,
    leaveQueue,
    refetch: fetchLineData,
  };
};

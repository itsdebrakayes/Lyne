import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface QueueCount {
  service_id: string;
  count: number;
}

export const useQueueData = (organizationId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['queueData', organizationId],
    queryFn: async (): Promise<QueueCount[]> => {
      const { data, error } = await supabase
        .from('lines')
        .select('service_id')
        .eq('organization_id', organizationId!)
        .eq('status', 'waiting');
      
      if (error) throw error;
      
      // Group by service_id and count
      const counts = data.reduce<QueueCount[]>((acc, line) => {
        const existing = acc.find(a => a.service_id === line.service_id);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ service_id: line.service_id, count: 1 });
        }
        return acc;
      }, []);
      
      return counts;
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Set up realtime subscription
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`queue-${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lines',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          // Invalidate and refetch queue data on any change
          queryClient.invalidateQueries({ queryKey: ['queueData', organizationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  return query;
};

export const useQueuePosition = (lineId: string | undefined) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['queuePosition', lineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lines')
        .select('*, services(name, icon, color)')
        .eq('id', lineId!)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!lineId,
  });

  // Set up realtime subscription for this specific line
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
          filter: `id=eq.${lineId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['queuePosition', lineId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [lineId, queryClient]);

  return query;
};

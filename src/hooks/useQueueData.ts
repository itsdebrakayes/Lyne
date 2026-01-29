import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface QueueCount {
  service_id: string;
  count: number;
}

export const useQueueData = (organizationId: string | undefined, branchId?: string) => {
  return useQuery({
    queryKey: ['queueData', organizationId, branchId],
    queryFn: async (): Promise<QueueCount[]> => {
      if (!organizationId) return [];
      
      let query = supabase
        .from('lines')
        .select('service_id')
        .eq('organization_id', organizationId)
        .eq('status', 'waiting');
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Group by service_id and count
      const countMap = new Map<string, number>();
      (data || []).forEach(item => {
        const current = countMap.get(item.service_id) || 0;
        countMap.set(item.service_id, current + 1);
      });
      
      return Array.from(countMap.entries()).map(([service_id, count]) => ({
        service_id,
        count
      }));
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export interface LineWithDetails {
  id: string;
  position: number;
  status: string;
  ticket_number: string;
  estimated_wait_minutes: number | null;
  joined_at: string | null;
  called_at: string | null;
  client_id: string;
  service_id: string;
  branch_id: string | null;
  organization_id: string;
  services?: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
  } | null;
  clients?: {
    id: string;
    full_name: string | null;
    phone: string | null;
  } | null;
  branches?: {
    id: string;
    name: string;
  } | null;
}

export const useQueueLines = (
  organizationId: string | undefined,
  options?: {
    branchId?: string;
    serviceId?: string;
    status?: string | string[];
  }
) => {
  return useQuery({
    queryKey: ['queueLines', organizationId, options],
    queryFn: async (): Promise<LineWithDetails[]> => {
      if (!organizationId) return [];
      
      let query = supabase
        .from('lines')
        .select(`
          *,
          services:service_id(id, name, icon, color),
          clients:client_id(id, full_name, phone),
          branches:branch_id(id, name)
        `)
        .eq('organization_id', organizationId)
        .order('position', { ascending: true });
      
      if (options?.branchId) {
        query = query.eq('branch_id', options.branchId);
      }
      
      if (options?.serviceId) {
        query = query.eq('service_id', options.serviceId);
      }
      
      if (options?.status) {
        if (Array.isArray(options.status)) {
          query = query.in('status', options.status);
        } else {
          query = query.eq('status', options.status);
        }
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    refetchInterval: 15000, // Refetch every 15 seconds
  });
};

export const useQueuePosition = (lineId: string | undefined) => {
  return useQuery({
    queryKey: ['queuePosition', lineId],
    queryFn: async (): Promise<LineWithDetails | null> => {
      if (!lineId) return null;
      
      const { data, error } = await supabase
        .from('lines')
        .select(`
          *,
          services:service_id(id, name, icon, color),
          clients:client_id(id, full_name, phone),
          branches:branch_id(id, name)
        `)
        .eq('id', lineId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return data;
    },
    enabled: !!lineId,
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

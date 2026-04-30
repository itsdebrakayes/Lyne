// Queue service - business logic for queue operations

import { 
  callCustomer, 
  completeService, 
  cancelCustomer, 
  markNoShow,
  moveCustomerUp,
  moveCustomerDown 
} from '@/lib/api/queue';
import type { QueueAction } from '@/types/queue';

export async function executeQueueAction(action: QueueAction): Promise<{ success: boolean; error?: string }> {
  try {
    switch (action.action) {
      case 'call':
        if (!action.staffUserId) {
          return { success: false, error: 'Staff user ID is required' };
        }
        await callCustomer(action.lineId, action.staffUserId, action.counterId);
        break;
      
      case 'complete':
        await completeService(action.lineId, action.notes);
        break;
      
      case 'cancel':
        await cancelCustomer(action.lineId, action.notes);
        break;
      
      case 'no_show':
        await markNoShow(action.lineId);
        break;
      
      case 'move_up':
        // These require additional context - will be handled differently
        return { success: false, error: 'Move operations require organization and service context' };
      
      case 'move_down':
        return { success: false, error: 'Move operations require organization and service context' };
      
      case 'reassign':
        return { success: false, error: 'Reassign not yet implemented' };
      
      default:
        return { success: false, error: 'Unknown action' };
    }
    
    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export function calculateWaitTime(joinedAt: string | null): number {
  if (!joinedAt) return 0;
  const joined = new Date(joinedAt);
  const now = new Date();
  return Math.round((now.getTime() - joined.getTime()) / 60000);
}

export function formatWaitTime(minutes: number): string {
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 min';
  if (minutes < 60) return `${minutes} min`;
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return hours === 1 ? '1 hr' : `${hours} hrs`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'waiting':
      return 'bg-status-moderate text-white';
    case 'serving':
      return 'bg-primary text-primary-foreground';
    case 'completed':
      return 'bg-status-light text-white';
    case 'cancelled':
      return 'bg-status-busy text-white';
    case 'no_show':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case 'waiting':
      return 'Waiting';
    case 'serving':
      return 'Being Served';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'no_show':
      return 'No Show';
    default:
      return status;
  }
}

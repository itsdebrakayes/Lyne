import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { UserPlus, Phone, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import type { ActivityEvent } from '@/types/analytics';

interface ActivityFeedProps {
  events: ActivityEvent[];
  maxHeight?: string;
  className?: string;
}

const eventConfig: Record<string, { icon: React.ElementType; color: string }> = {
  queue_join: { icon: UserPlus, color: 'text-primary' },
  queue_call: { icon: Phone, color: 'text-status-moderate' },
  queue_complete: { icon: CheckCircle, color: 'text-status-light' },
  queue_cancel: { icon: XCircle, color: 'text-status-busy' },
  queue_no_show: { icon: AlertCircle, color: 'text-muted-foreground' }
};

export function ActivityFeed({ events, maxHeight = '400px', className }: ActivityFeedProps) {
  return (
    <div 
      className={cn('space-y-1 overflow-y-auto', className)}
      style={{ maxHeight }}
    >
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
      ) : (
        events.map((event) => {
          const config = eventConfig[event.type] || { icon: AlertCircle, color: 'text-muted-foreground' };
          const Icon = config.icon;
          
          return (
            <div 
              key={event.id}
              className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className={cn('mt-0.5', config.color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground line-clamp-2">
                  {event.description}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {event.ticketNumber && (
                    <span className="text-xs font-medium text-primary">
                      #{event.ticketNumber}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

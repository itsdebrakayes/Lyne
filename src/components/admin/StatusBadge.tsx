import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

type StatusType = 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show' | string;

interface StatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  waiting: {
    label: 'Waiting',
    className: 'bg-status-moderate/20 text-status-moderate border-status-moderate/30'
  },
  serving: {
    label: 'Serving',
    className: 'bg-primary/20 text-primary border-primary/30'
  },
  completed: {
    label: 'Completed',
    className: 'bg-status-light/20 text-status-light border-status-light/30'
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-status-busy/20 text-status-busy border-status-busy/30'
  },
  no_show: {
    label: 'No Show',
    className: 'bg-muted text-muted-foreground border-border'
  }
};

const sizeClasses = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-sm px-2.5 py-1',
  lg: 'text-base px-3 py-1.5'
};

export function StatusBadge({ status, size = 'md', className }: StatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status,
    className: 'bg-muted text-muted-foreground border-border'
  };

  return (
    <Badge 
      variant="outline"
      className={cn(
        'font-medium',
        config.className,
        sizeClasses[size],
        className
      )}
    >
      {config.label}
    </Badge>
  );
}

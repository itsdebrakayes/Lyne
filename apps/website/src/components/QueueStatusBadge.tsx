/**
 * QueueStatusBadge.tsx
 *
 * Animated status badge for queue ticket states.
 * Renders: waiting → serving (pulsing) → completed → cancelled / no_show
 * Used on the Ticket page, Staff Dashboard queue list, and history feed.
 */
import React from 'react';
import { cn } from '@/lib/utils';

type TicketStatus = 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show';

interface QueueStatusBadgeProps {
  status: TicketStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CONFIG: Record<TicketStatus, { label: string; dot: string; badge: string; pulse?: boolean }> = {
  waiting:   { label: 'Waiting',    dot: 'bg-amber-400',  badge: 'bg-amber-400/15 text-amber-300 border-amber-400/30' },
  serving:   { label: "You're Up!", dot: 'bg-green-400',  badge: 'bg-green-400/15 text-green-300 border-green-400/30', pulse: true },
  completed: { label: 'Completed',  dot: 'bg-blue-400',   badge: 'bg-blue-400/15 text-blue-300 border-blue-400/30' },
  cancelled: { label: 'Cancelled',  dot: 'bg-zinc-500',   badge: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
  no_show:   { label: 'No Show',    dot: 'bg-red-400',    badge: 'bg-red-400/15 text-red-300 border-red-400/30' },
};

const SIZE = {
  sm: 'text-xs px-2 py-0.5 gap-1.5',
  md: 'text-sm px-3 py-1 gap-2',
  lg: 'text-base px-4 py-1.5 gap-2.5',
};

const DOT_SIZE = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export const QueueStatusBadge: React.FC<QueueStatusBadgeProps> = ({
  status,
  showLabel = true,
  size = 'md',
  className,
}) => {
  const cfg = CONFIG[status] ?? CONFIG.waiting;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium transition-all duration-300',
        SIZE[size],
        cfg.badge,
        className,
      )}
    >
      <span className={cn('rounded-full flex-shrink-0', DOT_SIZE[size], cfg.dot, cfg.pulse && 'animate-pulse')} />
      {showLabel && cfg.label}
    </span>
  );
};

export default QueueStatusBadge;

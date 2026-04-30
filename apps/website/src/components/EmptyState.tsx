/**
 * EmptyState.tsx
 *
 * Reusable empty state component for all "no data" scenarios.
 * Provides consistent visual language across the app.
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className,
      )}
    >
      {icon && (
        <div className={cn(
          'rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4',
          compact ? 'w-12 h-12' : 'w-16 h-16',
        )}>
          <span className={cn('text-white/30', compact ? 'text-xl' : 'text-2xl')}>
            {icon}
          </span>
        </div>
      )}
      <h3 className={cn(
        'font-semibold text-white/70',
        compact ? 'text-sm' : 'text-base',
      )}>
        {title}
      </h3>
      {description && (
        <p className={cn(
          'text-white/40 mt-1 max-w-xs leading-relaxed',
          compact ? 'text-xs' : 'text-sm',
        )}>
          {description}
        </p>
      )}
      {action && (
        <div className="mt-4">
          {action}
        </div>
      )}
    </div>
  );
};

// Pre-configured empty states for common scenarios
export const NoQueuesEmpty: React.FC<{ className?: string }> = ({ className }) => (
  <EmptyState
    icon="🏢"
    title="No active queues"
    description="There are no open queues for this service today. Check back later or try a different branch."
    className={className}
  />
);

export const NoHistoryEmpty: React.FC<{ className?: string }> = ({ className }) => (
  <EmptyState
    icon="📋"
    title="No visit history yet"
    description="Your completed visits will appear here. Join a queue to get started."
    className={className}
  />
);

export const NoStaffEmpty: React.FC<{ className?: string }> = ({ className }) => (
  <EmptyState
    icon="👥"
    title="No staff assigned"
    description="No staff members have been assigned to this branch yet."
    className={className}
  />
);

export const NoAnalyticsEmpty: React.FC<{ className?: string }> = ({ className }) => (
  <EmptyState
    icon="📊"
    title="Analytics loading"
    description="Analytics data will appear once queues have been active for at least one day."
    className={className}
  />
);

export const NoNotificationsEmpty: React.FC<{ className?: string }> = ({ className }) => (
  <EmptyState
    icon="🔔"
    title="All caught up"
    description="You have no new notifications."
    compact
    className={className}
  />
);

export const ApiErrorState: React.FC<{ message?: string; onRetry?: () => void; className?: string }> = ({
  message,
  onRetry,
  className,
}) => (
  <EmptyState
    icon="⚠️"
    title="Something went wrong"
    description={message || 'Could not load data. Please check your connection and try again.'}
    action={onRetry ? (
      <button
        onClick={onRetry}
        className="text-sm text-white/60 hover:text-white/90 underline underline-offset-2 transition-colors"
      >
        Try again
      </button>
    ) : undefined}
    className={className}
  />
);

export default EmptyState;

import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import { Clock } from 'lucide-react';

interface TimeDisplayProps {
  timestamp: string | null;
  showIcon?: boolean;
  relative?: boolean;
  className?: string;
}

export function TimeDisplay({ timestamp, showIcon = false, relative = true, className }: TimeDisplayProps) {
  if (!timestamp) {
    return <span className={cn('text-muted-foreground', className)}>--</span>;
  }

  const date = new Date(timestamp);
  const displayText = relative 
    ? formatDistanceToNow(date, { addSuffix: true })
    : format(date, 'h:mm a');

  return (
    <span className={cn('text-muted-foreground flex items-center gap-1', className)}>
      {showIcon && <Clock className="w-3.5 h-3.5" />}
      {displayText}
    </span>
  );
}

interface DurationDisplayProps {
  minutes: number;
  showIcon?: boolean;
  className?: string;
}

export function DurationDisplay({ minutes, showIcon = false, className }: DurationDisplayProps) {
  let displayText: string;

  if (minutes < 1) {
    displayText = '<1 min';
  } else if (minutes === 1) {
    displayText = '1 min';
  } else if (minutes < 60) {
    displayText = `${Math.round(minutes)} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    if (remainingMinutes === 0) {
      displayText = hours === 1 ? '1 hr' : `${hours} hrs`;
    } else {
      displayText = `${hours}h ${remainingMinutes}m`;
    }
  }

  return (
    <span className={cn('text-muted-foreground flex items-center gap-1', className)}>
      {showIcon && <Clock className="w-3.5 h-3.5" />}
      {displayText}
    </span>
  );
}

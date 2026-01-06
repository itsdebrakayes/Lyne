import * as React from 'react';
import { cn } from '@/lib/utils';
import { User, Clock, ChevronUp, ChevronDown, Phone, X, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCustomerInitials } from '@/types/customer';
import { calculateWaitTime, formatWaitTime, getStatusColor, getStatusLabel } from '@/lib/services/queueService';
import type { QueueEntry } from '@/types/queue';

interface QueueCardProps {
  entry: QueueEntry;
  onCall?: () => void;
  onComplete?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
  showActions?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isServing?: boolean;
  className?: string;
}

export function QueueCard({
  entry,
  onCall,
  onComplete,
  onMoveUp,
  onMoveDown,
  onRemove,
  showActions = true,
  isFirst = false,
  isLast = false,
  isServing = false,
  className
}: QueueCardProps) {
  const waitTime = calculateWaitTime(entry.joined_at);
  const customerName = entry.client?.full_name || 'Unknown Customer';
  const initials = getCustomerInitials(customerName);
  const status = entry.status || 'waiting';

  return (
    <div className={cn(
      'glass rounded-xl p-4 transition-all duration-200 hover:shadow-glass-hover',
      isServing && 'ring-2 ring-primary',
      className
    )}>
      {/* Header with avatar and ticket */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-sm font-bold text-primary">{initials}</span>
          </div>
          <div>
            <p className="font-semibold text-foreground">{customerName}</p>
            <p className="text-xs text-muted-foreground">{entry.client?.trn_number || 'No TRN'}</p>
          </div>
        </div>
        <Badge variant="outline" className="text-lg font-bold px-3 py-1">
          {entry.ticket_number}
        </Badge>
      </div>

      {/* Service and time info */}
      <div className="flex items-center justify-between mb-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Service:</span>
          <span className="font-medium text-foreground">{entry.service?.name || 'Unknown'}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>{formatWaitTime(waitTime)}</span>
        </div>
      </div>

      {/* Status badge */}
      <div className="flex items-center justify-between mb-3">
        <Badge className={cn(getStatusColor(status), 'text-xs')}>
          {getStatusLabel(status)}
        </Badge>
        <span className="text-xs text-muted-foreground">Position #{entry.position}</span>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="flex items-center gap-2 pt-3 border-t border-border">
          {status === 'waiting' && (
            <>
              <Button 
                size="sm" 
                onClick={onCall}
                className="flex-1 bg-primary hover:bg-primary-dark"
              >
                <Phone className="w-4 h-4 mr-1" />
                Call
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onMoveUp}
                disabled={isFirst}
                className="p-2"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onMoveDown}
                disabled={isLast}
                className="p-2"
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={onRemove}
                className="p-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
          {status === 'serving' && (
            <>
              <Button 
                size="sm" 
                onClick={onComplete}
                className="flex-1 bg-status-light hover:bg-status-light/90"
              >
                <CheckCircle className="w-4 h-4 mr-1" />
                Complete
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={onRemove}
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

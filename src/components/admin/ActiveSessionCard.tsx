import * as React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CircularProgress } from '@/components/CircularProgress';
import { CheckCircle } from 'lucide-react';
import { getCustomerById, getServiceById, calculateTimeRemaining } from '@/lib/mockDataUtils';

interface Session {
  startedAt: string;
  timeLimitMinutes: number;
  counterNumber: number;
}

interface QueueEntry {
  customerId: string;
  serviceId: string;
  ticketNumber: string;
}

interface ActiveSessionCardProps {
  session: Session;
  queueEntry: QueueEntry;
}

export const ActiveSessionCard = ({ session, queueEntry }: ActiveSessionCardProps) => {
  const [timeRemaining, setTimeRemaining] = useState(
    calculateTimeRemaining(session.startedAt, session.timeLimitMinutes)
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = calculateTimeRemaining(session.startedAt, session.timeLimitMinutes);
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [session.startedAt, session.timeLimitMinutes]);

  const customer = getCustomerById(queueEntry.customerId);
  const service = getServiceById(queueEntry.serviceId);

  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">{customer?.fullName || 'Unknown'}</p>
          <p className="text-sm text-muted-foreground">{queueEntry.ticketNumber}</p>
        </div>
        <Badge variant="outline" className="text-xs">
          Counter {session.counterNumber}
        </Badge>
      </div>

      <div className="flex items-center justify-center">
        <CircularProgress value={timeRemaining} max={session.timeLimitMinutes} size={120} color="primary">
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">{timeRemaining}</p>
            <p className="text-xs text-muted-foreground">min left</p>
          </div>
        </CircularProgress>
      </div>

      <div className="space-y-2">
        <Badge className="w-full justify-center">{service?.name || 'Service'}</Badge>
        <Button className="w-full" variant="default">
          <CheckCircle className="w-4 h-4 mr-2" />
          Complete Service
        </Button>
      </div>
    </div>
  );
};

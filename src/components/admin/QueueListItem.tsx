import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Eye } from 'lucide-react';
import { getInitials } from '@/lib/mockDataUtils';

interface Customer {
  fullName: string;
}

interface Service {
  name: string;
}

interface QueueListItemProps {
  customer: Customer;
  service: Service;
  ticketNumber: string;
  position: number;
}

export const QueueListItem = ({ customer, service, ticketNumber, position }: QueueListItemProps) => {
  const initials = getInitials(customer.fullName);

  return (
    <div className="glass rounded-lg p-4 flex items-center gap-3 hover:bg-white/10 transition-colors">
      <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
        {initials}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{customer.fullName}</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="secondary" className="text-xs">{service.name}</Badge>
          <span className="text-xs text-muted-foreground">{`Pos: ${position}`}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline">
          <Phone className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline">
          <Eye className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

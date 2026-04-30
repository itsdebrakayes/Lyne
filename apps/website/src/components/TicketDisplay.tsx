import * as React from 'react';
import { GlassCard } from "./GlassCard";

interface TicketDisplayProps {
  ticketNumber: string;
  service: string;
}

export const TicketDisplay = ({ ticketNumber, service }: TicketDisplayProps) => {
  return (
    <GlassCard ticket className="p-8 text-center space-y-4 animate-bounce-in">
      <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Token Number
      </div>
      <div className="text-7xl font-bold text-primary tracking-tight">
        {ticketNumber}
      </div>
      <div className="h-px bg-border my-4" />
      <div className="text-xl font-semibold uppercase tracking-wider">
        {service}
      </div>
    </GlassCard>
  );
};

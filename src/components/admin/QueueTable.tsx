import * as React from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { getCustomerById, getServiceById, formatWaitTime } from '@/lib/mockDataUtils';
import { cn } from "@/lib/utils";

interface QueueEntry {
  id: string;
  customerId: string;
  serviceId: string;
  ticketNumber: string;
  position: number;
  status: 'waiting' | 'serving' | 'completed';
  estimatedWaitMinutes: number;
}

interface QueueTableProps {
  entries: QueueEntry[];
}

const statusConfig = {
  waiting: { color: 'bg-yellow-500', label: 'Waiting' },
  serving: { color: 'bg-green-500', label: 'Serving' },
  completed: { color: 'bg-gray-400', label: 'Completed' },
};

export const QueueTable = ({ entries }: QueueTableProps) => {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Position</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Ticket #</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Wait Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const customer = getCustomerById(entry.customerId);
            const service = getServiceById(entry.serviceId);
            const status = statusConfig[entry.status];

            return (
              <TableRow key={entry.id} className="hover:bg-muted/50">
                <TableCell className="font-medium">
                  {entry.status === 'serving' ? 'Now' : `#${entry.position}`}
                </TableCell>
                <TableCell>{customer?.fullName || 'Unknown'}</TableCell>
                <TableCell>{service?.name || 'Unknown'}</TableCell>
                <TableCell className="font-mono text-xs">{entry.ticketNumber}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", status.color)} />
                    <span className="text-sm">{status.label}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {entry.status === 'waiting' ? formatWaitTime(entry.estimatedWaitMinutes) : '-'}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

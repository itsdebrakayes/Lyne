import * as React from 'react';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MoreVertical } from 'lucide-react';
import { getInitials } from '@/lib/mockDataUtils';
import { formatDistanceToNow } from 'date-fns';

interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  lastVisited: string;
  totalVisits: number;
  servicesUsed: string[];
}

interface CustomerTableProps {
  customers: Customer[];
}

export const CustomerTable = ({ customers }: CustomerTableProps) => {
  return (
    <div className="glass rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Last Visited</TableHead>
            <TableHead>Total Visits</TableHead>
            <TableHead>Services Used</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => {
            const initials = getInitials(customer.fullName);
            const lastVisited = formatDistanceToNow(new Date(customer.lastVisited), { addSuffix: true });

            return (
              <TableRow key={customer.id} className="hover:bg-muted/50 cursor-pointer">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                      {initials}
                    </div>
                    <span className="font-medium">{customer.fullName}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{customer.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{customer.phone}</TableCell>
                <TableCell className="text-sm">{lastVisited}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{customer.totalVisits}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {customer.servicesUsed.slice(0, 2).map((service, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                    {customer.servicesUsed.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{customer.servicesUsed.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

import * as React from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { useStaffRole } from '@/hooks/useStaffRole';
import { fetchVisitHistory, exportVisitHistoryCSV } from '@/lib/api/customers';
import { fetchServices } from '@/lib/api/services';
import { ExportButton, downloadCSV } from '@/components/admin/ExportButton';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { DurationDisplay } from '@/components/admin/TimeDisplay';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Customers() {
  const { staffData } = useStaffRole();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'completed' | 'cancelled' | 'no_show'>('all');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const pageSize = 25;

  const organizationId = staffData?.organization_id;

  const { data: services = [] } = useQuery({
    queryKey: ['services', organizationId],
    queryFn: () => fetchServices(organizationId!),
    enabled: !!organizationId
  });

  const { data: historyData, isLoading } = useQuery({
    queryKey: ['visitHistory', organizationId, selectedService, selectedStatus, page],
    queryFn: () => fetchVisitHistory(organizationId!, {
      serviceId: selectedService !== 'all' ? selectedService : undefined,
      status: selectedStatus,
      page,
      pageSize
    }),
    enabled: !!organizationId
  });

  const records = historyData?.records || [];
  const total = historyData?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const handleExport = async () => {
    if (!organizationId) return;
    setExporting(true);
    try {
      const csv = await exportVisitHistoryCSV(organizationId, {
        serviceId: selectedService !== 'all' ? selectedService : undefined,
        status: selectedStatus
      });
      downloadCSV(csv, `customer-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    } finally {
      setExporting(false);
    }
  };

  const filteredRecords = searchQuery
    ? records.filter(r => 
        r.client?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.client?.trn_number?.includes(searchQuery)
      )
    : records;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Customer History</h1>
          <p className="text-muted-foreground mt-2">View and export customer visit records</p>
        </div>
        <ExportButton onExport={handleExport} loading={exporting} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or TRN..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Select value={selectedService} onValueChange={setSelectedService}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Services" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {services.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no_show">No Show</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>TRN</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Wait Time</TableHead>
              <TableHead>Service Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filteredRecords.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No records found</TableCell></TableRow>
            ) : (
              filteredRecords.map(record => (
                <TableRow key={record.id}>
                  <TableCell>{format(new Date(record.visit_date), 'MMM d, yyyy')}</TableCell>
                  <TableCell className="font-medium">{record.client?.full_name || 'Unknown'}</TableCell>
                  <TableCell>{record.client?.trn_number || '-'}</TableCell>
                  <TableCell>{record.service?.name || '-'}</TableCell>
                  <TableCell><DurationDisplay minutes={record.wait_time_minutes || 0} /></TableCell>
                  <TableCell><DurationDisplay minutes={record.service_time_minutes || 0} /></TableCell>
                  <TableCell>
                    <StatusBadge status={record.was_no_show ? 'no_show' : record.was_cancelled ? 'cancelled' : 'completed'} size="sm" />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-border">
            <span className="text-sm text-muted-foreground">Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, total)} of {total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 1}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

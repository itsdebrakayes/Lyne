import React, { useState } from 'react';
import { Clock, Users, Monitor, Grid3X3, Download, Search } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExportModal } from '@/components/ExportModal';

// Mock data
const mockQueueEntries = [
  { id: '1', position: 1, ticketNumber: 'A-001', name: 'John Smith', service: 'Documents', waitTime: '12 min', status: 'waiting' },
  { id: '2', position: 2, ticketNumber: 'A-002', name: 'Sarah Johnson', service: 'Payments', waitTime: '8 min', status: 'waiting' },
  { id: '3', position: 3, ticketNumber: 'B-001', name: 'Michael Brown', service: 'Enquiries', waitTime: '5 min', status: 'serving' },
  { id: '4', position: 4, ticketNumber: 'A-003', name: 'Emily Davis', service: 'Documents', waitTime: '3 min', status: 'waiting' },
  { id: '5', position: 5, ticketNumber: 'C-001', name: 'David Wilson', service: 'Documents', waitTime: '2 min', status: 'waiting' },
];

const services = ['All Services', 'Documents', 'Payments', 'Enquiries', 'Registration'];

const ManagerDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('All Services');
  const [showExport, setShowExport] = useState(false);

  const stats = [
    { label: 'Total in Queue', value: '47', icon: Users, color: 'text-primary' },
    { label: 'Avg Wait Time', value: '18 min', icon: Clock, color: 'text-secondary' },
    { label: 'Active Counters', value: '8', icon: Monitor, color: 'text-accent' },
    { label: 'Services Active', value: '5', icon: Grid3X3, color: 'text-tertiary' },
  ];

  const filteredEntries = mockQueueEntries.filter(entry => {
    const matchesSearch = entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         entry.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesService = serviceFilter === 'All Services' || entry.service === serviceFilter;
    return matchesSearch && matchesService;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'serving':
        return <Badge className="bg-status-light/20 text-status-light border-0">Serving</Badge>;
      case 'waiting':
        return <Badge variant="outline">Waiting</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Manager Dashboard</h1>
          <p className="text-muted-foreground">Overview of all services and queues</p>
        </div>
        <Button onClick={() => setShowExport(true)} className="gap-2">
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <GlassCard key={stat.label} className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-muted">
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Queue Table */}
      <GlassCard className="p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or ticket..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => (
                <SelectItem key={service} value={service}>
                  {service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">#</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Wait Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredEntries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="font-medium">{entry.position}</TableCell>
                <TableCell className="font-mono">{entry.ticketNumber}</TableCell>
                <TableCell>{entry.name}</TableCell>
                <TableCell>{entry.service}</TableCell>
                <TableCell>{entry.waitTime}</TableCell>
                <TableCell>{getStatusBadge(entry.status)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost">
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassCard>

      {/* Export Modal */}
      <ExportModal
        open={showExport}
        onOpenChange={setShowExport}
        format="csv"
        filename={`queue_data_${new Date().toISOString().split('T')[0]}`}
      />
    </div>
  );
};

export default ManagerDashboard;

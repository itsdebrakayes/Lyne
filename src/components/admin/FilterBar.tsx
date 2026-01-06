import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  services?: FilterOption[];
  counters?: FilterOption[];
  statuses?: FilterOption[];
  selectedService?: string;
  selectedCounter?: string;
  selectedStatus?: string;
  searchQuery?: string;
  onServiceChange?: (value: string) => void;
  onCounterChange?: (value: string) => void;
  onStatusChange?: (value: string) => void;
  onSearchChange?: (value: string) => void;
  className?: string;
}

export function FilterBar({
  services = [],
  counters = [],
  statuses = [
    { value: 'all', label: 'All' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'serving', label: 'Serving' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ],
  selectedService = 'all',
  selectedCounter = 'all',
  selectedStatus = 'all',
  searchQuery = '',
  onServiceChange,
  onCounterChange,
  onStatusChange,
  onSearchChange,
  className
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or ticket..."
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Service filter */}
      {services.length > 0 && (
        <Select value={selectedService} onValueChange={onServiceChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Services" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Services</SelectItem>
            {services.map((service) => (
              <SelectItem key={service.value} value={service.value}>
                {service.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Counter filter */}
      {counters.length > 0 && (
        <Select value={selectedCounter} onValueChange={onCounterChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Counters" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Counters</SelectItem>
            {counters.map((counter) => (
              <SelectItem key={counter.value} value={counter.value}>
                {counter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Status filter */}
      <Select value={selectedStatus} onValueChange={onStatusChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

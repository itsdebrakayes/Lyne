import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Mail, Monitor, Settings, Save, X, MapPin, Calendar, IdCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  user_id: string;
  email?: string;
  full_name?: string;
  role: string;
  assigned_service_id?: string;
  assigned_section?: string;
  is_active: boolean;
  service_name?: string;
  counter_number?: number;
  customers_served_today?: number;
  avg_service_time?: number;
  branch_name?: string;
  branch_id?: string;
  staff_id?: string;
  date_of_birth?: string;
  address?: string;
  counter_id?: string;
}

interface StaffAssignmentEditorProps {
  staff: StaffMember;
  organizationId: string;
}

interface Service {
  id: string;
  name: string;
}

interface Counter {
  id: string;
  counter_number: number;
  service_id: string;
  service?: { name: string };
}

const roleColors: Record<string, string> = {
  staff: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
  section_manager: 'bg-purple-500/20 text-purple-600 dark:text-purple-400',
  manager: 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
  executive: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
};

const roleLabels: Record<string, string> = {
  staff: 'Staff',
  section_manager: 'Section Manager',
  manager: 'Manager',
  executive: 'Executive',
};

function getInitials(name?: string, email?: string): string {
  if (name) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '??';
}

export function StaffAssignmentEditor({ staff, organizationId }: StaffAssignmentEditorProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedServiceId, setSelectedServiceId] = React.useState(staff.assigned_service_id || '');
  const [selectedCounterId, setSelectedCounterId] = React.useState(staff.counter_id || '');

  const initials = getInitials(staff.full_name, staff.email);
  const displayName = staff.full_name || staff.email?.split('@')[0] || 'Unknown';

  // Fetch services for this organization
  const { data: services = [] } = useQuery({
    queryKey: ['services', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data as Service[];
    },
    enabled: isOpen,
  });

  // Fetch counters for this organization
  const { data: counters = [] } = useQuery({
    queryKey: ['counters', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('counters')
        .select('id, counter_number, service_id, service:services(name)')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('counter_number');
      if (error) throw error;
      return data as Counter[];
    },
    enabled: isOpen,
  });

  // Filter counters by selected service
  const filteredCounters = React.useMemo(() => {
    if (!selectedServiceId) return counters;
    return counters.filter(c => c.service_id === selectedServiceId);
  }, [counters, selectedServiceId]);

  // Mutation to update staff assignment
  const updateAssignment = useMutation({
    mutationFn: async () => {
      // Update staff_roles with new service and counter
      const { error: roleError } = await supabase
        .from('staff_roles')
        .update({
          assigned_service_id: selectedServiceId || null,
          counter_id: selectedCounterId || null,
        })
        .eq('id', staff.id);

      if (roleError) throw roleError;

      // If counter is selected, also create/update counter assignment for today
      if (selectedCounterId) {
        const today = new Date().toISOString().split('T')[0];
        
        // Check if assignment exists
        const { data: existing } = await supabase
          .from('counter_assignments')
          .select('id')
          .eq('staff_user_id', staff.user_id)
          .eq('assignment_date', today)
          .single();

        if (existing) {
          const { error } = await supabase
            .from('counter_assignments')
            .update({ counter_id: selectedCounterId })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('counter_assignments')
            .insert({
              counter_id: selectedCounterId,
              staff_user_id: staff.user_id,
              assignment_date: today,
            });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success(`Updated assignment for ${displayName}`);
      queryClient.invalidateQueries({ queryKey: ['staff-list'] });
      queryClient.invalidateQueries({ queryKey: ['counter-assignments'] });
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to update assignment: ${error.message}`);
    },
  });

  const handleSave = () => {
    updateAssignment.mutate();
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      setSelectedServiceId(staff.assigned_service_id || '');
      setSelectedCounterId(staff.counter_id || '');
    }
  };

  return (
    <div className={cn(
      "glass rounded-xl p-4 transition-all hover:shadow-lg",
      !staff.is_active && "opacity-60"
    )}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{displayName}</h3>
          {staff.staff_id && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <IdCard className="h-3 w-3" />
              {staff.staff_id}
            </p>
          )}
          {staff.email && (
            <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {staff.email}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <Badge className={cn("text-xs", roleColors[staff.role] || roleColors.staff)}>
              {roleLabels[staff.role] || staff.role}
            </Badge>
            {!staff.is_active && (
              <Badge variant="secondary" className="text-xs">Inactive</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Assignment Info */}
      <div className="mt-4 pt-4 border-t border-border/50">
        {staff.branch_name && (
          <div className="mb-2 flex items-center gap-1">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{staff.branch_name}</p>
          </div>
        )}
        {staff.date_of_birth && (
          <div className="mb-2 flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              DOB: {new Date(staff.date_of_birth).toLocaleDateString()}
            </p>
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Service</p>
            <p className="font-medium text-foreground truncate">
              {staff.service_name || staff.assigned_section || 'Not assigned'}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Counter</p>
            <p className="font-medium text-foreground flex items-center gap-1">
              <Monitor className="h-3 w-3" />
              {staff.counter_number ? `#${staff.counter_number}` : 'N/A'}
            </p>
          </div>
        </div>

        {/* Stats */}
        {(staff.customers_served_today !== undefined) && (
          <div className="grid grid-cols-2 gap-2 text-sm mt-3">
            <div>
              <p className="text-muted-foreground">Served Today</p>
              <p className="font-semibold text-foreground">{staff.customers_served_today || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Avg Time</p>
              <p className="font-semibold text-foreground">
                {staff.avg_service_time ? `${staff.avg_service_time}m` : 'N/A'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Edit Assignment Dialog */}
      <div className="mt-4">
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Settings className="h-4 w-4" />
              Edit Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Assignment for {displayName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {/* Staff ID (read-only) */}
              {staff.staff_id && (
                <div>
                  <label className="text-sm font-medium text-foreground">Staff ID</label>
                  <p className="mt-1 px-3 py-2 bg-muted rounded-md text-sm">{staff.staff_id}</p>
                </div>
              )}

              {/* Service Select */}
              <div>
                <label className="text-sm font-medium text-foreground">Service</label>
                <Select value={selectedServiceId} onValueChange={(val) => {
                  setSelectedServiceId(val);
                  setSelectedCounterId(''); // Reset counter when service changes
                }}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a service..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No service assigned</SelectItem>
                    {services.map(service => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Counter Select */}
              <div>
                <label className="text-sm font-medium text-foreground">Counter</label>
                <Select value={selectedCounterId} onValueChange={setSelectedCounterId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a counter..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No counter assigned</SelectItem>
                    {filteredCounters.map(counter => (
                      <SelectItem key={counter.id} value={counter.id}>
                        Counter #{counter.counter_number} - {(counter.service as any)?.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedServiceId && filteredCounters.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No counters available for this service
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateAssignment.isPending}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateAssignment.isPending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

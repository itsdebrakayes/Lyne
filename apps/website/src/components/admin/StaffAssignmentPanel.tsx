import * as React from 'react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Monitor, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { fetchAllStaff, fetchCountersWithStaff, assignStaffToCounter } from '@/lib/api/staff';

interface StaffAssignmentPanelProps {
  organizationId: string;
}

export const StaffAssignmentPanel = ({ organizationId }: StaffAssignmentPanelProps) => {
  const queryClient = useQueryClient();
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  // Fetch staff
  const { data: staffMembers = [], isLoading: staffLoading } = useQuery({
    queryKey: ['allStaff', organizationId],
    queryFn: () => fetchAllStaff(organizationId),
    enabled: !!organizationId
  });

  // Fetch counters
  const { data: counters = [], isLoading: countersLoading } = useQuery({
    queryKey: ['countersWithStaff', organizationId],
    queryFn: () => fetchCountersWithStaff(organizationId),
    enabled: !!organizationId
  });

  // Assign mutation
  const assignMutation = useMutation({
    mutationFn: async ({ staffUserId, counterId }: { staffUserId: string; counterId: string }) => {
      await assignStaffToCounter(counterId, staffUserId);
    },
    onSuccess: () => {
      toast.success('Staff assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['countersWithStaff', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['allStaff', organizationId] });
    },
    onError: (error: any) => {
      toast.error('Failed to assign staff', { description: error.message });
    }
  });

  const handleAssignmentChange = (staffUserId: string, counterId: string) => {
    setAssignments(prev => ({ ...prev, [staffUserId]: counterId }));
  };

  const handleSaveAssignment = (staffUserId: string) => {
    const counterId = assignments[staffUserId];
    if (counterId) {
      assignMutation.mutate({ staffUserId, counterId });
    }
  };

  // Only show staff (not managers/executives)
  const assignableStaff = staffMembers.filter(s => s.role === 'staff' || s.role === 'section_manager');

  if (staffLoading || countersLoading) {
    return (
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Staff Assignments
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Staff Assignments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {assignableStaff.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No staff members to assign</p>
        ) : (
          <div className="space-y-4">
            {assignableStaff.map(staff => {
              const currentCounter = counters.find(c => c.staffUserId === staff.user_id);
              const selectedCounterId = assignments[staff.user_id] || currentCounter?.id || '';
              const staffName = staff.full_name || staff.email || `Staff ${staff.user_id.slice(0, 8)}`;

              return (
                <div 
                  key={staff.user_id}
                  className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{staffName}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {staff.role}
                        </Badge>
                        {staff.service_name && (
                          <span className="text-xs text-muted-foreground">
                            {staff.service_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={selectedCounterId}
                      onValueChange={(value) => handleAssignmentChange(staff.user_id, value)}
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Select counter">
                          <div className="flex items-center gap-2">
                            <Monitor className="w-4 h-4" />
                            {selectedCounterId ? 
                              `Counter ${counters.find(c => c.id === selectedCounterId)?.counter_number}` : 
                              'Not assigned'
                            }
                          </div>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {counters.map(counter => (
                          <SelectItem key={counter.id} value={counter.id}>
                            <div className="flex items-center gap-2">
                              <Monitor className="w-4 h-4" />
                              Counter {counter.counter_number}
                              {counter.staffUserId && counter.staffUserId !== staff.user_id && (
                                <span className="text-xs text-muted-foreground">(occupied)</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {assignments[staff.user_id] && assignments[staff.user_id] !== currentCounter?.id && (
                      <Button 
                        size="sm" 
                        onClick={() => handleSaveAssignment(staff.user_id)}
                        disabled={assignMutation.isPending}
                      >
                        {assignMutation.isPending ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          'Save'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

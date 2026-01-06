import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, UserCog, Users, Clock, Award } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { StaffCard } from '@/components/admin/StaffCard';
import { StatCard } from '@/components/admin/StatCard';
import { useStaffRole } from '@/hooks/useStaffRole';
import { fetchAllStaff, fetchStaffStats } from '@/lib/api/staff';

export default function Staff() {
  const { staffData } = useStaffRole();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<string>('all');
  
  const organizationId = staffData?.organization_id;

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['staff-list', organizationId],
    queryFn: () => fetchAllStaff(organizationId!),
    enabled: !!organizationId,
  });

  const { data: overallStats } = useQuery({
    queryKey: ['staff-overall-stats', organizationId],
    queryFn: () => fetchStaffStats(organizationId!),
    enabled: !!organizationId,
  });

  const filteredStaff = React.useMemo(() => {
    return staffList.filter(staff => {
      const matchesSearch = !searchQuery || 
        staff.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || staff.role === roleFilter;
      
      return matchesSearch && matchesRole;
    });
  }, [staffList, searchQuery, roleFilter]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Staff Management</h1>
          <p className="text-muted-foreground mt-2">Loading staff data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-foreground">Staff Management</h1>
        <p className="text-muted-foreground mt-2">Manage and monitor your team</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Staff"
          value={staffList.length}
          icon={Users}
          iconColor="text-primary"
        />
        <StatCard
          label="Active Today"
          value={overallStats?.activeToday || 0}
          icon={UserCog}
          iconColor="text-status-light"
        />
        <StatCard
          label="Avg Service Time"
          value={`${overallStats?.avgServiceTime || 0}m`}
          icon={Clock}
          iconColor="text-status-moderate"
        />
        <StatCard
          label="Top Performers"
          value={overallStats?.topPerformers || 0}
          icon={Award}
          iconColor="text-secondary"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search staff..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="section_manager">Section Manager</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="executive">Executive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Staff Grid */}
      {filteredStaff.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center">
          <UserCog className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Staff Found</h3>
          <p className="text-muted-foreground">
            {searchQuery || roleFilter !== 'all' 
              ? 'Try adjusting your filters' 
              : 'No staff members have been added yet'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((staff) => (
            <StaffCard key={staff.id} staff={staff} />
          ))}
        </div>
      )}
    </div>
  );
}
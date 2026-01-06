import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, User, Clock, Award, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/admin/StatCard';
import { useStaffRole } from '@/hooks/useStaffRole';
import { fetchStaffDetail, fetchStaffPerformance } from '@/lib/api/staff';
import { cn } from '@/lib/utils';

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

export default function StaffDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { staffData: currentStaff } = useStaffRole();
  const organizationId = currentStaff?.organization_id;

  const { data: staffDetail, isLoading } = useQuery({
    queryKey: ['staff-detail', userId, organizationId],
    queryFn: () => fetchStaffDetail(userId!, organizationId!),
    enabled: !!userId && !!organizationId,
  });

  const { data: performance } = useQuery({
    queryKey: ['staff-performance', userId, organizationId],
    queryFn: () => fetchStaffPerformance(userId!, organizationId!),
    enabled: !!userId && !!organizationId,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!staffDetail) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-foreground mb-4">Staff Not Found</h2>
        <Link to="/admin/staff">
          <Button variant="outline">Back to Staff List</Button>
        </Link>
      </div>
    );
  }

  const displayName = staffDetail.service_name || staffDetail.assigned_section || `User ${staffDetail.user_id.slice(0, 8)}`;
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Back Button */}
      <Link to="/admin/staff">
        <Button variant="ghost" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Staff
        </Button>
      </Link>

      {/* Profile Header */}
      <div className="glass rounded-xl p-6">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-2xl">
            {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-foreground">{displayName}</h1>
            <p className="text-muted-foreground text-sm">ID: {staffDetail.user_id}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge className={cn("text-sm", roleColors[staffDetail.role] || roleColors.staff)}>
                {roleLabels[staffDetail.role] || staffDetail.role}
              </Badge>
              {staffDetail.is_active ? (
                <Badge variant="secondary" className="bg-status-light/20 text-status-light">Active</Badge>
              ) : (
                <Badge variant="secondary">Inactive</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Assignment Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-border/50">
          <div>
            <p className="text-sm text-muted-foreground">Assigned Service</p>
            <p className="font-medium text-foreground">
              {staffDetail.service_name || 'All Services'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Section</p>
            <p className="font-medium text-foreground">
              {staffDetail.assigned_section || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Counter</p>
            <p className="font-medium text-foreground">
              {staffDetail.counter_number ? `Counter #${staffDetail.counter_number}` : 'Not assigned'}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Member Since</p>
            <p className="font-medium text-foreground">
              {staffDetail.created_at 
                ? new Date(staffDetail.created_at).toLocaleDateString()
                : 'Unknown'}
            </p>
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          label="Customers Served"
          value={performance?.customers_served || 0}
          icon={User}
          iconColor="text-primary"
        />
        <StatCard
          label="Avg Service Time"
          value={`${performance?.avg_service_time || 0}m`}
          icon={Clock}
          iconColor="text-status-moderate"
        />
        <StatCard
          label="Efficiency Score"
          value={`${performance?.efficiency_score || 0}%`}
          icon={TrendingUp}
          iconColor="text-status-light"
        />
        <StatCard
          label="Rank"
          value={`#${performance?.rank_in_org || '-'}`}
          icon={Award}
          iconColor="text-secondary"
        />
      </div>

      {/* Recent Activity */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-xl font-semibold text-foreground mb-4">Recent Activity</h2>
        {performance?.recent_sessions && performance.recent_sessions.length > 0 ? (
          <div className="space-y-3">
            {performance.recent_sessions.map((session: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium text-foreground">{session.service_name || 'Service'}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(session.completed_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{session.duration_minutes || 0}m</p>
                  <p className="text-sm text-muted-foreground capitalize">{session.outcome}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">No recent activity</p>
        )}
      </div>
    </div>
  );
}
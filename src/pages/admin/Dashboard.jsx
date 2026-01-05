import React from 'react';
import { useStaffRole } from '@/hooks/useStaffRole';
import StaffDashboard from './StaffDashboard';
import ManagerDashboard from './ManagerDashboard';
import ExecutiveDashboard from './ExecutiveDashboard';
import { Skeleton } from '@/components/ui/skeleton';

export default function Dashboard() {
  const { role, loading } = useStaffRole();

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  // Render role-based dashboard
  switch (role) {
    case 'executive':
      return <ExecutiveDashboard />;
    case 'manager':
    case 'section_manager':
      return <ManagerDashboard />;
    case 'staff':
    default:
      return <StaffDashboard />;
  }
}

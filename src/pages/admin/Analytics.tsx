import * as React from 'react';
import { useStaffRole } from '@/hooks/useStaffRole';
import ExecutiveDashboard from './ExecutiveDashboard';

export default function Analytics() {
  const { role, loading } = useStaffRole();

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground mt-2">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  // Analytics uses the same executive dashboard view
  return <ExecutiveDashboard />;
}

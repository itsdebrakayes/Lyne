import * as React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Mail, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';

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
}

interface StaffCardProps {
  staff: StaffMember;
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

export function StaffCard({ staff }: StaffCardProps) {
  const initials = getInitials(staff.full_name, staff.email);
  const displayName = staff.full_name || staff.email?.split('@')[0] || 'Unknown';

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
        {(staff.customers_served_today !== undefined || staff.avg_service_time !== undefined) && (
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

      {/* Actions */}
      <div className="mt-4">
        <Link to={`/admin/staff/${staff.user_id}`}>
          <Button variant="outline" size="sm" className="w-full gap-2">
            <Eye className="h-4 w-4" />
            View Details
          </Button>
        </Link>
      </div>
    </div>
  );
}
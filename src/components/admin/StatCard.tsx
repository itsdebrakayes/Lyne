import * as React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label?: string;
    isPositive?: boolean;
  };
  iconColor?: string;
  className?: string;
}

export function StatCard({ label, value, icon: Icon, trend, iconColor = 'text-primary', className }: StatCardProps) {
  return (
    <div className={cn('glass rounded-xl p-6 animate-slide-up', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium">{label}</p>
          <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
          {trend && (
            <p className={cn(
              'text-sm mt-1 font-medium',
              trend.isPositive ? 'text-status-light' : 'text-status-busy'
            )}>
              {trend.value > 0 ? '+' : ''}{trend.value}%
              {trend.label && <span className="text-muted-foreground ml-1">{trend.label}</span>}
            </p>
          )}
        </div>
        <div className="p-3 rounded-xl bg-primary/10">
          <Icon className={cn('w-6 h-6', iconColor)} />
        </div>
      </div>
    </div>
  );
}

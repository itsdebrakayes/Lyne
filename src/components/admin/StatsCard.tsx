import * as React from 'react';
import { cn } from "@/lib/utils";
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  gradient?: boolean;
}

export const StatsCard = ({ title, value, subtitle, icon: Icon, gradient = false }: StatsCardProps) => {
  return (
    <div
      className={cn(
        "rounded-xl p-6 flex flex-col justify-center space-y-3",
        gradient
          ? "bg-gradient-to-br from-blue-600 to-slate-700 text-white"
          : "glass"
      )}
    >
      {Icon && <Icon className={cn("w-10 h-10", gradient ? "text-white/90" : "text-primary")} />}
      <div>
        <p className={cn("text-sm font-medium", gradient ? "text-white/80" : "text-muted-foreground")}>{title}</p>
        <p className={cn("text-5xl font-bold mt-2", gradient ? "text-white" : "text-foreground")}>{value}</p>
        {subtitle && <p className={cn("text-xs mt-1", gradient ? "text-white/70" : "text-muted-foreground")}>{subtitle}</p>}
      </div>
    </div>
  );
};

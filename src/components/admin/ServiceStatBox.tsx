import * as React from 'react';
import { Circle, LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from "@/lib/utils";

interface ServiceStatBoxProps {
  count: number;
  label: string;
  icon: string;
  className?: string;
}

export const ServiceStatBox = ({ count, label, icon, className }: ServiceStatBoxProps) => {
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  const IconComponent = icons[icon] || Circle;

  return (
    <div className={cn("glass rounded-xl p-6 flex flex-col items-center justify-center space-y-3 hover:scale-105 transition-transform", className)}>
      <IconComponent className="w-12 h-12 text-primary" />
      <div className="text-center">
        <p className="text-4xl font-bold text-foreground">{count}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
};

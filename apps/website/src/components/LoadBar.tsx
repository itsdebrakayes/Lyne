import * as React from 'react';
import { cn } from "@/lib/utils";

interface LoadBarProps {
  percentage: number;
  className?: string;
  color?: 'primary' | 'secondary' | 'accent';
}

const colorClasses = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
};

export const LoadBar = ({ percentage, className, color = "primary" }: LoadBarProps) => {
  return (
    <div className={cn("h-2 bg-muted rounded-full overflow-hidden", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-all duration-1000 ease-out",
          colorClasses[color]
        )}
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
};

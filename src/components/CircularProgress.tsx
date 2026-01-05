import * as React from 'react';
import { ReactNode } from 'react';
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: ReactNode;
  color?: 'primary' | 'secondary' | 'accent' | string;
}

const colorClasses: Record<string, string> = {
  primary: "stroke-primary",
  secondary: "stroke-secondary",
  accent: "stroke-accent",
};

export const CircularProgress = ({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  className,
  children,
  color = "primary",
}: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = Math.min(100, max ? (value / max) * 100 : value);
  const offset = circumference - (percentage / 100) * circumference;

  // Check if color is a custom color string (not a predefined key)
  const isCustomColor = !colorClasses[color];
  const strokeClass = isCustomColor ? '' : colorClasses[color];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-muted fill-none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className={cn("fill-none transition-all duration-1000 ease-out", strokeClass)}
          style={isCustomColor ? { stroke: color } : undefined}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

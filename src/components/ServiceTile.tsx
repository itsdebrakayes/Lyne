import * as React from 'react';
import { GlassCard } from "./GlassCard";
import { LoadBar } from "./LoadBar";
import { cn } from "@/lib/utils";
import { LucideIcon } from 'lucide-react';

interface ServiceTileProps {
  title: string;
  icon: LucideIcon;
  queueLength: number;
  eta: string;
  activeCounters: number;
  loadPercentage: number;
  onClick?: () => void;
  className?: string;
}

export const ServiceTile = ({
  title,
  icon: Icon,
  queueLength,
  eta,
  activeCounters,
  loadPercentage,
  onClick,
  className,
}: ServiceTileProps) => {
  return (
    <GlassCard hover onClick={onClick} className={cn("p-6 space-y-4", className)}>
      <div className="flex items-start justify-between">
        <div className="p-3 rounded-lg bg-primary/10">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">{activeCounters} active</div>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        <div className="text-sm text-muted-foreground">
          {queueLength} {queueLength === 1 ? "person" : "people"}
        </div>
      </div>

      <LoadBar percentage={loadPercentage} />

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">ETA</span>
        <span className="font-semibold text-primary">{eta}</span>
      </div>
    </GlassCard>
  );
};

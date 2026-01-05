import React from 'react';
import { cn } from '@/lib/utils';

export const TrafficStatusBanner = ({ 
  status = 'moderate', 
  avgWaitMin = 10, 
  avgWaitMax = 20,
  totalInQueue = 0,
  className 
}) => {
  const statusConfig = {
    low: {
      text: 'Low Wait Time',
      color: 'text-status-light',
      bgColor: 'bg-status-light/10',
      borderColor: 'border-status-light/30',
    },
    moderate: {
      text: 'Moderate Wait Time',
      color: 'text-status-moderate',
      bgColor: 'bg-status-moderate/10',
      borderColor: 'border-status-moderate/30',
    },
    high: {
      text: 'High Wait Time',
      color: 'text-status-busy',
      bgColor: 'bg-status-busy/10',
      borderColor: 'border-status-busy/30',
    },
  };

  const config = statusConfig[status] || statusConfig.moderate;

  return (
    <div className={cn(
      "text-center py-8 px-6 rounded-2xl border backdrop-blur-sm",
      config.bgColor,
      config.borderColor,
      className
    )}>
      <h2 className={cn(
        "text-3xl md:text-4xl lg:text-5xl font-bold mb-3",
        config.color
      )}>
        {config.text}
      </h2>
      <p className="text-xl md:text-2xl text-muted-foreground">
        ~{avgWaitMin}-{avgWaitMax} min
      </p>
      {totalInQueue > 0 && (
        <p className="text-sm text-muted-foreground mt-2">
          {totalInQueue} {totalInQueue === 1 ? 'person' : 'people'} currently waiting
        </p>
      )}
    </div>
  );
};

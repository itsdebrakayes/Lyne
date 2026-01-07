import * as React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendStatCardProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trendLine?: number[];
  className?: string;
  lowerIsBetter?: boolean;
}

export function TrendStatCard({
  label,
  value,
  change,
  changeLabel = 'vs last period',
  icon,
  trendLine,
  className,
  lowerIsBetter = false
}: TrendStatCardProps) {
  const isPositive = change !== undefined && change !== 0 
    ? (lowerIsBetter ? change < 0 : change > 0)
    : null;
  
  const trendColor = isPositive === null 
    ? 'text-muted-foreground' 
    : isPositive 
      ? 'text-status-light' 
      : 'text-status-busy';

  const TrendIcon = change === undefined || change === 0 
    ? Minus 
    : change > 0 
      ? TrendingUp 
      : TrendingDown;

  // Create simple sparkline from trend data
  const renderSparkline = () => {
    if (!trendLine || trendLine.length < 2) return null;
    
    const max = Math.max(...trendLine);
    const min = Math.min(...trendLine);
    const range = max - min || 1;
    const height = 30;
    const width = 80;
    const stepX = width / (trendLine.length - 1);
    
    const points = trendLine.map((val, i) => {
      const x = i * stepX;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className="opacity-50">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={trendColor}
        />
      </svg>
    );
  };

  return (
    <div className={cn(
      'glass rounded-xl p-5 transition-all duration-200 hover:shadow-glass-hover',
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-muted-foreground font-medium mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-foreground">{value}</span>
            {icon && <span className="text-primary">{icon}</span>}
          </div>
          
          {change !== undefined && (
            <div className={cn('flex items-center gap-1 mt-2 text-sm', trendColor)}>
              <TrendIcon className="w-4 h-4" />
              <span className="font-medium">
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </span>
              <span className="text-muted-foreground text-xs ml-1">{changeLabel}</span>
            </div>
          )}
        </div>
        
        {trendLine && (
          <div className="ml-4">
            {renderSparkline()}
          </div>
        )}
      </div>
    </div>
  );
}

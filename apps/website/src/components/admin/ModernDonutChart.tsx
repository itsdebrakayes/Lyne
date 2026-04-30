import * as React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { cn } from '@/lib/utils';

interface DataPoint {
  name: string;
  value: number;
  color?: string;
}

interface ModernDonutChartProps {
  data: DataPoint[];
  title: string;
  subtitle?: string;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
  height?: number;
  colors?: string[];
}

const DEFAULT_COLORS = [
  'hsl(215, 85%, 55%)',   // Primary blue
  'hsl(180, 75%, 50%)',   // Teal
  'hsl(270, 70%, 60%)',   // Purple
  'hsl(38, 92%, 58%)',    // Orange
  'hsl(145, 65%, 52%)',   // Green
  'hsl(340, 75%, 55%)',   // Pink
];

export function ModernDonutChart({
  data,
  title,
  subtitle,
  centerLabel,
  centerValue,
  className,
  height = 280,
  colors = DEFAULT_COLORS
}: ModernDonutChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className={cn('glass rounded-xl p-6', className)}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      
      <div style={{ height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || colors[index % colors.length]}
                  className="transition-all duration-200 hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-lg)'
              }}
              formatter={(value: number) => [`${value} (${((value / total) * 100).toFixed(1)}%)`, '']}
            />
            <Legend 
              layout="horizontal"
              align="center"
              verticalAlign="bottom"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingTop: '16px' }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center content */}
        {(centerLabel || centerValue) && (
          <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            {centerValue && (
              <div className="text-2xl font-bold text-foreground">{centerValue}</div>
            )}
            {centerLabel && (
              <div className="text-xs text-muted-foreground">{centerLabel}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

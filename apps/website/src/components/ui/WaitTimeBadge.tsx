/**
 * WaitTimeBadge — Premium animated wait time indicator
 * Shows wait level (low/medium/high) with color, icon, and animated bar
 */
import { motion } from 'framer-motion';
import { Clock, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type WaitLevel = 'low' | 'medium' | 'high';

function getLevel(minutes: number): WaitLevel {
  if (minutes <= 10) return 'low';
  if (minutes <= 25) return 'medium';
  return 'high';
}

const LEVEL_CONFIG = {
  low: {
    label: 'Short Wait',
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.1)',
    border: 'rgba(34,197,94,0.25)',
    textClass: 'text-green-600 dark:text-green-400',
    barClass: 'bg-gradient-to-r from-green-400 to-emerald-500',
    icon: TrendingDown,
    barWidth: '30%',
  },
  medium: {
    label: 'Moderate Wait',
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.25)',
    textClass: 'text-amber-600 dark:text-amber-400',
    barClass: 'bg-gradient-to-r from-amber-400 to-orange-500',
    icon: Minus,
    barWidth: '60%',
  },
  high: {
    label: 'Long Wait',
    color: '#ef4444',
    bg: 'rgba(239,68,68,0.1)',
    border: 'rgba(239,68,68,0.25)',
    textClass: 'text-red-600 dark:text-red-400',
    barClass: 'bg-gradient-to-r from-red-400 to-rose-500',
    icon: TrendingUp,
    barWidth: '90%',
  },
};

interface WaitTimeBadgeProps {
  minutes: number;
  showBar?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function WaitTimeBadge({ minutes, showBar = false, size = 'md', className }: WaitTimeBadgeProps) {
  const level = getLevel(minutes);
  const config = LEVEL_CONFIG[level];
  const Icon = config.icon;

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xl font-semibold',
          size === 'sm' && 'px-2.5 py-1 text-xs',
          size === 'md' && 'px-3 py-1.5 text-sm',
          size === 'lg' && 'px-4 py-2 text-base',
          config.textClass
        )}
        style={{ background: config.bg, border: `1px solid ${config.border}` }}
      >
        <Clock className={cn(size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} />
        <span>~{minutes} min</span>
        <Icon className={cn(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
      </div>

      {showBar && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: config.barWidth }}
            transition={{ duration: 1, ease: [0.23, 0.86, 0.39, 0.96] }}
            className={cn('h-full rounded-full', config.barClass)}
          />
        </div>
      )}
    </div>
  );
}

export default WaitTimeBadge;

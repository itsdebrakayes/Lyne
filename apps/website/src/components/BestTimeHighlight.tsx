/**
 * BestTimeHighlight.tsx
 *
 * Visual "Best Time to Visit" callout card.
 * Shown on the Branch detail page and the BestTime page.
 * Uses a gradient glow to draw attention — the "wow moment" element.
 */
import React from 'react';
import { cn } from '@/lib/utils';

interface BestTimeHighlightProps {
  branchName: string;
  bestDay: string;
  bestHour: string;
  bestMonth?: string;
  expectedWaitMinutes: number;
  peakHour?: string;
  className?: string;
  compact?: boolean;
}

export const BestTimeHighlight: React.FC<BestTimeHighlightProps> = ({
  branchName,
  bestDay,
  bestHour,
  bestMonth,
  expectedWaitMinutes,
  peakHour,
  className,
  compact = false,
}) => {
  const waitLabel = expectedWaitMinutes < 5
    ? 'Under 5 min'
    : expectedWaitMinutes < 15
    ? `~${expectedWaitMinutes} min`
    : `~${expectedWaitMinutes} min`;

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border',
      'bg-gradient-to-br from-emerald-950/60 via-teal-950/40 to-transparent',
      'border-emerald-500/20',
      compact ? 'p-4' : 'p-6',
      className,
    )}>
      {/* Glow effect */}
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-teal-500/8 rounded-full blur-xl pointer-events-none" />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🕐</span>
          <span className={cn(
            'font-semibold text-emerald-300',
            compact ? 'text-xs uppercase tracking-wider' : 'text-sm uppercase tracking-wider',
          )}>
            Best Time to Visit
          </span>
        </div>

        {/* Main prediction */}
        <div className={cn('mb-3', compact ? 'space-y-0.5' : 'space-y-1')}>
          <p className={cn('font-bold text-white leading-tight', compact ? 'text-base' : 'text-xl')}>
            {bestDay}s at {bestHour}
            {bestMonth && <span className="text-white/60 font-normal"> in {bestMonth}</span>}
          </p>
          <p className={cn('text-white/50', compact ? 'text-xs' : 'text-sm')}>
            {branchName}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4">
          <div className={cn(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5',
            'bg-emerald-500/15 border border-emerald-500/20',
          )}>
            <span className="text-emerald-400 text-xs">⏱</span>
            <span className="text-emerald-300 font-semibold text-sm">{waitLabel}</span>
            <span className="text-emerald-400/60 text-xs">expected wait</span>
          </div>

          {peakHour && !compact && (
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <span>📈</span>
              <span>Peak: {peakHour}</span>
            </div>
          )}
        </div>

        {!compact && (
          <p className="mt-3 text-xs text-white/30 leading-relaxed">
            Predicted by the Q ME NOW analytics engine using historical queue data.
          </p>
        )}
      </div>
    </div>
  );
};

// Loading skeleton for BestTimeHighlight
export const BestTimeHighlightSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn(
    'rounded-2xl border border-white/10 bg-white/5 p-6 animate-pulse',
    className,
  )}>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-5 h-5 rounded bg-white/10" />
      <div className="h-3 w-32 rounded bg-white/10" />
    </div>
    <div className="h-7 w-48 rounded bg-white/10 mb-2" />
    <div className="h-4 w-32 rounded bg-white/10 mb-4" />
    <div className="h-8 w-36 rounded-lg bg-white/10" />
  </div>
);

export default BestTimeHighlight;

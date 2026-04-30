/**
 * SkeletonLoaders.tsx
 *
 * Reusable skeleton loading states for all major UI sections.
 * Matches the glassmorphic design system — dark background, subtle shimmer.
 */
import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ── Base glass skeleton wrapper ───────────────────────────────
const GlassSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <Skeleton className={cn('bg-white/8 rounded-xl', className)} />
);

// ── Business / Branch card skeleton ──────────────────────────
export const BusinessCardSkeleton: React.FC = () => (
  <div className="w-[280px] h-[380px] rounded-2xl flex-shrink-0 bg-white/5 border border-white/10 p-6 flex flex-col gap-4 animate-pulse">
    <GlassSkeleton className="w-16 h-16 rounded-xl" />
    <GlassSkeleton className="h-6 w-3/4" />
    <GlassSkeleton className="h-4 w-full" />
    <GlassSkeleton className="h-4 w-5/6" />
    <div className="mt-auto flex gap-2">
      <GlassSkeleton className="h-8 flex-1 rounded-lg" />
      <GlassSkeleton className="h-8 w-8 rounded-lg" />
    </div>
  </div>
);

// ── Stat card skeleton (used in dashboards) ───────────────────
export const StatCardSkeleton: React.FC = () => (
  <div className="rounded-xl bg-white/5 border border-white/10 p-5 flex flex-col gap-3 animate-pulse">
    <div className="flex items-center justify-between">
      <GlassSkeleton className="h-4 w-24" />
      <GlassSkeleton className="h-8 w-8 rounded-lg" />
    </div>
    <GlassSkeleton className="h-8 w-20" />
    <GlassSkeleton className="h-3 w-32" />
  </div>
);

// ── Queue list item skeleton ──────────────────────────────────
export const QueueItemSkeleton: React.FC = () => (
  <div className="rounded-xl bg-white/5 border border-white/10 p-4 flex items-center gap-4 animate-pulse">
    <GlassSkeleton className="w-10 h-10 rounded-full flex-shrink-0" />
    <div className="flex-1 flex flex-col gap-2">
      <GlassSkeleton className="h-4 w-32" />
      <GlassSkeleton className="h-3 w-20" />
    </div>
    <GlassSkeleton className="h-7 w-20 rounded-full" />
    <GlassSkeleton className="h-8 w-24 rounded-lg" />
  </div>
);

// ── Table row skeleton ────────────────────────────────────────
export const TableRowSkeleton: React.FC<{ cols?: number }> = ({ cols = 5 }) => (
  <tr className="animate-pulse">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <GlassSkeleton className={cn('h-4', i === 0 ? 'w-8' : i === 1 ? 'w-28' : 'w-16')} />
      </td>
    ))}
  </tr>
);

// ── Chart / analytics skeleton ────────────────────────────────
export const ChartSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn('rounded-xl bg-white/5 border border-white/10 p-5 animate-pulse', className)}>
    <div className="flex items-center justify-between mb-4">
      <GlassSkeleton className="h-5 w-36" />
      <GlassSkeleton className="h-7 w-24 rounded-lg" />
    </div>
    <div className="flex items-end gap-2 h-32">
      {[60, 80, 45, 90, 70, 55, 85, 40, 75, 65, 50, 95].map((h, i) => (
        <GlassSkeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%` }} />
      ))}
    </div>
  </div>
);

// ── Ticket page skeleton ──────────────────────────────────────
export const TicketPageSkeleton: React.FC = () => (
  <div className="min-h-screen bg-background flex items-center justify-center p-6">
    <div className="w-full max-w-md rounded-2xl bg-white/5 border border-white/10 p-8 flex flex-col gap-6 animate-pulse">
      <div className="text-center flex flex-col gap-3">
        <GlassSkeleton className="h-6 w-40 mx-auto" />
        <GlassSkeleton className="h-24 w-24 rounded-full mx-auto" />
        <GlassSkeleton className="h-8 w-32 mx-auto" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-white/5 p-4 flex flex-col gap-2">
          <GlassSkeleton className="h-3 w-16" />
          <GlassSkeleton className="h-6 w-10" />
        </div>
        <div className="rounded-xl bg-white/5 p-4 flex flex-col gap-2">
          <GlassSkeleton className="h-3 w-20" />
          <GlassSkeleton className="h-6 w-14" />
        </div>
      </div>
      <GlassSkeleton className="h-10 w-full rounded-xl" />
    </div>
  </div>
);

// ── Dashboard header skeleton ─────────────────────────────────
export const DashboardHeaderSkeleton: React.FC = () => (
  <div className="flex items-center justify-between mb-6 animate-pulse">
    <div className="flex flex-col gap-2">
      <GlassSkeleton className="h-7 w-48" />
      <GlassSkeleton className="h-4 w-64" />
    </div>
    <GlassSkeleton className="h-10 w-32 rounded-xl" />
  </div>
);

// ── Full dashboard skeleton (4 stat cards + chart) ───────────
export const DashboardSkeleton: React.FC = () => (
  <div className="flex flex-col gap-6">
    <DashboardHeaderSkeleton />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
    </div>
    <ChartSkeleton className="h-64" />
    <div className="flex flex-col gap-2">
      {Array.from({ length: 5 }).map((_, i) => <QueueItemSkeleton key={i} />)}
    </div>
  </div>
);

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchRecommendations } from '@/lib/api/insights';
import { useStaffRole } from '@/hooks/useStaffRole';
import { Skeleton } from '@/components/ui/skeleton';
import { Lightbulb, Sparkles } from 'lucide-react';

interface AIRecommendationsProps {
  className?: string;
}

export function AIRecommendations({ className }: AIRecommendationsProps) {
  const { staffData } = useStaffRole();
  const organizationId = staffData?.organization_id;

  const { data: recommendations, isLoading } = useQuery({
    queryKey: ['recommendations', organizationId],
    queryFn: () => fetchRecommendations(organizationId!),
    enabled: !!organizationId,
  });

  if (isLoading) {
    return (
      <div className={className}>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className={`glass rounded-xl p-6 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">AI Recommendations</h3>
        </div>
        <div className="text-center py-6 text-muted-foreground">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No recommendations available yet.</p>
          <p className="text-sm mt-1">Run the analytics notebook to generate insights.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-xl p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">AI Recommendations</h3>
      </div>
      
      <div className="space-y-3">
        {recommendations.map((recommendation, index) => (
          <div 
            key={index}
            className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
              {index + 1}
            </div>
            <p className="text-sm text-foreground leading-relaxed">
              {recommendation}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Generated from historical data analysis
      </p>
    </div>
  );
}

import * as React from 'react';
import { 
  TrendingUp, TrendingDown, Clock, Users, 
  AlertTriangle, Sparkles, Calendar, Monitor,
  ArrowRight, Zap, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Insight {
  type: 'positive' | 'negative' | 'neutral' | 'warning';
  title: string;
  description: string;
  metric?: string;
  change?: number;
  icon?: React.ReactNode;
}

interface AIInsightsPanelProps {
  organizationName?: string;
  className?: string;
}

export function AIInsightsPanel({ organizationName = 'Your Organization', className }: AIInsightsPanelProps) {
  // Generate AI insights based on mock data
  const insights: Insight[] = [
    {
      type: 'negative',
      title: 'Peak Drop-off Rate Up',
      description: 'Customer abandonment increased during 11AM-1PM rush hours.',
      metric: '+18%',
      change: 18,
      icon: <TrendingUp className="w-5 h-5" />
    },
    {
      type: 'positive',
      title: 'Counter 3 - Fastest Service',
      description: 'Averaging 8.2 min per customer, 35% faster than average.',
      metric: '8.2 min',
      change: -35,
      icon: <Zap className="w-5 h-5" />
    },
    {
      type: 'warning',
      title: 'Counter 6 - Needs Attention',
      description: 'Service time 22.4 min avg, causing queue bottleneck.',
      metric: '22.4 min',
      change: 45,
      icon: <AlertTriangle className="w-5 h-5" />
    },
    {
      type: 'neutral',
      title: 'Best Time: 2nd Friday, 9AM',
      description: 'Historically lowest wait times for TRN Services.',
      icon: <Calendar className="w-5 h-5" />
    },
    {
      type: 'positive',
      title: 'Staff Efficiency Improving',
      description: 'Overall service completion rate up this week.',
      metric: '+12%',
      change: -12,
      icon: <Target className="w-5 h-5" />
    }
  ];

  const getInsightStyles = (type: Insight['type']) => {
    switch (type) {
      case 'positive':
        return {
          bg: 'bg-status-light/10 border-status-light/30',
          icon: 'text-status-light',
          badge: 'bg-status-light/20 text-status-light'
        };
      case 'negative':
        return {
          bg: 'bg-status-busy/10 border-status-busy/30',
          icon: 'text-status-busy',
          badge: 'bg-status-busy/20 text-status-busy'
        };
      case 'warning':
        return {
          bg: 'bg-status-moderate/10 border-status-moderate/30',
          icon: 'text-status-moderate',
          badge: 'bg-status-moderate/20 text-status-moderate'
        };
      default:
        return {
          bg: 'bg-primary/10 border-primary/30',
          icon: 'text-primary',
          badge: 'bg-primary/20 text-primary'
        };
    }
  };

  return (
    <div className={cn('glass rounded-xl p-6', className)}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">AI-Driven Insights</h3>
          <p className="text-sm text-muted-foreground">Real-time recommendations for {organizationName}</p>
        </div>
      </div>

      <div className="space-y-3">
        {insights.map((insight, index) => {
          const styles = getInsightStyles(insight.type);
          return (
            <div
              key={index}
              className={cn(
                'p-4 rounded-xl border transition-all duration-200 hover:shadow-md cursor-pointer group',
                styles.bg
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg bg-background/50', styles.icon)}>
                    {insight.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-foreground">{insight.title}</h4>
                      {insight.metric && (
                        <Badge variant="outline" className={cn('text-xs font-bold', styles.badge)}>
                          {insight.metric}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
        <div className="flex items-center gap-3">
          <Monitor className="w-5 h-5 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">
              💡 Recommendation: Add 2 staff to Counter 6 during peak hours (11AM-1PM)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This could reduce wait times by up to 40% and decrease drop-off rate.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

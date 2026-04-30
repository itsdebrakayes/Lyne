import * as React from 'react';
import { cn } from '@/lib/utils';
import { 
  FileText, 
  CreditCard, 
  Users, 
  ClipboardList, 
  Briefcase, 
  HelpCircle,
  Building2,
  Car,
  Home,
  Shield,
  Check,
  LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Tables } from '@/integrations/supabase/types';

type Service = Tables<'services'>;

const iconMap: Record<string, LucideIcon> = {
  'file-text': FileText,
  'credit-card': CreditCard,
  'users': Users,
  'clipboard-list': ClipboardList,
  'briefcase': Briefcase,
  'help-circle': HelpCircle,
  'building-2': Building2,
  'car': Car,
  'home': Home,
  'shield': Shield,
};

interface ServiceCardProps {
  service: Service;
  queueLength?: number;
  estimatedWait?: number;
  onJoin: () => void;
  isSelected?: boolean;
  className?: string;
}

export const ServiceCard = ({ 
  service, 
  queueLength = 0, 
  estimatedWait = 0, 
  onJoin,
  isSelected = false,
  className 
}: ServiceCardProps) => {
  const Icon = iconMap[service.icon || ''] || HelpCircle;
  const serviceColor = service.color || 'hsl(var(--primary))';

  // Features list for the card
  const features = [
    `${queueLength} ${queueLength === 1 ? 'person' : 'people'} in queue`,
    `Avg. service: ~${service.base_avg_time_minutes || 5} min`,
    'Priority support available',
  ];

  return (
    <div 
      className={cn(
        "relative rounded-3xl p-6 flex flex-col h-full transition-all duration-300",
        "bg-card/60 backdrop-blur-xl",
        "border border-white/10",
        "hover:border-white/20 hover:scale-[1.02]",
        isSelected && "ring-2 ring-primary border-primary/50",
        className
      )}
      style={{
        boxShadow: isSelected 
          ? `0 0 30px ${serviceColor}30, inset 0 0 30px rgba(255,255,255,0.03)`
          : 'inset 0 0 30px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.2)',
      }}
    >
      {/* Service icon & name */}
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="p-2.5 rounded-xl"
          style={{ 
            backgroundColor: `${serviceColor}20`,
          }}
        >
          <Icon 
            className="w-5 h-5" 
            style={{ color: serviceColor }}
          />
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {service.name}
        </span>
      </div>

      {/* Wait time - large display like pricing */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-foreground">
            ~{estimatedWait}
          </span>
          <span className="text-lg text-muted-foreground">/min</span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          estimated wait time
        </p>
      </div>

      {/* Features list with checkmarks */}
      <ul className="space-y-3 flex-1 mb-6">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
              <Check className="w-3 h-3 text-muted-foreground" />
            </div>
            <span className="text-sm text-muted-foreground">{feature}</span>
          </li>
        ))}
      </ul>

      {/* Join button */}
      <Button 
        onClick={onJoin}
        className="w-full bg-foreground text-background hover:bg-foreground/90 font-medium py-5"
      >
        Join Queue
      </Button>
    </div>
  );
};

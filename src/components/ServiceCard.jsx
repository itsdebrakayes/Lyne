import React from 'react';
import { cn } from '@/lib/utils';
import { CircularProgress } from './CircularProgress';
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
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const iconMap = {
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

export const ServiceCard = ({ 
  service, 
  queueLength = 0, 
  estimatedWait = 0, 
  onJoin,
  className 
}) => {
  const Icon = iconMap[service.icon] || HelpCircle;
  const maxWait = 60; // 60 minutes max for circular progress
  const waitPercentage = Math.min((estimatedWait / maxWait) * 100, 100);
  
  const serviceColor = service.color || 'hsl(var(--primary))';

  return (
    <div className={cn(
      "glass rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 hover:scale-[1.02]",
      className
    )}>
      {/* Header with icon and service name */}
      <div className="flex items-start gap-3">
        <div 
          className="p-3 rounded-xl"
          style={{ 
            backgroundColor: `${serviceColor}20`,
          }}
        >
          <Icon 
            className="w-6 h-6" 
            style={{ color: serviceColor }}
          />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-foreground">
            {service.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {queueLength} {queueLength === 1 ? 'person' : 'people'}
          </p>
        </div>
      </div>

      {/* Wait time with circular progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CircularProgress 
            value={waitPercentage} 
            size={50}
            strokeWidth={4}
            color={serviceColor}
          />
          <div>
            <p className="text-xs text-muted-foreground">Est. Wait</p>
            <p className="text-lg font-semibold text-foreground">
              ~{estimatedWait} min
            </p>
          </div>
        </div>
      </div>

      {/* Join button */}
      <Button 
        onClick={onJoin}
        className="w-full bg-foreground text-background hover:bg-foreground/90"
      >
        Join Queue
      </Button>
    </div>
  );
};

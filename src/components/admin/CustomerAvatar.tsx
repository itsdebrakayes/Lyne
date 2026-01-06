import * as React from 'react';
import { cn } from '@/lib/utils';
import { getCustomerInitials } from '@/types/customer';

interface CustomerAvatarProps {
  name: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg'
};

export function CustomerAvatar({ name, size = 'md', className }: CustomerAvatarProps) {
  const initials = getCustomerInitials(name);

  return (
    <div 
      className={cn(
        'rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary',
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}

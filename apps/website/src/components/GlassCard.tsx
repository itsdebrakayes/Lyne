import * as React from 'react';
import { cn } from "@/lib/utils";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  ticket?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const GlassCard = ({ children, className, hover = false, ticket = false, onClick, style }: GlassCardProps) => {
  return (
    <div
      className={cn(
        "rounded-lg",
        ticket ? "glass-ticket" : "glass",
        hover && "glass-hover cursor-pointer",
        className
      )}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
};

export default GlassCard;

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  ticket?: boolean;
  onClick?: () => void;
}

export const GlassCard = ({ children, className, hover = false, ticket = false, onClick }: GlassCardProps) => {
  return (
    <div
      className={cn(
        "rounded-lg",
        ticket ? "glass-ticket" : "glass",
        hover && "glass-hover cursor-pointer",
        className
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

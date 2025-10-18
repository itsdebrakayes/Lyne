import { cn } from "@/lib/utils";

export const GlassCard = ({ children, className, hover = false, ticket = false, onClick, style }) => {
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

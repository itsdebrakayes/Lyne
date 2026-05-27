/**
 * AnimatedStats — Animated counting stats for the hero section
 * Uses framer-motion useInView + spring animation
 */
import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';

interface StatItemProps {
  value: number;
  suffix?: string;
  label: string;
  delay?: number;
  icon?: React.ReactNode;
  className?: string;
}

function useCountUp(target: number, duration = 2000, start = false) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const startValue = 0;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
      else setCount(target);
    };

    requestAnimationFrame(step);
  }, [target, duration, start]);

  return count;
}

export function StatItem({ value, suffix = '', label, delay = 0, icon, className }: StatItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const count = useCountUp(value, 1800, inView);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
      }}
      className={cn(
        'glass rounded-2xl p-5 text-center',
        'hover:scale-105 transition-transform duration-300 cursor-default',
        'border border-white/20 dark:border-white/10',
        className
      )}
    >
      {icon && (
        <div className="flex justify-center mb-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-primary/20 flex items-center justify-center text-primary">
            {icon}
          </div>
        </div>
      )}
      <div className="text-3xl sm:text-4xl font-black text-foreground queue-number">
        {count.toLocaleString()}{suffix}
      </div>
      <div className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">{label}</div>
    </motion.div>
  );
}

interface AnimatedStatsProps {
  className?: string;
}

export function AnimatedStats({ className }: AnimatedStatsProps) {
  return (
    <div className={cn('grid grid-cols-3 gap-4', className)}>
      <StatItem value={1000} suffix="+" label="Daily Users" delay={0} />
      <StatItem value={24} suffix="/7" label="Live Updates" delay={0.1} />
      <StatItem value={100} suffix="%" label="Secure" delay={0.2} />
    </div>
  );
}

export default AnimatedStats;

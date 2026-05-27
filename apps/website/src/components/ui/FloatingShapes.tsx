/**
 * FloatingShapes — Premium animated background element
 * Inspired by 21st.dev Magic MCP "Shape Landing Hero" component
 * Uses framer-motion for smooth floating animations
 */
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ShapeProps {
  className?: string;
  delay?: number;
  width?: number;
  height?: number;
  rotate?: number;
  gradient?: string;
  duration?: number;
}

function ElegantShape({
  className,
  delay = 0,
  width = 300,
  height = 80,
  rotate = 0,
  gradient = 'from-sky-400/[0.08]',
  duration = 12,
}: ShapeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -120, rotate: rotate - 15 }}
      animate={{ opacity: 1, y: 0, rotate }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={cn('absolute pointer-events-none', className)}
    >
      <motion.div
        animate={{ y: [0, 15, 0] }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{ width, height }}
        className="relative"
      >
        <div
          className={cn(
            'absolute inset-0 rounded-full',
            'bg-gradient-to-r to-transparent',
            gradient,
            'backdrop-blur-[2px] border-2 border-white/[0.12]',
            'shadow-[0_8px_32px_0_rgba(56,189,248,0.08)]',
            'after:absolute after:inset-0 after:rounded-full',
            'after:bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.12),transparent_70%)]'
          )}
        />
      </motion.div>
    </motion.div>
  );
}

interface FloatingShapesProps {
  className?: string;
}

export function FloatingShapes({ className }: FloatingShapesProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 overflow-hidden pointer-events-none',
        className
      )}
    >
      {/* Large shape — top right */}
      <ElegantShape
        delay={0.3}
        width={500}
        height={120}
        rotate={-15}
        gradient="from-sky-400/[0.07]"
        duration={14}
        className="top-[8%] right-[-8%]"
      />

      {/* Medium shape — top left */}
      <ElegantShape
        delay={0.5}
        width={350}
        height={90}
        rotate={20}
        gradient="from-blue-500/[0.06]"
        duration={11}
        className="top-[20%] left-[-5%]"
      />

      {/* Small shape — center right */}
      <ElegantShape
        delay={0.7}
        width={200}
        height={60}
        rotate={-8}
        gradient="from-cyan-400/[0.08]"
        duration={9}
        className="top-[45%] right-[5%]"
      />

      {/* Large shape — bottom left */}
      <ElegantShape
        delay={0.4}
        width={420}
        height={100}
        rotate={12}
        gradient="from-indigo-400/[0.06]"
        duration={16}
        className="bottom-[15%] left-[-6%]"
      />

      {/* Small accent — bottom right */}
      <ElegantShape
        delay={0.9}
        width={180}
        height={50}
        rotate={-20}
        gradient="from-sky-300/[0.09]"
        duration={10}
        className="bottom-[8%] right-[12%]"
      />

      {/* Tiny accent — mid left */}
      <ElegantShape
        delay={1.1}
        width={140}
        height={40}
        rotate={35}
        gradient="from-blue-400/[0.07]"
        duration={8}
        className="top-[60%] left-[8%]"
      />
    </div>
  );
}

export default FloatingShapes;

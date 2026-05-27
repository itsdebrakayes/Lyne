/**
 * LiveQueueDisplay — Premium animated queue number display
 * Features: flip number animation, live pulse indicator, countdown timer
 * Inspired by 21st.dev Magic MCP FlipCountdown + ShiftingCountdown components
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ── Flip Digit ── */
interface FlipDigitProps {
  digit: string;
  className?: string;
}

function FlipDigit({ digit, className }: FlipDigitProps) {
  const [current, setCurrent] = useState(digit);
  const [prev, setPrev] = useState(digit);
  const [flipping, setFlipping] = useState(false);

  useEffect(() => {
    if (digit !== current) {
      setPrev(current);
      setCurrent(digit);
      setFlipping(true);
    }
  }, [digit, current]);

  return (
    <div
      className={cn(
        'relative w-[1ch] overflow-hidden',
        'font-mono font-bold tabular-nums',
        className
      )}
      style={{ perspective: '400px' }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={digit}
          initial={{ rotateX: -90, opacity: 0 }}
          animate={{ rotateX: 0, opacity: 1 }}
          exit={{ rotateX: 90, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 0.86, 0.39, 0.96] }}
          onAnimationComplete={() => setFlipping(false)}
          className="block"
          style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

/* ── Animated Number ── */
interface AnimatedNumberProps {
  value: number;
  className?: string;
  padTo?: number;
}

export function AnimatedNumber({ value, className, padTo = 3 }: AnimatedNumberProps) {
  const digits = String(value).padStart(padTo, '0').split('');

  return (
    <div className={cn('flex items-center', className)}>
      {digits.map((d, i) => (
        <FlipDigit key={i} digit={d} className="text-inherit" />
      ))}
    </div>
  );
}

/* ── Live Dot ── */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex items-center gap-1.5', className)}>
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      </span>
      <span className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider">
        Live
      </span>
    </span>
  );
}

/* ── Countdown Timer ── */
interface CountdownTimerProps {
  totalSeconds: number;
  className?: string;
}

export function CountdownTimer({ totalSeconds, className }: CountdownTimerProps) {
  const [seconds, setSeconds] = useState(totalSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setSeconds(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSeconds(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  const minDigits = String(mins).padStart(2, '0').split('');
  const secDigits = String(secs).padStart(2, '0').split('');

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="flex items-center">
        {minDigits.map((d, i) => (
          <FlipDigit key={`m${i}`} digit={d} className="text-inherit" />
        ))}
      </div>
      <motion.span
        animate={{ opacity: [1, 0, 1] }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="font-bold"
      >
        :
      </motion.span>
      <div className="flex items-center">
        {secDigits.map((d, i) => (
          <FlipDigit key={`s${i}`} digit={d} className="text-inherit" />
        ))}
      </div>
    </div>
  );
}

/* ── Queue Position Indicator ── */
interface QueuePositionProps {
  position: number;
  total?: number;
  className?: string;
}

export function QueuePosition({ position, total, className }: QueuePositionProps) {
  const isNext = position === 1;
  const progress = total ? Math.max(0, Math.min(100, ((total - position + 1) / total) * 100)) : 0;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Position number */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Position in Queue</span>
        <span className="text-sm font-semibold text-foreground">
          {position} {total ? `of ${total}` : ''}
        </span>
      </div>

      {/* Progress bar */}
      {total && (
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: [0.23, 0.86, 0.39, 0.96] }}
            className={cn(
              'h-full rounded-full',
              isNext
                ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                : 'bg-gradient-to-r from-sky-400 to-blue-600'
            )}
          />
          {/* Glow effect */}
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.2, ease: [0.23, 0.86, 0.39, 0.96] }}
            className={cn(
              'absolute top-0 h-full rounded-full blur-sm opacity-60',
              isNext
                ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                : 'bg-gradient-to-r from-sky-400 to-blue-600'
            )}
          />
        </div>
      )}

      {/* "You're next" indicator */}
      {isNext && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/10 border border-green-500/30"
        >
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
          </div>
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
            You're next! Please be ready.
          </span>
        </motion.div>
      )}
    </div>
  );
}

/* ── Main Live Queue Display Card ── */
interface LiveQueueDisplayProps {
  ticketNumber: number | string;
  position?: number;
  totalInQueue?: number;
  estimatedWaitSeconds?: number;
  serviceName?: string;
  branchName?: string;
  status?: 'waiting' | 'in_service' | 'served' | 'cancelled' | 'left';
  className?: string;
}

export function LiveQueueDisplay({
  ticketNumber,
  position = 1,
  totalInQueue,
  estimatedWaitSeconds = 0,
  serviceName,
  branchName,
  status = 'waiting',
  className,
}: LiveQueueDisplayProps) {
  const isServing = status === 'in_service';
  const isDone = ['served', 'cancelled', 'left'].includes(status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.23, 0.86, 0.39, 0.96] }}
      className={cn(
        'relative overflow-hidden rounded-3xl',
        'ticket-card-premium',
        className
      )}
    >
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(56,189,248,1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(56,189,248,1) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 p-8 text-white">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            {serviceName && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="text-sky-200 text-sm font-medium uppercase tracking-widest mb-1"
              >
                {serviceName}
              </motion.p>
            )}
            {branchName && (
              <motion.p
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-white/70 text-xs"
              >
                {branchName}
              </motion.p>
            )}
          </div>
          <LiveDot />
        </div>

        {/* Ticket Number */}
        <div className="text-center mb-8">
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-white/60 text-xs uppercase tracking-[0.3em] mb-3"
          >
            Your Ticket Number
          </motion.p>

          <div
            className={cn(
              'flex items-center justify-center',
              isServing && 'animate-glow-pulse'
            )}
          >
            <AnimatedNumber
              value={typeof ticketNumber === 'string' ? parseInt(ticketNumber) || 0 : ticketNumber}
              padTo={3}
              className="text-7xl sm:text-8xl font-black text-white queue-number tracking-tight"
            />
          </div>
        </div>

        {/* Status + Wait */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Position */}
          <div className="glass-dark rounded-2xl p-4 text-center">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Position</p>
            <AnimatedNumber
              value={position}
              padTo={1}
              className="text-3xl font-bold text-white justify-center"
            />
            <p className="text-white/40 text-xs mt-1">in queue</p>
          </div>

          {/* Wait time */}
          <div className="glass-dark rounded-2xl p-4 text-center">
            <p className="text-white/50 text-xs uppercase tracking-wider mb-1">Est. Wait</p>
            {estimatedWaitSeconds > 0 ? (
              <CountdownTimer
                totalSeconds={estimatedWaitSeconds}
                className="text-3xl font-bold text-white justify-center"
              />
            ) : (
              <p className="text-3xl font-bold text-white">—</p>
            )}
            <p className="text-white/40 text-xs mt-1">remaining</p>
          </div>
        </div>

        {/* Progress */}
        {totalInQueue && (
          <QueuePosition
            position={position}
            total={totalInQueue}
            className="text-white/80"
          />
        )}

        {/* Serving state */}
        <AnimatePresence>
          {isServing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 flex items-center justify-center gap-3 px-4 py-3 rounded-2xl bg-green-500/20 border border-green-400/40"
            >
              <div className="pulse-ring-container w-4 h-4 rounded-full bg-green-400" />
              <span className="text-green-300 font-semibold text-sm">
                It's your turn! Please proceed to the counter.
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom decorative line */}
      <div className="h-1 w-full bg-gradient-to-r from-transparent via-sky-400/60 to-transparent animate-border-glow" />
    </motion.div>
  );
}

export default LiveQueueDisplay;

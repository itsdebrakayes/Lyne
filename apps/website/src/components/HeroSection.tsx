/**
 * HeroSection — Premium animated hero for Q ME NOW landing page
 * Features:
 *  - Floating geometric shapes (21st.dev Magic inspired)
 *  - Animated gradient text
 *  - Staggered entrance animations (framer-motion)
 *  - Mesh gradient background
 *  - Animated CTA buttons with glow
 *  - Live stats counter
 */
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Zap, Clock, Shield, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FloatingShapes } from '@/components/ui/FloatingShapes';
import { StatItem } from '@/components/ui/AnimatedStats';
import { cn } from '@/lib/utils';

const fadeUpVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      delay: 0.1 + i * 0.15,
      ease: [0.23, 0.86, 0.39, 0.96],
    },
  }),
};

interface HeroSectionProps {
  heroImage?: string;
}

export function HeroSection({ heroImage }: HeroSectionProps) {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden mesh-bg">
      {/* Floating shapes background */}
      <FloatingShapes />

      {/* Radial gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.08),transparent)] pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">

          {/* ── Left Content ── */}
          <div className="space-y-8">

            {/* Badge */}
            <motion.div
              custom={0}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="inline-flex"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest border border-sky-400/30 bg-sky-400/10 text-sky-600 dark:text-sky-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                </span>
                Real-Time Queue Management
              </span>
            </motion.div>

            {/* Headline */}
            <div className="space-y-2">
              <motion.h1
                custom={1}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight text-foreground"
              >
                Skip the Line.
              </motion.h1>
              <motion.h1
                custom={2}
                variants={fadeUpVariants}
                initial="hidden"
                animate="visible"
                className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-black leading-[1.05] tracking-tight"
              >
                <span className="gradient-text-blue">Join Smarter.</span>
              </motion.h1>
            </div>

            {/* Subheadline */}
            <motion.p
              custom={3}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-lg"
            >
              Q ME NOW gives you real-time queue visibility, predictive wait times, and instant
              notifications — so you never waste time waiting in line again.
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              custom={4}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col sm:flex-row gap-4"
            >
              <Button
                size="lg"
                onClick={() => navigate('/directory')}
                className={cn(
                  'btn-glow relative overflow-hidden',
                  'bg-gradient-to-r from-sky-500 to-blue-600',
                  'hover:from-sky-400 hover:to-blue-500',
                  'text-white font-semibold text-base px-8 py-6 rounded-2xl',
                  'shadow-lg shadow-sky-500/30',
                  'border-0 transition-all duration-300'
                )}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Find a Queue
                  <ArrowRight className="w-4 h-4" />
                </span>
                {/* Shimmer effect */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-700" />
              </Button>

              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/about')}
                className={cn(
                  'glass border-white/30 dark:border-white/15',
                  'hover:bg-white/10 dark:hover:bg-white/5',
                  'text-foreground font-semibold text-base px-8 py-6 rounded-2xl',
                  'transition-all duration-300 hover:scale-105'
                )}
              >
                Learn More
              </Button>
            </motion.div>

            {/* Stats */}
            <motion.div
              custom={5}
              variants={fadeUpVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-3 gap-3 pt-2"
            >
              <StatItem
                value={1000}
                suffix="+"
                label="Daily Users"
                delay={0.6}
                icon={<Zap className="w-5 h-5" />}
              />
              <StatItem
                value={24}
                suffix="/7"
                label="Live Updates"
                delay={0.7}
                icon={<Clock className="w-5 h-5" />}
              />
              <StatItem
                value={100}
                suffix="%"
                label="Secure"
                delay={0.8}
                icon={<Shield className="w-5 h-5" />}
              />
            </motion.div>
          </div>

          {/* ── Right Content — Hero Image ── */}
          <div className="relative hidden lg:block">
            {/* Glow behind image */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, delay: 0.4, ease: [0.23, 0.86, 0.39, 0.96] }}
              className="absolute -inset-8 bg-gradient-to-br from-sky-400/15 via-blue-500/10 to-indigo-500/15 rounded-3xl blur-3xl"
            />

            {heroImage && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1, delay: 0.5, ease: [0.23, 0.86, 0.39, 0.96] }}
                className="relative"
              >
                <motion.img
                  src={heroImage}
                  alt="Q ME NOW — intelligent queue management interface"
                  className="relative w-full h-auto max-w-2xl xl:max-w-3xl ml-auto object-contain drop-shadow-2xl"
                  animate={{ y: [0, -12, 0] }}
                  transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
                />
              </motion.div>
            )}

            {/* Floating mini-cards */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.0, duration: 0.6 }}
              className="absolute top-[15%] -left-8 glass rounded-2xl p-4 shadow-xl border border-white/20 dark:border-white/10 min-w-[160px]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Queue #042</p>
                  <p className="text-xs text-muted-foreground">~8 min wait</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 0.6 }}
              className="absolute bottom-[20%] -right-4 glass rounded-2xl p-4 shadow-xl border border-white/20 dark:border-white/10 min-w-[180px]"
            >
              <p className="text-xs text-muted-foreground mb-1">Best time to visit</p>
              <p className="text-sm font-bold text-foreground">Tuesday 10:00 AM</p>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '75%' }}
                  transition={{ delay: 1.5, duration: 1 }}
                  className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full"
                />
              </div>
            </motion.div>
          </div>

          {/* Mobile Hero Image */}
          {heroImage && (
            <div className="lg:hidden fixed bottom-0 right-0 w-[55%] max-w-xs pointer-events-none z-0">
              <img
                src={heroImage}
                alt="Q ME NOW"
                className="w-full h-auto object-contain opacity-20"
              />
            </div>
          )}
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-muted-foreground uppercase tracking-widest">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </motion.div>
    </section>
  );
}

export default HeroSection;

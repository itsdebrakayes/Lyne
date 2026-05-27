/**
 * Home — Q ME NOW Landing Page
 * Premium UI v3.0 — UI/UX Pro Max + 21st.dev Magic MCP
 */
import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRef } from 'react';
import {
  ArrowRight, Zap, Clock, Shield, MapPin, Bell,
  BarChart3, ChevronRight, Star, Users, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/Navbar';
import { FloatingShapes } from '@/components/ui/FloatingShapes';
import { StatItem } from '@/components/ui/AnimatedStats';
import heroImage from '@/assets/hero-image.png';
import { cn } from '@/lib/utils';
import { useInView } from 'framer-motion';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, delay: 0.05 + i * 0.12, ease: [0.23, 0.86, 0.39, 0.96] },
  }),
};

const cardVariant = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.23, 0.86, 0.39, 0.96] } },
};

function FeatureCard({ icon, title, description, gradient, delay = 0 }: {
  icon: React.ReactNode; title: string; description: string; gradient: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'}
      variants={cardVariant} transition={{ delay }}
      className="tilt-card glass rounded-2xl p-6 group cursor-default border border-white/20 dark:border-white/8">
      <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110', gradient)}>
        {icon}
      </div>
      <h3 className="text-lg font-bold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}

function Step({ number, title, description, delay = 0 }: {
  number: number; title: string; description: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, x: -20 }} animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.23, 0.86, 0.39, 0.96] }} className="flex gap-5 items-start">
      <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-sky-500/30">
        {number}
      </div>
      <div>
        <h4 className="font-bold text-foreground mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

const Home = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen">
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden mesh-bg">
        <FloatingShapes />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.07),transparent)] pointer-events-none" />

        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="space-y-8 z-10">
              <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible" className="inline-flex">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest border border-sky-400/30 bg-sky-400/10 text-sky-600 dark:text-sky-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                  </span>
                  Real-Time Queue Management
                </span>
              </motion.div>

              <div className="space-y-1">
                <motion.h1 custom={1} variants={fadeUp} initial="hidden" animate="visible"
                  className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black leading-[1.05] tracking-tight text-foreground">
                  Skip the Line.
                </motion.h1>
                <motion.h1 custom={2} variants={fadeUp} initial="hidden" animate="visible"
                  className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-black leading-[1.05] tracking-tight">
                  <span className="gradient-text-blue">Join Smarter.</span>
                </motion.h1>
              </div>

              <motion.p custom={3} variants={fadeUp} initial="hidden" animate="visible"
                className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-lg">
                Q ME NOW gives you real-time queue visibility, predictive wait times, and instant
                notifications — so you never waste time waiting in line again.
              </motion.p>

              <motion.div custom={4} variants={fadeUp} initial="hidden" animate="visible"
                className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" onClick={() => navigate('/directory')}
                  className="btn-glow relative overflow-hidden group bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold text-base px-8 py-6 rounded-2xl shadow-lg shadow-sky-500/30 border-0 transition-all duration-300">
                  <span className="relative z-10 flex items-center gap-2">
                    Find a Queue
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate('/about')}
                  className="glass border-border/50 hover:bg-white/10 dark:hover:bg-white/5 text-foreground font-semibold text-base px-8 py-6 rounded-2xl transition-all duration-300 hover:scale-105">
                  Learn More
                </Button>
              </motion.div>

              <motion.div custom={5} variants={fadeUp} initial="hidden" animate="visible"
                className="grid grid-cols-3 gap-3 pt-2">
                <StatItem value={1000} suffix="+" label="Daily Users" delay={0.6} icon={<Zap className="w-5 h-5" />} />
                <StatItem value={24} suffix="/7" label="Live Updates" delay={0.7} icon={<Clock className="w-5 h-5" />} />
                <StatItem value={100} suffix="%" label="Secure" delay={0.8} icon={<Shield className="w-5 h-5" />} />
              </motion.div>
            </div>

            {/* Right — Hero Image */}
            <div className="relative hidden lg:block">
              <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, delay: 0.4, ease: [0.23, 0.86, 0.39, 0.96] }}
                className="absolute -inset-8 bg-gradient-to-br from-sky-400/12 via-blue-500/8 to-indigo-500/12 rounded-3xl blur-3xl" />
              <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1, delay: 0.5, ease: [0.23, 0.86, 0.39, 0.96] }} className="relative">
                <motion.img src={heroImage} alt="Q ME NOW — intelligent queue management interface"
                  className="relative w-full h-auto max-w-2xl xl:max-w-3xl ml-auto object-contain drop-shadow-2xl"
                  animate={{ y: [0, -12, 0] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
              </motion.div>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.0, duration: 0.6 }}
                className="absolute top-[15%] -left-8 glass rounded-2xl p-4 shadow-xl border border-white/20 dark:border-white/10 min-w-[160px]">
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
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                className="absolute bottom-[20%] -right-4 glass rounded-2xl p-4 shadow-xl border border-white/20 dark:border-white/10 min-w-[180px]">
                <p className="text-xs text-muted-foreground mb-1">Best time to visit</p>
                <p className="text-sm font-bold text-foreground">Tuesday 10:00 AM</p>
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: '75%' }}
                    transition={{ delay: 1.5, duration: 1 }}
                    className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full" />
                </div>
              </motion.div>
            </div>

            <div className="lg:hidden fixed bottom-0 right-0 w-[55%] max-w-xs pointer-events-none z-0">
              <img src={heroImage} alt="Q ME NOW" className="w-full h-auto object-contain opacity-20" />
            </div>
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Scroll</span>
          <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ChevronRight className="w-4 h-4 text-muted-foreground rotate-90" />
          </motion.div>
        </motion.div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-24 bg-background/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_100%,rgba(56,189,248,0.04),transparent)] pointer-events-none" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-500 dark:text-sky-400 mb-3">
              Why Q ME NOW
            </motion.p>
            <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
              transition={{ delay: 0.1 }} className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground">
              Everything You Need to{' '}<span className="gradient-text-blue">Queue Smarter</span>
            </motion.h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={<Zap className="w-6 h-6 text-white" />} title="Real-Time Updates" description="Watch your queue position update live. No refreshing, no guessing — just accurate, instant data." gradient="bg-gradient-to-br from-sky-500 to-blue-600" delay={0} />
            <FeatureCard icon={<MapPin className="w-6 h-6 text-white" />} title="Multi-Branch Support" description="Find the nearest branch, compare wait times across locations, and choose the fastest option." gradient="bg-gradient-to-br from-violet-500 to-purple-600" delay={0.05} />
            <FeatureCard icon={<Bell className="w-6 h-6 text-white" />} title="Smart Notifications" description="Get notified when you're approaching the front. Never miss your turn, even when you step away." gradient="bg-gradient-to-br from-amber-500 to-orange-600" delay={0.1} />
            <FeatureCard icon={<BarChart3 className="w-6 h-6 text-white" />} title="Predictive Analytics" description="AI-powered predictions show you the best day and time to visit — before you even leave home." gradient="bg-gradient-to-br from-emerald-500 to-teal-600" delay={0.15} />
            <FeatureCard icon={<Users className="w-6 h-6 text-white" />} title="Intake Forms" description="Fill out your service form digitally while you wait. Arrive prepared, get served faster." gradient="bg-gradient-to-br from-rose-500 to-pink-600" delay={0.2} />
            <FeatureCard icon={<TrendingUp className="w-6 h-6 text-white" />} title="Performance Insights" description="Businesses get deep analytics on peak hours, service times, and staff performance trends." gradient="bg-gradient-to-br from-cyan-500 to-sky-600" delay={0.25} />
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 mesh-bg relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <motion.p initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-500 dark:text-sky-400 mb-3">
                How It Works
              </motion.p>
              <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                transition={{ delay: 0.1 }} className="text-3xl sm:text-4xl font-black text-foreground mb-10">
                From Search to{' '}<span className="gradient-text-blue">Served</span>{' '}in Minutes
              </motion.h2>
              <div className="space-y-8">
                <Step number={1} title="Find Your Business" description="Search for a business or browse the top-rated services near you." delay={0.1} />
                <Step number={2} title="Select a Branch" description="Pick the most convenient location and see real-time wait times." delay={0.2} />
                <Step number={3} title="Join the Queue" description="Fill out your intake form digitally and get your ticket number instantly." delay={0.3} />
                <Step number={4} title="Track and Get Notified" description="Monitor your position live and receive alerts when you're almost up." delay={0.4} />
              </div>
            </div>

            {/* Decorative ticket */}
            <div className="relative hidden lg:flex items-center justify-center">
              <motion.div initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
                whileInView={{ opacity: 1, scale: 1, rotate: 0 }} viewport={{ once: true }}
                transition={{ duration: 0.8, ease: [0.23, 0.86, 0.39, 0.96] }}
                className="relative w-full max-w-sm">
                <div className="absolute -inset-4 bg-gradient-to-br from-sky-400/20 to-blue-600/20 rounded-3xl blur-2xl" />
                <div className="relative ticket-card-premium p-8 text-white">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-sky-200 text-xs uppercase tracking-widest font-semibold">Tax Administration Jamaica</p>
                      <p className="text-white/60 text-xs mt-0.5">Half Way Tree Branch</p>
                    </div>
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                    </span>
                  </div>
                  <div className="text-center mb-6">
                    <p className="text-white/50 text-xs uppercase tracking-[0.3em] mb-2">Your Ticket</p>
                    <p className="text-8xl font-black queue-number text-white">042</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/10 rounded-2xl p-3 text-center">
                      <p className="text-white/50 text-xs mb-1">Position</p>
                      <p className="text-2xl font-bold">3</p>
                    </div>
                    <div className="bg-white/10 rounded-2xl p-3 text-center">
                      <p className="text-white/50 text-xs mb-1">Est. Wait</p>
                      <p className="text-2xl font-bold">12:00</p>
                    </div>
                  </div>
                  <div className="mt-4 h-1 w-full bg-gradient-to-r from-transparent via-sky-400/60 to-transparent animate-border-glow rounded-full" />
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/8 via-blue-600/6 to-indigo-600/8 pointer-events-none" />
        <FloatingShapes className="opacity-50" />
        <div className="relative z-10 container mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.7 }} className="max-w-2xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-sky-400/30 bg-sky-400/10 text-sky-600 dark:text-sky-400 text-xs font-semibold uppercase tracking-widest">
              <Star className="w-3.5 h-3.5" />
              Join Thousands of Users
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-foreground">
              Ready to{' '}<span className="gradient-text-blue">Stop Waiting?</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Join Q ME NOW today and experience the future of queue management.
              Real-time updates, smart predictions, and zero time wasted.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" onClick={() => navigate('/directory')}
                className="btn-glow relative overflow-hidden group bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-semibold text-lg px-10 py-7 rounded-2xl shadow-xl shadow-sky-500/30 border-0 transition-all duration-300">
                <span className="relative z-10 flex items-center gap-2">
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
                </span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/join-us')}
                className="glass border-border/50 text-foreground font-semibold text-lg px-10 py-7 rounded-2xl transition-all duration-300 hover:scale-105">
                Register Your Business
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default Home;

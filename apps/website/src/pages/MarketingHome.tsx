/**
 * QMe Now — Luxury Marketing Landing Page
 * Design: Liquid Glass · OLED Black · Bodoni Moda × Jost · Gold #CA8A04
 * Animations: Morphing golden sphere · Radial orbital timeline · Container scroll · Liquid glass cards
 */
import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useInView, AnimatePresence } from 'framer-motion';
import {
  Smartphone, Monitor, CheckCircle2, Apple, Play, Globe,
  X, Menu, Mail, ChevronRight, ArrowDown, Users, Clock,
  BarChart3, Zap, ShieldCheck, Bell, Star,
} from 'lucide-react';

const GOLD = '#CA8A04';
const GOLD_LIGHT = '#D4AF37';
const BG = '#080706';
const EASE_LUX = [0.22, 1, 0.36, 1] as const;

// ─── Morphing Golden Sphere ──────────────────────────────────────────────────
function GoldenSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;
    let t = 0;
    const resize = () => {
      const s = Math.min(canvas.parentElement!.clientWidth, 520);
      canvas.width = canvas.height = s;
      canvas.style.width = canvas.style.height = `${s}px`;
    };
    resize();
    const draw = () => {
      const s = canvas.width;
      const cx = s / 2, cy = s / 2;
      ctx.clearRect(0, 0, s, s);
      // Outer ambient glow
      const grd0 = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.52);
      grd0.addColorStop(0, 'rgba(202,138,4,0.12)');
      grd0.addColorStop(0.6, 'rgba(212,175,55,0.04)');
      grd0.addColorStop(1, 'rgba(202,138,4,0)');
      ctx.fillStyle = grd0;
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.52, 0, Math.PI * 2); ctx.fill();
      // Draw morph rings
      for (let ring = 0; ring < 5; ring++) {
        const rScale = 0.25 + ring * 0.06;
        const r = s * rScale;
        const pts = 80;
        ctx.beginPath();
        for (let i = 0; i <= pts; i++) {
          const angle = (i / pts) * Math.PI * 2;
          const noise = 0.035 * Math.sin(3 * angle + t * 0.7 + ring * 1.1)
                      + 0.02 * Math.sin(5 * angle - t * 0.4 + ring * 0.6)
                      + 0.015 * Math.sin(7 * angle + t * 1.1 + ring * 2.2);
          const rr = r * (1 + noise);
          const x = cx + rr * Math.cos(angle);
          const y = cy + rr * Math.sin(angle);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        const alpha = 0.55 - ring * 0.08;
        const grd = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
        grd.addColorStop(0, `rgba(202,138,4,${alpha})`);
        grd.addColorStop(0.4, `rgba(212,175,55,${alpha * 0.7})`);
        grd.addColorStop(0.7, `rgba(245,197,24,${alpha * 0.5})`);
        grd.addColorStop(1, `rgba(202,138,4,${alpha * 0.3})`);
        ctx.strokeStyle = grd;
        ctx.lineWidth = 1 + (4 - ring) * 0.4;
        ctx.stroke();
      }
      // Inner sphere fill
      const grd2 = ctx.createRadialGradient(cx - s * 0.07, cy - s * 0.09, 0, cx, cy, s * 0.28);
      grd2.addColorStop(0, 'rgba(245,197,24,0.22)');
      grd2.addColorStop(0.4, 'rgba(202,138,4,0.12)');
      grd2.addColorStop(1, 'rgba(202,138,4,0.03)');
      ctx.fillStyle = grd2;
      ctx.beginPath(); ctx.arc(cx, cy, s * 0.28, 0, Math.PI * 2); ctx.fill();
      t += 0.012;
      raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener('resize', resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={canvasRef} className="w-full h-full" />;
}

// ─── Radial Orbital Timeline ──────────────────────────────────────────────────
const HOW_DATA = [
  { id: 1, icon: '01', title: 'Find', detail: 'Search businesses near you or scan a QR code. No account needed.', relatedIds: [2] },
  { id: 2, icon: '02', title: 'Join', detail: 'Select your service and receive your digital ticket instantly.', relatedIds: [1, 3] },
  { id: 3, icon: '03', title: 'Arrive', detail: "We notify you when it's your turn. Walk in — never wait in line.", relatedIds: [2] },
];

function OrbitalTimeline() {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let angle = 0;
    const tick = () => {
      if (activeId === null) { angle += 0.2; setRotation(angle % 360); }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [activeId]);

  const getPos = (i: number, total: number) => {
    const a = ((i / total) * 360 + rotation - 90) * (Math.PI / 180);
    const r = 160;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  };

  return (
    <div className="relative flex items-center justify-center" style={{ height: 420 }}>
      {/* Orbit ring */}
      <div className="absolute w-80 h-80 rounded-full" style={{ border: '1px solid rgba(212,175,55,0.12)' }} />
      <div className="absolute w-64 h-64 rounded-full" style={{ border: '1px solid rgba(212,175,55,0.06)' }} />

      {/* Center orb */}
      <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute z-10 w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.25), rgba(202,138,4,0.08) 60%, transparent)', border: '1px solid rgba(212,175,55,0.3)' }}>
        <div className="w-3 h-3 rounded-full" style={{ background: GOLD_LIGHT, boxShadow: `0 0 16px ${GOLD}` }} />
      </motion.div>

      {/* Nodes */}
      {HOW_DATA.map((item, i) => {
        const pos = getPos(i, HOW_DATA.length);
        const isActive = activeId === item.id;
        return (
          <div key={item.id} className="absolute" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
            <motion.button
              onClick={() => setActiveId(isActive ? null : item.id)}
              whileHover={{ scale: 1.1 }}
              className="relative w-14 h-14 rounded-full flex items-center justify-center -translate-x-1/2 -translate-y-1/2 cursor-pointer"
              style={{
                background: isActive ? `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isActive ? GOLD_LIGHT : 'rgba(212,175,55,0.2)'}`,
                boxShadow: isActive ? `0 0 32px rgba(202,138,4,0.4)` : 'none',
                transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
              }}>
              <span className="font-display text-sm font-bold" style={{ color: isActive ? BG : GOLD_LIGHT }}>{item.icon}</span>
              {isActive && <><div className="pulse-ring" /><div className="pulse-ring-2" /></>}
            </motion.button>

            {/* Label */}
            <div className="absolute text-center" style={{ width: 80, left: -33, top: 60 }}>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: isActive ? GOLD_LIGHT : 'rgba(245,240,232,0.4)', transition: 'color 0.3s' }}>
                {item.title}
              </p>
            </div>

            {/* Detail card */}
            <AnimatePresence>
              {isActive && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.85, y: 8 }}
                  transition={{ duration: 0.35, ease: EASE_LUX }}
                  className="absolute z-20 w-52 glass rounded-xl p-4"
                  style={{ top: 72, left: '50%', transform: 'translateX(-50%)' }}>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(245,240,232,0.65)' }}>{item.detail}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// ─── Container Scroll ────────────────────────────────────────────────────────
function ContainerScroll({ children, title }: { children: React.ReactNode; title: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref });
  const rotateX = useTransform(scrollYProgress, [0, 1], [18, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.88, 1]);
  const titleY = useTransform(scrollYProgress, [0, 0.5], [0, -60]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);

  return (
    <div ref={ref} className="relative flex items-start justify-center" style={{ height: '140vh' }}>
      <div className="sticky top-12 w-full" style={{ perspective: '1200px' }}>
        <motion.div style={{ y: titleY, opacity: titleOpacity }} className="text-center mb-10 px-5">
          {title}
        </motion.div>
        <motion.div style={{ rotateX, scale, transformOrigin: 'top center' }}>
          {children}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Scroll Reveal ────────────────────────────────────────────────────────────
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.div ref={ref} initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: EASE_LUX }}
      className={className}>
      {children}
    </motion.div>
  );
}

// ─── Gold Counter ─────────────────────────────────────────────────────────────
function GoldCounter({ to, suffix = '', label }: { to: number; suffix?: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = to / 70;
    const t = setInterval(() => {
      start += step;
      if (start >= to) { setCount(to); clearInterval(t); }
      else setCount(Math.floor(start));
    }, 18);
    return () => clearInterval(t);
  }, [inView, to]);
  return (
    <div ref={ref} className="text-center">
      <div className="font-display gold-text" style={{ fontSize: 'clamp(2.5rem,5vw,4rem)', lineHeight: 1, letterSpacing: '-0.02em' }}>
        {count.toLocaleString()}{suffix}
      </div>
      <div className="mt-2 text-xs uppercase tracking-widest font-medium" style={{ color: 'rgba(245,240,232,0.38)', letterSpacing: '0.12em' }}>
        {label}
      </div>
    </div>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: Zap,         title: 'Instant Ticketing',    body: 'Join any queue in seconds. Digital ticket issued immediately, no sign-up required.' },
  { icon: Bell,        title: 'Precision Alerts',     body: 'Notified at exactly the right moment. Never early, never late.' },
  { icon: BarChart3,   title: 'Predictive Analytics', body: 'AI forecasts peak hours and recommends optimal staffing before bottlenecks form.' },
  { icon: Users,       title: 'Multi-Branch Scale',   body: 'Manage unlimited queues and locations from a single command centre.' },
  { icon: ShieldCheck, title: 'Enterprise Security',  body: 'End-to-end encrypted tickets, role-based access, and full audit trails.' },
  { icon: Globe,       title: 'Everywhere Access',    body: 'Mobile app, web portal, desktop — all synchronised in real time.' },
];

// ─── Main ────────────────────────────────────────────────────────────────────
export default function MarketingHome() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const navOpacity = useTransform(scrollY, [0, 60], [0, 1]);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: BG, fontFamily: "'Jost', system-ui, sans-serif", color: '#F5F0E8' }}>

      {/* ── Floating Nav ── */}
      <div className="fixed top-0 inset-x-0 z-50 flex justify-center pt-4 pointer-events-none">
        <motion.nav
          style={{ opacity: navOpacity }}
          className="absolute inset-x-0 top-0 pointer-events-none"
          initial={false}>
          <div className="absolute inset-0" style={{ background: `rgba(8,7,6,0.85)`, backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(212,175,55,0.08)' }} />
        </motion.nav>
        <div className="relative pointer-events-auto w-full max-w-6xl mx-4 flex items-center justify-between h-16">
          {/* Logo */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}
            className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}>
              <span className="font-display font-bold text-xs" style={{ color: BG }}>Q</span>
            </div>
            <span className="font-display font-bold tracking-tight text-sm" style={{ color: '#F5F0E8' }}>
              QMe <span className="gold-text">Now</span>
            </span>
          </motion.div>

          {/* Desktop links */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="hidden md:flex items-center gap-8">
            {['Features', 'How it Works', 'Download'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`}
                className="text-xs font-semibold uppercase tracking-widest transition-colors duration-300"
                style={{ color: 'rgba(245,240,232,0.45)', letterSpacing: '0.1em' }}
                onMouseEnter={e => (e.currentTarget.style.color = GOLD_LIGHT)}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,240,232,0.45)')}>
                {l}
              </a>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="hidden md:flex items-center gap-3">
            <a href="#download" className="text-xs font-semibold uppercase tracking-widest transition-colors duration-300"
              style={{ color: 'rgba(245,240,232,0.35)', letterSpacing: '0.1em' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#F5F0E8')}
              onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,240,232,0.35)')}>
              Download
            </a>
            <a href="/join-us" className="btn-gold text-xs px-5 py-2.5 rounded-lg">
              Request a Quote
            </a>
          </motion.div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2" style={{ color: 'rgba(245,240,232,0.6)' }}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="fixed top-16 inset-x-0 z-40 px-5 pb-4 space-y-3"
            style={{ background: 'rgba(8,7,6,0.97)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
            {['Features', 'How it Works', 'Download'].map(l => (
              <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} onClick={() => setMenuOpen(false)}
                className="block py-2.5 text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'rgba(245,240,232,0.5)', letterSpacing: '0.1em' }}>{l}</a>
            ))}
            <a href="/join-us" className="btn-gold block text-center text-xs px-5 py-3 rounded-lg">Request a Quote</a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
        {/* Scan line effect */}
        <motion.div animate={{ y: ['-100%', '100vh'] }} transition={{ duration: 8, repeat: Infinity, ease: 'linear', repeatDelay: 4 }}
          className="absolute inset-x-0 h-px z-0 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(212,175,55,0.15), transparent)' }} />

        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(212,175,55,1) 1px, transparent 1px), linear-gradient(90deg, rgba(212,175,55,1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <div className="relative z-10 max-w-6xl mx-auto px-5 w-full grid lg:grid-cols-2 gap-16 items-center py-20">
          {/* Left copy */}
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE_LUX }}
              className="inline-flex items-center gap-2.5 mb-8">
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full" style={{ background: '#4ade80' }} />
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(245,240,232,0.4)', letterSpacing: '0.14em' }}>
                Live Queue Management
              </span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.1, ease: EASE_LUX }}
              className="font-display leading-[1.04] tracking-tight mb-6"
              style={{ fontSize: 'clamp(3rem,6vw,5.5rem)', fontWeight: 600, letterSpacing: '-0.02em' }}>
              Wait Less.
              <br />
              <span className="gold-text">Live More.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.25, ease: EASE_LUX }}
              className="text-lg leading-relaxed mb-10 max-w-md"
              style={{ color: 'rgba(245,240,232,0.45)', fontWeight: 300 }}>
              QMe Now transforms how businesses and customers experience queuing. Frictionless digital ticketing, real-time intelligence, and enterprise-grade reliability.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.38, ease: EASE_LUX }}
              className="flex flex-wrap gap-3 mb-10">
              <a href="#download" className="btn-gold text-xs px-7 py-3.5 rounded-xl flex items-center gap-2">
                Get the App <ChevronRight size={14} />
              </a>
              <a href="/join-us"
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest px-7 py-3.5 rounded-xl transition-all duration-400"
                style={{ border: '1px solid rgba(212,175,55,0.2)', color: 'rgba(245,240,232,0.55)', letterSpacing: '0.1em' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.45)'; e.currentTarget.style.color = GOLD_LIGHT; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.2)'; e.currentTarget.style.color = 'rgba(245,240,232,0.55)'; }}>
                <Mail size={14} /> Request a Quote
              </a>
            </motion.div>

            {/* Trust line */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
              className="flex items-center gap-3">
              <div className="flex -space-x-1.5">
                {['#CA8A04', '#D4AF37', '#4ade80', '#60a5fa'].map((c, i) => (
                  <div key={i} className="w-6 h-6 rounded-full" style={{ background: c, border: `2px solid ${BG}` }} />
                ))}
              </div>
              <p className="text-xs" style={{ color: 'rgba(245,240,232,0.3)' }}>
                <span style={{ color: 'rgba(245,240,232,0.65)' }}>2,400+</span> customers served today
              </p>
            </motion.div>
          </div>

          {/* Right sphere */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, delay: 0.2, ease: EASE_LUX }}
            className="flex items-center justify-center">
            <div className="relative w-full max-w-[420px] aspect-square">
              <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(202,138,4,0.08) 0%, transparent 70%)' }} />
              <GoldenSphere />
            </div>
          </motion.div>
        </div>

        <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 2.5, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          style={{ color: 'rgba(245,240,232,0.2)' }}>
          <span className="text-[10px] uppercase tracking-[0.2em]">Scroll</span>
          <ArrowDown size={12} />
        </motion.div>
      </section>

      {/* ── Stats ── */}
      <section className="py-24 relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent, rgba(202,138,4,0.03) 50%, transparent)' }} />
        <div className="max-w-4xl mx-auto px-5 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <GoldCounter to={50000} suffix="+" label="Customers Served" />
            <GoldCounter to={200}   suffix="+"  label="Businesses" />
            <GoldCounter to={99}    suffix="%"  label="Uptime" />
            <GoldCounter to={8}     suffix="m"  label="Avg Wait Saved" />
          </div>
        </div>
      </section>

      {/* ── Container Scroll — Dashboard Preview ── */}
      <section className="relative px-5">
        <ContainerScroll
          title={
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest mb-3 font-semibold" style={{ color: GOLD, letterSpacing: '0.14em' }}>Executive View</p>
              <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
                Command-grade intelligence
              </h2>
              <p className="mt-4 max-w-xl mx-auto text-base" style={{ color: 'rgba(245,240,232,0.4)', fontWeight: 300 }}>
                Every metric, every branch, every trend — visible at a glance.
              </p>
            </div>
          }>
          {/* Dashboard mockup */}
          <div className="max-w-5xl mx-auto mx-px-4 rounded-2xl overflow-hidden"
            style={{ border: '1px solid rgba(212,175,55,0.18)', background: 'rgba(8,7,6,0.95)' }}>
            {/* Titlebar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(212,175,55,0.08)', background: 'rgba(255,255,255,0.02)' }}>
              {['#ff5f57','#febc2e','#28c840'].map(c => <div key={c} className="w-3 h-3 rounded-full" style={{ background: c }} />)}
              <div className="flex-1 mx-4 h-5 rounded" style={{ background: 'rgba(255,255,255,0.04)', maxWidth: 200 }} />
            </div>
            {/* Content */}
            <div className="p-6 grid grid-cols-4 gap-4">
              {[['1,842', 'Served Today', GOLD_LIGHT], ['8m', 'Avg Wait', '#4ade80'], ['24', 'Active Queues', '#60a5fa'], ['4.8★', 'Satisfaction', GOLD]].map(([v, l, c]) => (
                <div key={l} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.08)' }}>
                  <div className="font-display text-2xl font-semibold mb-1" style={{ color: c as string }}>{v}</div>
                  <div className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(245,240,232,0.3)' }}>{l}</div>
                </div>
              ))}
              <div className="col-span-3 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.08)' }}>
                <div className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'rgba(245,240,232,0.3)' }}>Queue Activity — 7 Days</div>
                <div className="flex items-end gap-1.5 h-20">
                  {[45, 72, 58, 91, 68, 88, 76].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm transition-all" style={{ height: `${h}%`, background: `linear-gradient(to top, ${GOLD}, ${GOLD_LIGHT})`, opacity: 0.6 + i * 0.06 }} />
                  ))}
                </div>
              </div>
              <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.08)' }}>
                <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: 'rgba(245,240,232,0.3)' }}>Services</div>
                {[['General', 38], ['Premium', 24], ['Express', 38]].map(([n, v]) => (
                  <div key={n} className="mb-1.5">
                    <div className="flex justify-between text-[10px] mb-0.5">
                      <span style={{ color: 'rgba(245,240,232,0.5)' }}>{n}</span>
                      <span style={{ color: GOLD_LIGHT }}>{v}%</span>
                    </div>
                    <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full" style={{ width: `${v}%`, background: `linear-gradient(90deg, ${GOLD}, ${GOLD_LIGHT})` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ContainerScroll>
      </section>

      {/* ── How it Works — Orbital Timeline ── */}
      <section id="how-it-works" className="py-28 px-5 relative">
        <div className="max-w-4xl mx-auto">
          <Reveal className="text-center mb-4">
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: GOLD, letterSpacing: '0.14em' }}>Process</p>
          </Reveal>
          <Reveal delay={0.1} className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Three steps.<br />Infinite time saved.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <OrbitalTimeline />
          </Reveal>
          <Reveal delay={0.3} className="text-center mt-8">
            <p className="text-xs uppercase tracking-widest" style={{ color: 'rgba(245,240,232,0.28)', letterSpacing: '0.12em' }}>
              Click each node to explore
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 px-5">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-4">
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: GOLD, letterSpacing: '0.14em' }}>Capabilities</p>
          </Reveal>
          <Reveal delay={0.1} className="text-center mb-14">
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Built without compromise
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.06}>
                <div className="group liquid-glass liquid-glass-hover rounded-2xl p-6 cursor-default">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-5 transition-all duration-400"
                    style={{ background: 'rgba(202,138,4,0.08)', color: GOLD }}
                    onMouseEnter={() => {}} /* handled by group */
                  >
                    <f.icon size={17} />
                  </div>
                  <h3 className="text-sm font-semibold mb-2 uppercase tracking-wide" style={{ letterSpacing: '0.06em', color: '#F5F0E8' }}>{f.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(245,240,232,0.4)', lineHeight: 1.75 }}>{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products ── */}
      <section className="py-24 px-5 relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent, rgba(202,138,4,0.025) 50%, transparent)' }} />
        <div className="max-w-6xl mx-auto relative">
          <Reveal className="text-center mb-4">
            <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: GOLD, letterSpacing: '0.14em' }}>Two Products</p>
          </Reveal>
          <Reveal delay={0.1} className="text-center mb-14">
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>A complete ecosystem</h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Mobile */}
            <Reveal delay={0.1}>
              <div className="relative group liquid-glass liquid-glass-hover rounded-3xl p-8 overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-40 -translate-y-24 translate-x-16" style={{ background: 'radial-gradient(circle, rgba(202,138,4,0.15), transparent)' }} />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 mb-6 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: GOLD, letterSpacing: '0.12em', borderBottom: `1px solid ${GOLD}`, paddingBottom: 8 }}>
                    <Smartphone size={12} /> Mobile App
                  </div>
                  <h3 className="font-display text-2xl font-semibold mb-3" style={{ letterSpacing: '-0.01em' }}>For Customers</h3>
                  <p className="text-sm mb-6 leading-relaxed" style={{ color: 'rgba(245,240,232,0.4)', fontWeight: 300, lineHeight: 1.8 }}>
                    Join queues instantly. Track your position in real time. Get notified the moment it's your turn. iOS and Android.
                  </p>
                  {['Join any queue instantly', 'Live position tracking', 'Smart turn notifications', 'Queue history'].map(f => (
                    <div key={f} className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-1 h-1 rounded-full" style={{ background: GOLD_LIGHT }} />
                      <span className="text-xs" style={{ color: 'rgba(245,240,232,0.55)' }}>{f}</span>
                    </div>
                  ))}
                  <div className="flex gap-3 mt-8">
                    <a href="#download" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300"
                      style={{ background: '#F5F0E8', color: BG }}>
                      <Apple size={13} /> App Store
                    </a>
                    <a href="#download" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300"
                      style={{ border: '1px solid rgba(245,240,232,0.15)', color: 'rgba(245,240,232,0.6)' }}>
                      <Play size={13} /> Google Play
                    </a>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Desktop */}
            <Reveal delay={0.2}>
              <div className="relative group liquid-glass liquid-glass-hover rounded-3xl p-8 overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-40 -translate-y-24 translate-x-16" style={{ background: 'radial-gradient(circle, rgba(212,175,55,0.1), transparent)' }} />
                <div className="relative">
                  <div className="inline-flex items-center gap-2 mb-6 text-xs font-semibold uppercase tracking-widest"
                    style={{ color: GOLD_LIGHT, letterSpacing: '0.12em', borderBottom: `1px solid ${GOLD_LIGHT}40`, paddingBottom: 8 }}>
                    <Monitor size={12} /> Desktop Admin
                  </div>
                  <h3 className="font-display text-2xl font-semibold mb-3" style={{ letterSpacing: '-0.01em' }}>For Businesses</h3>
                  <p className="text-sm mb-6 leading-relaxed" style={{ color: 'rgba(245,240,232,0.4)', fontWeight: 300, lineHeight: 1.8 }}>
                    Purpose-built interfaces for three distinct roles. Staff serve faster. Managers control smarter. Executives see everything.
                  </p>
                  {['Staff — call next in one click', 'Manager — live queue control', 'Executive — AI-powered insights', 'All roles synchronised'].map(f => (
                    <div key={f} className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-1 h-1 rounded-full" style={{ background: GOLD }} />
                      <span className="text-xs" style={{ color: 'rgba(245,240,232,0.55)' }}>{f}</span>
                    </div>
                  ))}
                  <a href="/join-us" className="btn-gold inline-flex items-center gap-2 text-xs px-6 py-2.5 rounded-xl mt-8">
                    <Mail size={13} /> Contact Sales
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Download ── */}
      <section id="download" className="py-24 px-5 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(202,138,4,0.06) 0%, transparent 70%)' }} />
        <div className="max-w-4xl mx-auto relative">
          <Reveal className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: GOLD, letterSpacing: '0.14em' }}>Get Started</p>
            <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tight" style={{ letterSpacing: '-0.02em' }}>
              Ready when you are
            </h2>
          </Reveal>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Mobile download */}
            <Reveal delay={0.1}>
              <div className="liquid-glass rounded-3xl p-8">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, rgba(202,138,4,0.15), rgba(212,175,55,0.08))', border: '1px solid rgba(212,175,55,0.2)' }}>
                  <Smartphone size={22} style={{ color: GOLD_LIGHT }} />
                </div>
                <h3 className="font-display text-xl font-semibold mb-1" style={{ letterSpacing: '-0.01em' }}>Mobile App</h3>
                <p className="text-xs mb-1" style={{ color: 'rgba(245,240,232,0.4)' }}>For customers. Free to download.</p>
                <p className="text-[10px] uppercase tracking-widest mb-6 font-semibold" style={{ color: GOLD, letterSpacing: '0.12em' }}>iOS · Android</p>
                <div className="flex gap-3">
                  <a href="#" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 hover:-translate-y-0.5"
                    style={{ background: '#F5F0E8', color: BG }}>
                    <Apple size={13} /> App Store
                  </a>
                  <a href="#" className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-300 hover:-translate-y-0.5"
                    style={{ border: '1px solid rgba(245,240,232,0.15)', color: 'rgba(245,240,232,0.6)' }}>
                    <Play size={13} /> Play Store
                  </a>
                </div>
              </div>
            </Reveal>

            {/* Desktop licensing */}
            <Reveal delay={0.2}>
              <div className="liquid-glass rounded-3xl p-8"
                style={{ background: 'linear-gradient(135deg, rgba(202,138,4,0.07), rgba(212,175,55,0.03))', borderColor: 'rgba(212,175,55,0.18)' }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}>
                  <Monitor size={22} style={{ color: BG }} />
                </div>
                <h3 className="font-display text-xl font-semibold mb-1" style={{ letterSpacing: '-0.01em' }}>Desktop Admin</h3>
                <p className="text-xs mb-1" style={{ color: 'rgba(245,240,232,0.4)' }}>Enterprise licensing. Per-seat pricing.</p>
                <p className="text-[10px] uppercase tracking-widest mb-5 font-semibold" style={{ color: GOLD, letterSpacing: '0.12em' }}>Windows · macOS</p>
                {['All three admin role views', 'Unlimited queues & branches', 'AI analytics included', 'Priority onboarding support'].map(f => (
                  <div key={f} className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={11} style={{ color: GOLD }} />
                    <span className="text-xs" style={{ color: 'rgba(245,240,232,0.5)' }}>{f}</span>
                  </div>
                ))}
                <a href="mailto:hello@qmenow.com?subject=Desktop%20Licensing" className="btn-gold inline-flex items-center gap-2 text-xs px-6 py-2.5 rounded-xl mt-6">
                  <Mail size={13} /> Contact Us for Licensing
                </a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-12 px-5" style={{ borderTop: '1px solid rgba(212,175,55,0.08)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, ${GOLD_LIGHT})` }}>
              <span className="font-display font-bold text-xs" style={{ color: BG }}>Q</span>
            </div>
            <span className="font-display text-sm font-semibold" style={{ color: '#F5F0E8' }}>QMe <span className="gold-text">Now</span></span>
          </div>
          <div className="flex gap-8">
            {['Features', 'Privacy', 'Terms', 'Contact'].map(l => (
              <a key={l} href="#" className="text-[11px] uppercase tracking-widest transition-colors duration-300"
                style={{ color: 'rgba(245,240,232,0.25)', letterSpacing: '0.1em' }}
                onMouseEnter={e => (e.currentTarget.style.color = GOLD_LIGHT)}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(245,240,232,0.25)')}>
                {l}
              </a>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: 'rgba(245,240,232,0.18)' }}>© {new Date().getFullYear()} QMe Now</p>
        </div>
      </footer>
    </div>
  );
}

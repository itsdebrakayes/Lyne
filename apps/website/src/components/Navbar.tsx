/**
 * Navbar — Q ME NOW Premium Animated Navigation
 * Features: framer-motion layout animation, active indicator, scroll-aware header,
 *           tooltip labels, smooth icon transitions
 */
import * as React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Moon, Sun, Home, Info, Users, Building2, Shield, Menu, X } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Home',   path: '/',        icon: Home },
  { name: 'About',  path: '/about',   icon: Info },
  { name: 'Join Us',path: '/join-us', icon: Users },
  { name: 'TAJ',    path: '/taj',     icon: Building2 },
  { name: 'Admin',  path: '/admin',   icon: Shield },
];

export const Navbar = () => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const isActive = (path: string) =>
    path === '/admin' ? location.pathname.startsWith('/admin') : location.pathname === path;

  return (
    <>
      {/* ── Desktop: Vertical Left Sidebar ── */}
      <nav className="hidden lg:flex fixed left-6 top-1/2 -translate-y-1/2 z-50">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: [0.23, 0.86, 0.39, 0.96] }}
          className="glass rounded-2xl p-3 shadow-xl flex flex-col gap-2 border border-white/20 dark:border-white/10"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} className="group relative">
                <div className="relative p-3 rounded-xl transition-colors duration-200">
                  {/* Active background */}
                  {active && (
                    <motion.div
                      layoutId="nav-active-bg"
                      className="absolute inset-0 rounded-xl bg-primary"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  {/* Hover background */}
                  {!active && (
                    <div className="absolute inset-0 rounded-xl bg-primary/0 group-hover:bg-primary/10 transition-colors duration-200" />
                  )}
                  <Icon
                    className={cn(
                      'w-5 h-5 relative z-10 transition-colors duration-200',
                      active ? 'text-primary-foreground' : 'text-foreground/60 group-hover:text-primary'
                    )}
                  />
                </div>
                {/* Tooltip */}
                <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-foreground text-background text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none shadow-lg translate-x-1 group-hover:translate-x-0">
                  {item.name}
                </span>
              </Link>
            );
          })}

          <div className="h-px bg-border/50 my-1" />

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="group relative p-3 rounded-xl text-foreground/60 hover:text-primary hover:bg-primary/10 transition-all duration-200"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={theme}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </motion.div>
            </AnimatePresence>
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-foreground text-background text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none">
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
          </button>
        </motion.div>
      </nav>

      {/* ── Mobile & Tablet: Top Header ── */}
      <header
        className={cn(
          'lg:hidden fixed top-0 left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'bg-background/90 backdrop-blur-xl border-b border-border/50 shadow-sm'
            : 'bg-transparent'
        )}
      >
        <div className="flex items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
              <span className="text-white font-black text-xs">Q</span>
            </div>
            <span className="font-black text-foreground text-lg tracking-tight">Q ME NOW</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2 rounded-xl text-foreground/60 hover:text-primary hover:bg-primary/10 transition-all duration-200"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-xl text-foreground/60 hover:text-primary hover:bg-primary/10 transition-all duration-200"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={mobileOpen ? 'close' : 'open'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </motion.div>
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.23, 0.86, 0.39, 0.96] }}
              className="overflow-hidden bg-background/95 backdrop-blur-xl border-b border-border/50"
            >
              <div className="px-4 py-4 space-y-1">
                {navItems.map((item, i) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <motion.div
                      key={item.path}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.25 }}
                    >
                      <Link
                        to={item.path}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                          active
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground/70 hover:text-primary hover:bg-primary/10'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="font-semibold">{item.name}</span>
                        {active && (
                          <motion.div
                            layoutId="mobile-active-dot"
                            className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-foreground"
                          />
                        )}
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Mobile: Bottom Tab Bar ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 pb-safe">
        <div className="glass border-t border-white/20 dark:border-white/10 px-2 py-2">
          <div className="flex items-center justify-around max-w-md mx-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link key={item.path} to={item.path} className="relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all duration-200">
                  {active && (
                    <motion.div
                      layoutId="bottom-tab-active"
                      className="absolute inset-0 rounded-xl bg-primary/15"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'w-5 h-5 relative z-10 transition-colors duration-200',
                      active ? 'text-primary' : 'text-foreground/40'
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-semibold relative z-10 transition-colors duration-200',
                      active ? 'text-primary' : 'text-foreground/40'
                    )}
                  >
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
};

export default Navbar;

/**
 * Ticket — Q ME NOW Live Queue Ticket Page
 * Premium UI v3.0 — framer-motion + animated flip counter + live pulse
 */
import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Sun, Moon, MessageCircle, Users, Clock,
  Loader2, CheckCircle2, AlertCircle, Share2, Bell,
} from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { Button } from '@/components/ui/button';
import { LeaveQueueModal } from '@/components/LeaveQueueModal';
import { QueueStatusBadge } from '@/components/QueueStatusBadge';
import { TicketPageSkeleton } from '@/components/SkeletonLoaders';
import { ApiErrorState } from '@/components/EmptyState';
import { LiveQueueDisplay, AnimatedNumber, CountdownTimer, LiveDot } from '@/components/ui/LiveQueueDisplay';
import { useLiveQueuePosition } from '@/hooks/useLiveQueuePosition';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const Ticket = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const lineId = searchParams.get('line') || undefined;
  const { lineData, isLoading, error, leaveQueue, refetch } = useLiveQueuePosition(lineId);
  const [userData, setUserData] = useState({ fullName: 'Guest' });
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const prevStatus = useRef<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('userData');
    if (stored) { try { setUserData(JSON.parse(stored)); } catch { /* ignore */ } }
  }, []);

  // Toast on status change
  useEffect(() => {
    if (!lineData) return;
    const current = lineData.status;
    if (prevStatus.current && prevStatus.current !== current) {
      if (current === 'in_service') {
        toast.success("It's your turn! Please proceed to the counter.", { duration: 10000 });
      } else if (current === 'served') {
        toast.success('Service completed. Thank you for using Q ME NOW!', { duration: 6000 });
      } else if (current === 'left') {
        toast.error('You were marked as a no-show. Please rejoin if needed.', { duration: 8000 });
      }
    }
    prevStatus.current = current;
  }, [lineData?.status]);

  const estimatedWaitMinutes = lineData?.estimated_wait_minutes ?? 0;
  const [countdown, setCountdown] = useState(estimatedWaitMinutes * 60);
  useEffect(() => { setCountdown(estimatedWaitMinutes * 60); }, [estimatedWaitMinutes]);
  useEffect(() => {
    const timer = setInterval(() => { setCountdown(prev => Math.max(0, prev - 1)); }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  if (isLoading) return <TicketPageSkeleton />;
  if (error || !lineData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <ApiErrorState message={error || 'Ticket not found or queue has ended.'} onRetry={refetch} />
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={() => navigate(slug ? `/client/${slug}` : '/')}>Back to Services</Button>
          </div>
        </div>
      </div>
    );
  }

  const status = lineData.status as 'waiting' | 'in_service' | 'served' | 'cancelled' | 'left';
  const isBeingCalled = status === 'in_service';
  const isTerminal = ['served', 'cancelled', 'left'].includes(status);
  const peopleAhead = Math.max(0, (lineData.people_ahead ?? lineData.position - 1));
  const position = lineData.position ?? 1;

  return (
    <div className="min-h-screen bg-background mesh-bg">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="rounded-xl"
              onClick={() => navigate(slug ? `/client/${slug}` : '/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-bold text-foreground">Your Ticket</h1>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Q ME NOW</span>
                {!isTerminal && <LiveDot className="scale-75" />}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <QueueStatusBadge status={status} size="sm" />
            <Button variant="ghost" size="icon" className="rounded-xl"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <div className="space-y-6">

          {/* ── Terminal States ── */}
          <AnimatePresence>
            {status === 'served' && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="glass rounded-3xl p-8 text-center border border-green-500/30 bg-green-500/5">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </motion.div>
                <h2 className="text-2xl font-black text-foreground mb-2">Service Completed</h2>
                <p className="text-muted-foreground">Thank you for using Q ME NOW. We hope to see you again!</p>
              </motion.div>
            )}

            {(status === 'cancelled' || status === 'left') && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="glass rounded-3xl p-8 text-center border border-red-500/30 bg-red-500/5">
                <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-10 h-10 text-red-500" />
                </div>
                <h2 className="text-2xl font-black text-foreground mb-2">
                  {status === 'cancelled' ? 'Ticket Cancelled' : 'You Left the Queue'}
                </h2>
                <p className="text-muted-foreground">You can rejoin the queue from the services page.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Active Ticket ── */}
          {!isTerminal && (
            <>
              {/* Main ticket card */}
              <LiveQueueDisplay
                ticketNumber={lineData.ticket_number ?? lineData.position ?? 0}
                position={position}
                totalInQueue={lineData.total_in_queue}
                estimatedWaitSeconds={countdown}
                serviceName={lineData.service_name || lineData.services?.name || 'Service'}
                branchName={lineData.branch_name || 'Branch'}
                status={status}
              />

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-4">
                {/* People ahead */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass rounded-2xl p-5 text-center border border-white/20 dark:border-white/8">
                  <Users className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                  <AnimatedNumber value={peopleAhead} padTo={1}
                    className="text-3xl font-black text-foreground justify-center" />
                  <p className="text-xs text-muted-foreground mt-1">ahead of you</p>
                </motion.div>

                {/* Countdown */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass rounded-2xl p-5 text-center border border-white/20 dark:border-white/8">
                  <Clock className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                  <CountdownTimer totalSeconds={countdown}
                    className="text-3xl font-black text-foreground justify-center" />
                  <p className="text-xs text-muted-foreground mt-1">remaining</p>
                </motion.div>

                {/* Share */}
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="glass rounded-2xl p-5 text-center border border-white/20 dark:border-white/8 cursor-pointer hover:scale-105 transition-transform duration-200"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: 'Q ME NOW Ticket', text: `My queue ticket: #${lineData.ticket_number}`, url: window.location.href });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      toast.success('Link copied!');
                    }
                  }}>
                  <Share2 className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-bold text-foreground">Share</p>
                  <p className="text-xs text-muted-foreground mt-1">your ticket</p>
                </motion.div>
              </div>

              {/* Notification prompt */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="glass rounded-2xl p-4 flex items-center justify-between border border-sky-400/20 bg-sky-400/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-sky-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Enable Notifications</p>
                    <p className="text-xs text-muted-foreground">Get alerted when you're almost up</p>
                  </div>
                </div>
                <Button size="sm" variant="outline"
                  className="glass border-sky-400/30 text-sky-600 dark:text-sky-400 hover:bg-sky-400/10 rounded-xl text-xs"
                  onClick={() => {
                    if ('Notification' in window) {
                      Notification.requestPermission().then(p => {
                        if (p === 'granted') toast.success('Notifications enabled!');
                      });
                    }
                  }}>
                  Enable
                </Button>
              </motion.div>

              {/* Help */}
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="glass rounded-2xl p-5 flex items-center justify-between border border-white/20 dark:border-white/8">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Need Help?</p>
                    <p className="text-xs text-muted-foreground">Chat with our support team</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="glass rounded-xl text-xs">Open Chat</Button>
              </motion.div>

              {/* Live indicator */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                className="glass rounded-2xl p-4 text-center border border-white/20 dark:border-white/8">
                <p className="text-sm flex items-center justify-center gap-2 text-muted-foreground">
                  <LiveDot />
                  <span>Updates every 10 seconds</span>
                </p>
              </motion.div>
            </>
          )}

          {/* Action Buttons */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }} className="flex gap-4 justify-center pt-2">
            <Button variant="outline" className="glass rounded-2xl px-6"
              onClick={() => navigate(slug ? `/client/${slug}` : '/')}>
              Back to Services
            </Button>
            {!isTerminal && (
              <Button variant="destructive" className="rounded-2xl px-6"
                onClick={() => setShowLeaveModal(true)}
                disabled={isLeaving || isBeingCalled}>
                {isLeaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Leave Queue
              </Button>
            )}
          </motion.div>
        </div>
      </main>

      <LeaveQueueModal
        open={showLeaveModal}
        onOpenChange={setShowLeaveModal}
        onConfirm={async () => {
          setShowLeaveModal(false);
          setIsLeaving(true);
          const success = await leaveQueue();
          if (success) {
            toast.success('You have left the queue');
            navigate(slug ? `/client/${slug}` : '/');
          } else {
            toast.error('Failed to leave queue');
          }
          setIsLeaving(false);
        }}
      />
    </div>
  );
};

export default Ticket;

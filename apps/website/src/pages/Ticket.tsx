import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { ArrowLeft, Sun, Moon, MessageCircle, Users, Clock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { TicketDisplay } from '@/components/TicketDisplay';
import { CircularProgress } from '@/components/CircularProgress';
import { Button } from '@/components/ui/button';
import { LeaveQueueModal } from '@/components/LeaveQueueModal';
import { QueueStatusBadge } from '@/components/QueueStatusBadge';
import { TicketPageSkeleton } from '@/components/SkeletonLoaders';
import { ApiErrorState } from '@/components/EmptyState';
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
    if (stored) {
      try { setUserData(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  // Toast notification when status changes
  useEffect(() => {
    if (!lineData) return;
    const current = lineData.status;
    if (prevStatus.current && prevStatus.current !== current) {
      if (current === 'serving') {
        toast.success("🎉 It's your turn! Please proceed to the counter.", { duration: 10000 });
      } else if (current === 'completed') {
        toast.success('✅ Service completed. Thank you for using Q ME NOW!', { duration: 6000 });
      } else if (current === 'no_show') {
        toast.error('⚠️ You were marked as a no-show. Please rejoin if needed.', { duration: 8000 });
      }
    }
    prevStatus.current = current;
  }, [lineData?.status]);

  // Countdown timer
  const estimatedWaitMinutes = lineData?.estimated_wait_minutes ?? 0;
  const [countdown, setCountdown] = useState(estimatedWaitMinutes * 60);

  useEffect(() => {
    setCountdown(estimatedWaitMinutes * 60);
  }, [estimatedWaitMinutes]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  if (isLoading) return <TicketPageSkeleton />;

  if (error || !lineData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <ApiErrorState
            message={error || 'Ticket not found or queue has ended.'}
            onRetry={refetch}
          />
          <div className="mt-6 text-center">
            <Button variant="outline" onClick={() => navigate(slug ? `/client/${slug}` : '/')}>
              Back to Services
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const status = lineData.status as 'waiting' | 'serving' | 'completed' | 'cancelled' | 'no_show';
  const isBeingCalled = status === 'serving';
  const isTerminal   = ['completed', 'cancelled', 'no_show'].includes(status);
  const peopleAhead  = Math.max(0, (lineData.people_ahead ?? lineData.position - 1));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(slug ? `/client/${slug}` : '/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">Your Ticket</h1>
              <p className="text-xs text-muted-foreground">Q ME NOW</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <QueueStatusBadge status={status} size="sm" />
            <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-24 pb-8">
        <div className="max-w-6xl mx-auto space-y-6">

          {/* Welcome / Status Header */}
          <GlassCard className={cn(
            'p-6 text-center transition-all duration-500',
            isBeingCalled && 'ring-2 ring-green-500/40 shadow-lg shadow-green-500/10',
          )}>
            {isBeingCalled ? (
              <>
                <div className="flex justify-center mb-3">
                  <span className="text-4xl animate-bounce">🔔</span>
                </div>
                <h1 className="text-2xl font-bold text-green-400">It's Your Turn!</h1>
                <p className="text-muted-foreground mt-2">Please proceed to the counter now.</p>
              </>
            ) : isTerminal ? (
              <>
                <div className="flex justify-center mb-3">
                  {status === 'completed'
                    ? <CheckCircle2 className="w-10 h-10 text-blue-400" />
                    : <AlertCircle className="w-10 h-10 text-zinc-400" />}
                </div>
                <h1 className="text-2xl font-bold">
                  {status === 'completed' ? 'Service Complete' : 'Queue Ended'}
                </h1>
                <p className="text-muted-foreground mt-2">
                  {status === 'completed'
                    ? 'Thank you for using Q ME NOW!'
                    : 'Your queue entry has ended. Rejoin if needed.'}
                </p>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold">
                  Welcome, {userData.fullName.split(' ')[0]}!
                </h1>
                <p className="text-muted-foreground mt-2">
                  You're in the queue. We'll notify you when it's your turn.
                </p>
              </>
            )}
          </GlassCard>

          {/* Pulsing "called" banner */}
          {isBeingCalled && (
            <div className="rounded-2xl border-2 border-green-500/50 bg-green-500/10 p-4 text-center animate-pulse">
              <p className="text-green-300 font-semibold text-lg">
                🎉 Counter is ready for you — please go now!
              </p>
            </div>
          )}

          {/* Main Ticket Display */}
          {!isTerminal && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column */}
              <div className="space-y-6">
                <TicketDisplay
                  ticketNumber={lineData.ticket_number}
                  service={lineData.service_name || lineData.services?.name || 'Service'}
                />
                <GlassCard className="p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Your position</p>
                  <div className="text-4xl font-bold text-primary">#{lineData.position}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {lineData.branch_name || 'Branch'}
                  </p>
                </GlassCard>
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                {/* People Ahead */}
                <GlassCard className="p-8 flex flex-col items-center justify-center space-y-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-5 h-5" />
                    <span className="text-sm font-medium">People Ahead</span>
                  </div>
                  <CircularProgress
                    value={Math.max(0, peopleAhead)}
                    max={Math.max(lineData.position, 1)}
                    size={140}
                    strokeWidth={12}
                    color="primary"
                  >
                    <div className="text-center">
                      <div className="text-3xl font-bold">{peopleAhead}</div>
                      <div className="text-sm text-muted-foreground">ahead</div>
                    </div>
                  </CircularProgress>
                </GlassCard>

                {/* Wait Time */}
                <GlassCard className="p-8 flex flex-col items-center justify-center space-y-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-5 h-5" />
                    <span className="text-sm font-medium">Estimated Wait</span>
                  </div>
                  <CircularProgress
                    value={countdown}
                    max={Math.max(estimatedWaitMinutes * 60, 1)}
                    size={140}
                    strokeWidth={12}
                    color="secondary"
                  >
                    <div className="text-center">
                      <div className="text-3xl font-bold">
                        {minutes}:{seconds.toString().padStart(2, '0')}
                      </div>
                      <div className="text-sm text-muted-foreground">remaining</div>
                    </div>
                  </CircularProgress>
                </GlassCard>

                {/* Help */}
                <GlassCard className="p-6 flex flex-col items-center justify-center space-y-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">Need Help?</span>
                  </div>
                  <Button variant="outline" className="glass w-full" size="lg">
                    Open FAQ Chat
                  </Button>
                </GlassCard>
              </div>
            </div>
          )}

          {/* Live indicator */}
          {!isTerminal && (
            <GlassCard className="p-4 text-center">
              <p className="text-sm flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
                <span className="font-semibold">Live</span>
                <span className="text-muted-foreground">• Updates every 10 seconds</span>
              </p>
            </GlassCard>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate(slug ? `/client/${slug}` : '/')} className="glass">
              Back to Services
            </Button>
            {!isTerminal && (
              <Button
                variant="destructive"
                onClick={() => setShowLeaveModal(true)}
                disabled={isLeaving || isBeingCalled}
              >
                {isLeaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Leave Queue
              </Button>
            )}
          </div>
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

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { ArrowLeft, Sun, Moon, MessageCircle, Users, Clock, Loader2 } from 'lucide-react';
import { GlassCard } from '@/components/GlassCard';
import { TicketDisplay } from '@/components/TicketDisplay';
import { CircularProgress } from '@/components/CircularProgress';
import { Button } from '@/components/ui/button';
import { LeaveQueueModal } from '@/components/LeaveQueueModal';
import { useLiveQueuePosition } from '@/hooks/useLiveQueuePosition';
import { toast } from 'sonner';

const Ticket = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const { theme, setTheme } = useTheme();
  const lineId = searchParams.get('line') || undefined;
  
  const { lineData, isLoading, error, leaveQueue } = useLiveQueuePosition(lineId);
  const [userData, setUserData] = useState({ fullName: 'Guest' });
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('userData');
    if (stored) {
      setUserData(JSON.parse(stored));
    }
  }, []);

  const handleLeaveQueue = async () => {
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
  };

  // Calculate countdown based on estimated wait
  const estimatedWaitMinutes = lineData?.estimated_wait_minutes || 0;
  const [countdown, setCountdown] = useState(estimatedWaitMinutes * 60);

  useEffect(() => {
    setCountdown(estimatedWaitMinutes * 60);
  }, [estimatedWaitMinutes]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !lineData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Ticket not found</h1>
          <p className="text-muted-foreground mb-4">{error || 'No active queue entry found'}</p>
          <Button onClick={() => navigate(slug ? `/client/${slug}` : '/')}>
            Back to Services
          </Button>
        </div>
      </div>
    );
  }

  const isBeingCalled = lineData.status === 'serving';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(slug ? `/client/${slug}` : '/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">Your Ticket</h1>
              <p className="text-xs text-muted-foreground">QmeNow Queue</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-24 pb-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Welcome Header */}
          <GlassCard className="p-6 text-center animate-slide-up">
            <h1 className="text-2xl font-bold">
              Welcome, {userData.fullName.split(' ')[0]}!
            </h1>
            <p className="text-muted-foreground mt-2">
              {isBeingCalled 
                ? "🔔 You're being called! Please proceed to the counter."
                : "Thank you for waiting. You'll be called soon."}
            </p>
          </GlassCard>

          {/* Called notification banner */}
          {isBeingCalled && (
            <GlassCard 
              className="p-6 text-center border-2 animate-pulse"
              style={{ borderColor: 'hsl(var(--primary))' }}
            >
              <p className="text-xl font-bold text-primary">
                🎉 It's Your Turn! Please proceed to the counter.
              </p>
            </GlassCard>
          )}

          {/* Main Ticket Display */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Ticket */}
            <div className="space-y-6">
              <TicketDisplay
                ticketNumber={lineData.ticket_number}
                service={lineData.services?.name || 'Service'}
              />

              <GlassCard className="p-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Your position in the queue:
                </p>
                <div className="text-4xl font-bold text-primary">
                  #{lineData.position}
                </div>
              </GlassCard>
            </div>

            {/* Right Column - Stats */}
            <div className="space-y-6">
              {/* Queue Position */}
              <GlassCard className="p-8 flex flex-col items-center justify-center space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="w-5 h-5" />
                  <span className="text-sm font-medium">People Ahead</span>
                </div>
                <CircularProgress
                  value={Math.max(0, lineData.position - 1)}
                  max={Math.max(lineData.position, 1)}
                  size={140}
                  strokeWidth={12}
                  color="primary"
                >
                  <div className="text-center">
                    <div className="text-3xl font-bold">{Math.max(0, lineData.position - 1)}</div>
                    <div className="text-sm text-muted-foreground">ahead</div>
                  </div>
                </CircularProgress>
              </GlassCard>

              {/* Wait Time */}
              <GlassCard className="p-8 flex flex-col items-center justify-center space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-medium">Estimated Wait Time</span>
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

              {/* FAQ Chat */}
              <GlassCard className="p-8 flex flex-col items-center justify-center space-y-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Need Help?</span>
                </div>
                <Button
                  variant="outline"
                  className="glass w-full"
                  size="lg"
                >
                  Open FAQ Chat
                </Button>
              </GlassCard>
            </div>
          </div>

          {/* Status Banner */}
          <GlassCard className="p-4 text-center">
            <p className="text-sm">
              🔴 <span className="font-semibold">Live</span> • Updates every 10 seconds • Notifications enabled
            </p>
          </GlassCard>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <Button
              variant="outline"
              onClick={() => navigate(slug ? `/client/${slug}` : '/')}
              className="glass"
            >
              Back to Services
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowLeaveModal(true)}
              disabled={isLeaving || isBeingCalled}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isLeaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Leave Queue
            </Button>
          </div>

          {/* Leave Queue Confirmation Modal */}
          <LeaveQueueModal
            open={showLeaveModal}
            onOpenChange={setShowLeaveModal}
            onConfirm={handleLeaveQueue}
          />
        </div>
      </main>
    </div>
  );
};

export default Ticket;

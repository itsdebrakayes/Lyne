import { GlassCard } from "@/components/GlassCard";
import { TicketDisplay } from "@/components/TicketDisplay";
import { CircularProgress } from "@/components/CircularProgress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Users, Clock } from "lucide-react";
import { useState, useEffect } from "react";

// Mock ticket data
const mockTicketData = {
  ticketNumber: "TRN-A104",
  service: "TRN Service",
  position: 6,
  totalInQueue: 24,
  estimatedWaitMinutes: 12,
  estimatedWaitSeconds: 40,
  status: "waiting" as const,
  counter: null as number | null,
};

const Ticket = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState({ fullName: "Guest" });
  const [countdown, setCountdown] = useState(mockTicketData.estimatedWaitMinutes * 60 + mockTicketData.estimatedWaitSeconds);

  useEffect(() => {
    // Get user data
    const stored = localStorage.getItem("userData");
    if (stored) {
      setUserData(JSON.parse(stored));
    }

    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Welcome Header */}
        <GlassCard className="p-6 text-center animate-slide-up">
          <h1 className="text-2xl font-bold">
            Welcome, {userData.fullName.split(" ")[0]}!
          </h1>
          <p className="text-muted-foreground mt-2">
            Thank you for waiting. You'll be called soon.
          </p>
        </GlassCard>

        {/* Main Ticket Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Ticket */}
          <div className="space-y-6">
            <TicketDisplay
              ticketNumber={mockTicketData.ticketNumber}
              service={mockTicketData.service}
            />

            <GlassCard className="p-6 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Here's your position in the queue:
              </p>
              <div className="text-4xl font-bold text-primary">#{mockTicketData.position}</div>
            </GlassCard>
          </div>

          {/* Right Column - Stats */}
          <div className="space-y-6">
            {/* Queue Position */}
            <GlassCard className="p-8 flex flex-col items-center justify-center space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="w-5 h-5" />
                <span className="text-sm font-medium">People in Queue</span>
              </div>
              <CircularProgress
                value={mockTicketData.totalInQueue - mockTicketData.position}
                max={mockTicketData.totalInQueue}
                size={140}
                strokeWidth={12}
                color="primary"
              >
                <div className="text-center">
                  <div className="text-3xl font-bold">{mockTicketData.position}</div>
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
                max={mockTicketData.estimatedWaitMinutes * 60 + mockTicketData.estimatedWaitSeconds}
                size={140}
                strokeWidth={12}
                color="secondary"
              >
                <div className="text-center">
                  <div className="text-3xl font-bold">
                    {minutes}:{seconds.toString().padStart(2, "0")}
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
            🔴 <span className="font-semibold">Live</span> • You'll receive a notification when it's your turn
          </p>
        </GlassCard>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <Button
            variant="outline"
            onClick={() => navigate("/")}
            className="glass"
          >
            Back to Home
          </Button>
          <Button
            variant="destructive"
            className="bg-destructive hover:bg-destructive/90"
          >
            Leave Queue
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Ticket;

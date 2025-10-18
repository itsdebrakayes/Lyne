import { GlassCard } from "@/components/GlassCard";
import { StatusChip } from "@/components/StatusChip";
import { ServiceTile } from "@/components/ServiceTile";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import {
  DollarSign,
  FileText,
  CreditCard,
  Hash,
  MoreHorizontal,
  ArrowRight,
} from "lucide-react";

// Mock data - will be replaced with real-time data later
const mockTrafficData = {
  status: "moderate",
  estWaitMin: 24,
  estWaitMax: 35,
  activeCounters: 4,
  services: [
    {
      id: "cashier",
      title: "Cashier",
      icon: DollarSign,
      queueLength: 18,
      eta: "~22 min",
      activeCounters: 3,
      loadPercentage: 75,
    },
    {
      id: "titles",
      title: "Titles",
      icon: FileText,
      queueLength: 12,
      eta: "~18 min",
      activeCounters: 2,
      loadPercentage: 60,
    },
    {
      id: "license",
      title: "License",
      icon: CreditCard,
      queueLength: 24,
      eta: "~32 min",
      activeCounters: 4,
      loadPercentage: 85,
    },
    {
      id: "trn",
      title: "TRN",
      icon: Hash,
      queueLength: 8,
      eta: "~12 min",
      activeCounters: 2,
      loadPercentage: 40,
    },
    {
      id: "other",
      title: "Other Services",
      icon: MoreHorizontal,
      queueLength: 6,
      eta: "~10 min",
      activeCounters: 1,
      loadPercentage: 30,
    },
  ],
};

const PublicTraffic = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10 pb-8">
      {/* Logo/Home Button */}
      <button
        onClick={() => navigate("/")}
        className="fixed top-4 left-4 md:top-6 md:left-6 z-50 glass bg-white/80 dark:bg-gray-800/80 backdrop-blur-md px-4 md:px-6 py-2 md:py-3 rounded-full shadow-xl flex items-center gap-2 hover:bg-primary/10 transition-all"
      >
        <Home className="h-4 w-4 md:h-5 md:w-5 text-primary" />
        <span className="text-sm md:text-base font-bold text-primary">QueMe Now</span>
      </button>
      
      <div className="max-w-7xl mx-auto space-y-8 pt-20 p-4 md:p-8">
        {/* Header */}
        <div className="text-center space-y-2 md:space-y-4 animate-slide-up">
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold">
            Live Traffic at TAJ
          </h1>
          <p className="text-base md:text-lg text-muted-foreground">
            facilitated by QueMeNow
          </p>
          <p className="text-xs md:text-sm text-muted-foreground">
            Updated just now • {mockTrafficData.activeCounters} counters active
          </p>
        </div>

        {/* Mind Map Layout - Desktop */}
        <div className="hidden md:block relative min-h-[800px]">
          {/* SVG for connecting lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {mockTrafficData.services.map((service, index) => {
              const angle = (index / mockTrafficData.services.length) * 2 * Math.PI - Math.PI / 2;
              const radius = 280;
              const x1 = 50;
              const y1 = 50;
              const x2 = 50 + Math.cos(angle) * (radius / 8);
              const y2 = 50 + Math.sin(angle) * (radius / 8);
              
              return (
                <line
                  key={service.id}
                  x1={`${x1}%`}
                  y1={`${y1}%`}
                  x2={`${x2}%`}
                  y2={`${y2}%`}
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeOpacity="0.3"
                  strokeDasharray="5,5"
                  className="animate-pulse"
                />
              );
            })}
          </svg>

          {/* Center Circle - Status */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
            <GlassCard className="w-64 h-64 rounded-full flex flex-col items-center justify-center space-y-4 animate-slide-up">
              <StatusChip status={mockTrafficData.status} />
              <div className="text-center space-y-2">
                <div className="text-4xl font-bold">
                  {mockTrafficData.estWaitMin}–{mockTrafficData.estWaitMax}
                </div>
                <p className="text-xs text-muted-foreground">minutes</p>
              </div>
            </GlassCard>
          </div>

          {/* Services around the circle */}
          {mockTrafficData.services.map((service, index) => {
            const angle = (index / mockTrafficData.services.length) * 2 * Math.PI - Math.PI / 2;
            const radius = 280;
            const x = 50 + Math.cos(angle) * (radius / 8);
            const y = 50 + Math.sin(angle) * (radius / 8);
            
            return (
              <div
                key={service.id}
                className="absolute animate-slide-up"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  animationDelay: `${index * 0.1}s`,
                  zIndex: 1,
                }}
              >
                <div className="w-48">
                  <ServiceTile
                    {...service}
                    onClick={() => navigate("/signup")}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile Layout - Stacked */}
        <div className="md:hidden space-y-6">
          {/* Center Status Card */}
          <GlassCard className="p-6 flex flex-col items-center justify-center space-y-4 animate-slide-up mx-auto max-w-sm">
            <StatusChip status={mockTrafficData.status} />
            <div className="text-center space-y-2">
              <div className="text-3xl font-bold">
                {mockTrafficData.estWaitMin}–{mockTrafficData.estWaitMax}
              </div>
              <p className="text-xs text-muted-foreground">minutes estimated wait</p>
            </div>
          </GlassCard>

          {/* Services List */}
          <div className="space-y-4">
            {mockTrafficData.services.map((service, index) => (
              <div
                key={service.id}
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <ServiceTile
                  {...service}
                  onClick={() => navigate("/signup")}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Action Area */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-slide-up">
          <Button
            size="lg"
            className="text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-full bg-primary hover:bg-primary-dark w-full sm:w-auto"
            onClick={() => navigate("/signup")}
          >
            Join Queue
            <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-full glass w-full sm:w-auto"
            onClick={() => navigate("/login")}
          >
            Already have a ticket?
          </Button>
        </div>

        {/* Live Ticker - Placeholder for future */}
        <GlassCard className="p-3 md:p-4 text-center text-xs md:text-sm text-muted-foreground">
          <div className="animate-pulse-glow">
            🔴 Live • System operational • All services available
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default PublicTraffic;

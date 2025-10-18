import { GlassCard } from "@/components/GlassCard";
import { StatusChip } from "@/components/StatusChip";
import { ServiceTile } from "@/components/ServiceTile";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
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
  status: "moderate" as const,
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
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 animate-slide-up">
          <h1 className="text-4xl md:text-5xl font-bold">
            Live Traffic at Tax Administration
          </h1>
          <p className="text-muted-foreground text-lg">
            Updated just now • {mockTrafficData.activeCounters} counters active
          </p>
        </div>

        {/* Hero Status Card */}
        <GlassCard className="p-8 md:p-12 text-center space-y-6 animate-slide-up">
          <StatusChip status={mockTrafficData.status} />
          <div className="space-y-2">
            <div className="text-5xl md:text-6xl font-bold">
              {mockTrafficData.estWaitMin}–{mockTrafficData.estWaitMax}
              <span className="text-3xl md:text-4xl text-muted-foreground ml-2">min</span>
            </div>
            <p className="text-muted-foreground text-lg">Estimated wait time</p>
          </div>
        </GlassCard>

        {/* Services Grid */}
        <div>
          <h2 className="text-2xl font-semibold mb-6">Service Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            className="text-lg px-8 py-6 rounded-full bg-primary hover:bg-primary-dark"
            onClick={() => navigate("/signup")}
          >
            Join Queue
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="text-lg px-8 py-6 rounded-full glass"
            onClick={() => navigate("/login")}
          >
            Already have a ticket?
          </Button>
        </div>

        {/* Live Ticker - Placeholder for future */}
        <GlassCard className="p-4 text-center text-sm text-muted-foreground">
          <div className="animate-pulse-glow">
            🔴 Live • System operational • All services available
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

export default PublicTraffic;

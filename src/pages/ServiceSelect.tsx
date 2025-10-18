import { GlassCard } from "@/components/GlassCard";
import { ServiceTile } from "@/components/ServiceTile";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  DollarSign,
  FileText,
  CreditCard,
  Hash,
  MoreHorizontal,
} from "lucide-react";

const services = [
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
];

const ServiceSelect = () => {
  const navigate = useNavigate();

  const handleServiceSelect = (serviceId: string) => {
    // Store selected service
    localStorage.setItem("selectedService", serviceId);
    navigate("/ticket");
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="text-center space-y-4">
          <h1 className="text-3xl md:text-4xl font-bold">Select Your Service</h1>
          <p className="text-muted-foreground text-lg">
            Choose the service you need assistance with
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <div
              key={service.id}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <ServiceTile
                {...service}
                onClick={() => handleServiceSelect(service.id)}
              />
            </div>
          ))}
        </div>

        <GlassCard className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Select a service to receive your queue ticket
          </p>
        </GlassCard>
      </div>
    </div>
  );
};

export default ServiceSelect;

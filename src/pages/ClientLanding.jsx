import React, { useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { ArrowLeft, Sun, Moon, Ticket, ChevronDown } from 'lucide-react';
import { TrafficStatusBanner } from '@/components/TrafficStatusBanner';
import { ServiceCard } from '@/components/ServiceCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganization } from '@/hooks/useOrganizations';
import { useServices } from '@/hooks/useServices';
import { useQueueData } from '@/hooks/useQueueData';
import { Skeleton } from '@/components/ui/skeleton';

const ClientLanding = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const authSectionRef = useRef(null);
  
  const [selectedService, setSelectedService] = useState(null);
  const [showAuthSection, setShowAuthSection] = useState(false);
  
  const { data: organization, isLoading: orgLoading } = useOrganization(slug);
  const { data: services, isLoading: servicesLoading } = useServices(organization?.id);
  const { data: queueData } = useQueueData(organization?.id);

  // Calculate overall traffic status
  const trafficStatus = useMemo(() => {
    if (!queueData || !services) {
      return { status: 'moderate', avgWaitMin: 10, avgWaitMax: 20, totalInQueue: 0 };
    }

    const totalInQueue = queueData.reduce((sum, q) => sum + q.count, 0);
    const avgWait = services.reduce((sum, s) => {
      const queueCount = queueData.find(q => q.service_id === s.id)?.count || 0;
      return sum + (queueCount * (s.base_avg_time_minutes || 5));
    }, 0) / Math.max(services.length, 1);

    let status = 'low';
    if (avgWait > 30) status = 'high';
    else if (avgWait > 15) status = 'moderate';

    return {
      status,
      avgWaitMin: Math.round(avgWait * 0.8),
      avgWaitMax: Math.round(avgWait * 1.2),
      totalInQueue,
    };
  }, [queueData, services]);

  const handleServiceSelect = (serviceId) => {
    setSelectedService(serviceId);
    setShowAuthSection(true);
    setTimeout(() => {
      authSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleJoinQueue = () => {
    setShowAuthSection(true);
    setTimeout(() => {
      authSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const isLoading = orgLoading || servicesLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <Skeleton className="h-12 w-48 mb-8" />
        <Skeleton className="h-40 w-full mb-8 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Organization not found</h1>
          <Button onClick={() => navigate('/')}>Back to Directory</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              {organization.logo_url ? (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="w-10 h-10 object-contain"
                />
              ) : (
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: organization.primary_color || 'hsl(var(--primary))' }}
                >
                  <span className="text-white font-bold">
                    {organization.name.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <h1 className="font-semibold">{organization.name}</h1>
                <p className="text-xs text-muted-foreground">facilitated by QmeNow</p>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-24 pb-32 relative">
        {/* Large background text */}
        <div className="absolute top-16 left-1/2 -translate-x-1/2 pointer-events-none select-none overflow-hidden w-full">
          <h1 
            className="text-[6rem] sm:text-[8rem] md:text-[10rem] lg:text-[12rem] font-black text-center whitespace-nowrap"
            style={{ 
              color: 'transparent',
              WebkitTextStroke: '1px hsl(var(--foreground) / 0.05)',
              opacity: 0.5,
            }}
          >
            SERVICES
          </h1>
        </div>

        {/* Traffic Status Banner */}
        <TrafficStatusBanner
          status={trafficStatus.status}
          avgWaitMin={trafficStatus.avgWaitMin}
          avgWaitMax={trafficStatus.avgWaitMax}
          totalInQueue={trafficStatus.totalInQueue}
          className="mb-8 relative z-10"
        />

        {/* Services Grid - 3 columns on desktop */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {services?.map((service) => {
            const queueInfo = queueData?.find(q => q.service_id === service.id);
            const queueLength = queueInfo?.count || 0;
            const estimatedWait = queueLength * (service.base_avg_time_minutes || 5);

            return (
              <ServiceCard
                key={service.id}
                service={service}
                queueLength={queueLength}
                estimatedWait={estimatedWait}
                isSelected={selectedService === service.id}
                onJoin={() => handleServiceSelect(service.id)}
              />
            );
          })}
        </div>

        {/* Auth Section - appears when service is selected */}
        <div ref={authSectionRef}>
          {showAuthSection && (
            <div className="mt-12 relative z-10">
              {/* Scroll indicator */}
              <div className="flex justify-center mb-6">
                <ChevronDown className="w-6 h-6 text-muted-foreground animate-bounce" />
              </div>
              
              <div 
                className="max-w-md mx-auto rounded-3xl p-6 backdrop-blur-xl border border-white/10"
                style={{
                  background: 'hsl(var(--card) / 0.6)',
                  boxShadow: 'inset 0 0 30px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.2)',
                }}
              >
                <h2 className="text-xl font-semibold text-center mb-6">Join the Queue</h2>
                
                {/* Service Selection Dropdown */}
                <div className="mb-6">
                  <Label htmlFor="service-select" className="text-sm text-muted-foreground mb-2 block">
                    Select Service
                  </Label>
                  <Select value={selectedService || ''} onValueChange={setSelectedService}>
                    <SelectTrigger id="service-select" className="w-full bg-muted/30 border-white/10">
                      <SelectValue placeholder="Choose a service" />
                    </SelectTrigger>
                    <SelectContent>
                      {services?.map((service) => (
                        <SelectItem key={service.id} value={service.id}>
                          {service.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Login/Signup Tabs */}
                <Tabs defaultValue="login" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/30">
                    <TabsTrigger value="login">Login</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="login" className="space-y-4">
                    <div>
                      <Label htmlFor="email" className="text-sm text-muted-foreground">Email</Label>
                      <Input 
                        id="email" 
                        type="email" 
                        placeholder="your@email.com"
                        className="mt-1 bg-muted/30 border-white/10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="password" className="text-sm text-muted-foreground">Password</Label>
                      <Input 
                        id="password" 
                        type="password" 
                        placeholder="••••••••"
                        className="mt-1 bg-muted/30 border-white/10"
                      />
                    </div>
                    <Button 
                      className="w-full bg-foreground text-background hover:bg-foreground/90 py-5"
                      disabled={!selectedService}
                    >
                      Login & Join Queue
                    </Button>
                  </TabsContent>
                  
                  <TabsContent value="signup" className="space-y-4">
                    <div>
                      <Label htmlFor="fullname" className="text-sm text-muted-foreground">Full Name</Label>
                      <Input 
                        id="fullname" 
                        type="text" 
                        placeholder="John Doe"
                        className="mt-1 bg-muted/30 border-white/10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signup-email" className="text-sm text-muted-foreground">Email</Label>
                      <Input 
                        id="signup-email" 
                        type="email" 
                        placeholder="your@email.com"
                        className="mt-1 bg-muted/30 border-white/10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-sm text-muted-foreground">Phone</Label>
                      <Input 
                        id="phone" 
                        type="tel" 
                        placeholder="(876) 555-1234"
                        className="mt-1 bg-muted/30 border-white/10"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signup-password" className="text-sm text-muted-foreground">Password</Label>
                      <Input 
                        id="signup-password" 
                        type="password" 
                        placeholder="••••••••"
                        className="mt-1 bg-muted/30 border-white/10"
                      />
                    </div>
                    <Button 
                      className="w-full bg-foreground text-background hover:bg-foreground/90 py-5"
                      disabled={!selectedService}
                    >
                      Sign Up & Join Queue
                    </Button>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border/50 p-4">
        <div className="container mx-auto flex gap-4">
          <Button
            onClick={handleJoinQueue}
            className="flex-1 bg-foreground text-background hover:bg-foreground/90"
            size="lg"
          >
            Join the Queue
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/client/${slug}/ticket`)}
            size="lg"
            className="flex items-center gap-2"
          >
            <Ticket className="w-4 h-4" />
            Already in Queue?
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ClientLanding;

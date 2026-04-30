import * as React from 'react';
import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { ArrowLeft, Sun, Moon, Ticket, Clock, MapPin } from 'lucide-react';
import { TrafficStatusBanner } from '@/components/TrafficStatusBanner';
import { ServiceCard } from '@/components/ServiceCard';
import { Button } from '@/components/ui/button';
import { useOrganization } from '@/hooks/useOrganizations';
import { useServices } from '@/hooks/useServices';
import { useQueueData } from '@/hooks/useQueueData';
import { useBranches } from '@/hooks/useBranches';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ClientLanding = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  
  const { data: organization, isLoading: orgLoading } = useOrganization(slug);
  const { data: services, isLoading: servicesLoading } = useServices(organization?.id);
  const { data: branches, isLoading: branchesLoading } = useBranches(organization?.id);
  
  // Default to main branch or first branch
  const [selectedBranchId, setSelectedBranchId] = useState<string | undefined>(undefined);
  
  // Set default branch when branches load
  React.useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranchId) {
      const mainBranch = branches.find(b => b.is_main_branch) || branches[0];
      setSelectedBranchId(mainBranch.id);
    }
  }, [branches, selectedBranchId]);
  
  // Pass selected branch to queue data
  const { data: queueData } = useQueueData(organization?.id, selectedBranchId);
  
  const selectedBranch = branches?.find(b => b.id === selectedBranchId);

  // Calculate overall traffic status
  const trafficStatus = useMemo(() => {
    if (!queueData || !services) {
      return { status: 'moderate' as const, avgWaitMin: 10, avgWaitMax: 20, totalInQueue: 0 };
    }

    const totalInQueue = queueData.reduce((sum, q) => sum + q.count, 0);
    const avgWait = services.reduce((sum, s) => {
      const queueCount = queueData.find(q => q.service_id === s.id)?.count || 0;
      return sum + (queueCount * (s.base_avg_time_minutes || 5));
    }, 0) / Math.max(services.length, 1);

    let status: 'low' | 'moderate' | 'high' = 'low';
    if (avgWait > 30) status = 'high';
    else if (avgWait > 15) status = 'moderate';

    return {
      status,
      avgWaitMin: Math.round(avgWait * 0.8),
      avgWaitMax: Math.round(avgWait * 1.2),
      totalInQueue,
    };
  }, [queueData, services]);

  const handleServiceSelect = (serviceId: string) => {
    navigate(`/client/${slug}/join?service=${serviceId}${selectedBranchId ? `&branch=${selectedBranchId}` : ''}`);
  };

  const handleJoinQueue = () => {
    navigate(`/client/${slug}/join${selectedBranchId ? `?branch=${selectedBranchId}` : ''}`);
  };

  const isLoading = orgLoading || servicesLoading || branchesLoading;

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
    <div className="min-h-screen bg-background flex flex-col">
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
      <main className="container mx-auto px-4 pt-24 pb-8 flex-1 relative">
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

        {/* Branch Selector */}
        {branches && branches.length > 1 && (
          <div className="mb-6 relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Select Branch</span>
            </div>
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-full md:w-80 bg-card border-border">
                <SelectValue placeholder="Select a branch" />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    <div className="flex flex-col items-start">
                      <span>{branch.name}</span>
                      <span className="text-xs text-muted-foreground">{branch.address}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Single branch display */}
        {branches && branches.length === 1 && (
          <div className="mb-6 relative z-10 flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <span className="text-sm">{branches[0].name} • {branches[0].address}</span>
          </div>
        )}

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
                onJoin={() => handleServiceSelect(service.id)}
              />
            );
          })}
        </div>
      </main>

      {/* Footer Action Bar - scrolls with page */}
      <footer className="bg-background border-t border-border/50 p-6 mt-auto">
        <div className="container mx-auto flex gap-4 flex-col sm:flex-row">
          <Button
            onClick={handleJoinQueue}
            className="flex-1 bg-foreground text-background hover:bg-foreground/90"
            size="lg"
          >
            Join the Queue
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/client/${slug}/best-time`)}
            size="lg"
            className="flex items-center justify-center gap-2"
          >
            <Clock className="w-4 h-4" />
            Best Time to Visit
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/client/${slug}/ticket`)}
            size="lg"
            className="flex items-center justify-center gap-2"
          >
            <Ticket className="w-4 h-4" />
            Already in Queue?
          </Button>
        </div>
      </footer>
    </div>
  );
};

export default ClientLanding;

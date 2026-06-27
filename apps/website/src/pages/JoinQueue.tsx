import * as React from 'react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { ArrowLeft, Sun, Moon, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomCalendar } from '@/components/ui/custom-calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOrganization } from '@/hooks/useOrganizations';
import { useServices } from '@/hooks/useServices';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/apiClient';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const JoinQueue = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { signIn, signUp } = useAuth();
  
  const preSelectedService = searchParams.get('service');
  const preSelectedBranch = searchParams.get('branch');
  const [selectedService, setSelectedService] = useState<string>(preSelectedService || '');
  const [selectedBranchId, setSelectedBranchId] = useState<string>(preSelectedBranch || '');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('signup');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  
  // Form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [signupForm, setSignupForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    idNumber: '', // Jamaican National ID
    trnNumber: '', // Tax Registration Number
    dateOfBirth: undefined as Date | undefined,
  });
  
  const { data: organization } = useOrganization(slug);
  const { data: services } = useServices(organization?.id);
  
  // Fetch branches for the organization via MySQL backend
  const { data: branches } = useQuery({
    queryKey: ['branches', organization?.id],
    queryFn: async () => {
      return api.get<{ id: string; name: string; is_main_branch: boolean; is_active: boolean }[]>(
        `/branches?business_id=${organization!.id}`,
        false
      );
    },
    enabled: !!organization?.id,
  });

  // Set default branch when branches load
  React.useEffect(() => {
    if (branches && branches.length > 0 && !selectedBranchId) {
      const mainBranch = branches.find(b => b.is_main_branch) || branches[0];
      setSelectedBranchId(mainBranch.id);
    }
  }, [branches, selectedBranchId]);

  // Format TRN with dashes (XXX-XXX-XXX)
  const formatTRN = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 9);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  // Mask ID number (show first 3 and last 2)
  const formatIdDisplay = (value: string) => {
    if (value.length <= 5) return value;
    return `${value.slice(0, 3)}${'*'.repeat(value.length - 5)}${value.slice(-2)}`;
  };

  const joinQueue = async () => {
    if (!selectedService || !organization) {
      toast.error('Please select a service');
      return null;
    }
    if (!selectedBranchId) {
      toast.error('Please select a branch');
      return null;
    }
    try {
      const ticket = await api.post<{ id: string; ticket_number: string }>('/tickets', {
        service_id: selectedService,
        branch_id: selectedBranchId,
        business_id: organization.id,
        intake_data: {},
      });
      return ticket;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to join queue');
      return null;
    }
  };

  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(loginForm.email, loginForm.password);
      if (error) {
        toast.error(error.message);
        return;
      }

      // Sync user to MySQL then join queue
      await api.post('/auth/sync-user', {});
      const lineData = await joinQueue();
      if (lineData) {
        toast.success('Successfully joined the queue!');
        navigate(`/client/${slug}/ticket?line=${lineData.id}`);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!signupForm.fullName || !signupForm.email || !signupForm.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!signupForm.dateOfBirth) {
      toast.error('Please select your date of birth');
      return;
    }

    // Validate age (must be at least 16)
    const age = Math.floor((Date.now() - signupForm.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    if (age < 16) {
      toast.error('You must be at least 16 years old');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signUp(signupForm.email, signupForm.password, {
        full_name: signupForm.fullName,
        phone: signupForm.phone,
        id_number: signupForm.idNumber,
        trn_number: signupForm.trnNumber.replace(/-/g, ''),
        date_of_birth: signupForm.dateOfBirth.toISOString(),
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Sync new user profile to MySQL
      await api.post('/auth/sync-user', {
        full_name:    signupForm.fullName,
        phone:        signupForm.phone,
        national_id:  signupForm.idNumber,
        trn:          signupForm.trnNumber.replace(/-/g, ''),
        date_of_birth: signupForm.dateOfBirth ? format(signupForm.dateOfBirth, 'yyyy-MM-dd') : undefined,
      });

      const lineData = await joinQueue();
      if (lineData) {
        localStorage.setItem('userData', JSON.stringify({ fullName: signupForm.fullName }));
        toast.success('Account created! You\'re now in the queue.');
        navigate(`/client/${slug}/ticket?line=${lineData.id}`);
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!organization) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
              onClick={() => navigate(`/client/${slug}`)}
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
                <p className="text-xs text-muted-foreground">Join the Queue</p>
              </div>
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
      <main className="container mx-auto px-4 pt-24 pb-12 flex items-center justify-center min-h-screen">
        <div 
          className="w-full max-w-md rounded-3xl p-6 backdrop-blur-xl border border-white/10"
          style={{
            background: 'hsl(var(--card) / 0.6)',
            boxShadow: 'inset 0 0 30px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <h2 className="text-xl font-semibold text-center mb-6">Join the Queue</h2>
          
          {/* Branch Selection Dropdown */}
          {branches && branches.length > 0 && (
            <div className="mb-4">
              <Label htmlFor="branch-select" className="text-sm text-muted-foreground mb-2 block">
                Select Branch
              </Label>
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger id="branch-select" className="w-full bg-muted/30 border-white/10">
                  <SelectValue placeholder="Choose a branch" />
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

          {/* Service Selection Dropdown */}
          <div className="mb-6">
            <Label htmlFor="service-select" className="text-sm text-muted-foreground mb-2 block">
              Select Service
            </Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'login' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/30">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="space-y-4">
              <div>
                <Label htmlFor="login-email" className="text-sm text-muted-foreground">Email</Label>
                <Input 
                  id="login-email" 
                  type="email" 
                  placeholder="your@email.com"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  className="mt-1 bg-muted/30 border-white/10"
                />
              </div>
              <div>
                <Label htmlFor="login-password" className="text-sm text-muted-foreground">Password</Label>
                <Input 
                  id="login-password" 
                  type="password" 
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                  className="mt-1 bg-muted/30 border-white/10"
                />
              </div>
              <Button 
                className="w-full bg-foreground text-background hover:bg-foreground/90 py-5"
                disabled={!selectedService || !selectedBranchId || isLoading}
                onClick={handleLogin}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Login & Join Queue
              </Button>
            </TabsContent>
            
            <TabsContent value="signup" className="space-y-4">
              <div>
                <Label htmlFor="fullname" className="text-sm text-muted-foreground">Full Name *</Label>
                <Input 
                  id="fullname" 
                  type="text" 
                  placeholder="John Doe"
                  value={signupForm.fullName}
                  onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })}
                  className="mt-1 bg-muted/30 border-white/10"
                />
              </div>

              <div>
                <Label htmlFor="id-number" className="text-sm text-muted-foreground">National ID Number</Label>
                <Input 
                  id="id-number" 
                  type="text" 
                  placeholder="National Registration ID"
                  value={signupForm.idNumber}
                  onChange={(e) => setSignupForm({ ...signupForm, idNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  className="mt-1 bg-muted/30 border-white/10"
                />
                {signupForm.idNumber && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Display: {formatIdDisplay(signupForm.idNumber)}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="trn-number" className="text-sm text-muted-foreground">TRN (Tax Registration Number)</Label>
                <Input 
                  id="trn-number" 
                  type="text" 
                  placeholder="XXX-XXX-XXX"
                  value={signupForm.trnNumber}
                  onChange={(e) => setSignupForm({ ...signupForm, trnNumber: formatTRN(e.target.value) })}
                  className="mt-1 bg-muted/30 border-white/10"
                  maxLength={11}
                />
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Date of Birth *</Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal mt-1 bg-muted/30 border-white/10",
                        !signupForm.dateOfBirth && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {signupForm.dateOfBirth ? format(signupForm.dateOfBirth, "PPP") : "Select your date of birth"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CustomCalendar
                      selected={signupForm.dateOfBirth}
                      onSelect={(date) => {
                        setSignupForm({ ...signupForm, dateOfBirth: date });
                        setDatePickerOpen(false);
                      }}
                      disabled={(date) => date > new Date() || date < new Date('1920-01-01')}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <Label htmlFor="signup-email" className="text-sm text-muted-foreground">Email *</Label>
                <Input 
                  id="signup-email" 
                  type="email" 
                  placeholder="your@email.com"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  className="mt-1 bg-muted/30 border-white/10"
                />
              </div>

              <div>
                <Label htmlFor="phone" className="text-sm text-muted-foreground">Phone</Label>
                <Input 
                  id="phone" 
                  type="tel" 
                  placeholder="(876) 555-1234"
                  value={signupForm.phone}
                  onChange={(e) => setSignupForm({ ...signupForm, phone: e.target.value })}
                  className="mt-1 bg-muted/30 border-white/10"
                />
              </div>

              <div>
                <Label htmlFor="signup-password" className="text-sm text-muted-foreground">Password *</Label>
                <Input 
                  id="signup-password" 
                  type="password" 
                  placeholder="••••••••"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  className="mt-1 bg-muted/30 border-white/10"
                />
              </div>

              <Button 
                className="w-full bg-foreground text-background hover:bg-foreground/90 py-5"
                disabled={!selectedService || !selectedBranchId || isLoading}
                onClick={handleSignup}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Sign Up & Join Queue
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default JoinQueue;

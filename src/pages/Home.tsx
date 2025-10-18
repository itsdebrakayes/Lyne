import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-image.png";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Modern gradient background with depth */}
      <div className="fixed inset-0 bg-gradient-to-br from-background via-primary/[0.03] to-secondary/[0.05] -z-10" />
      
      {/* Animated gradient orbs */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-5 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-gradient-to-br from-secondary/15 to-primary/15 rounded-full blur-3xl" style={{ animation: 'pulse 8s ease-in-out infinite' }} />
        <div className="absolute -bottom-40 left-1/4 w-[600px] h-[600px] bg-gradient-to-br from-accent/10 to-secondary/10 rounded-full blur-3xl" style={{ animation: 'pulse 10s ease-in-out infinite 2s' }} />
      </div>

      <Navbar />

      {/* Hero Section */}
      <main className="relative">
        <section className="min-h-screen flex items-center justify-center px-4 sm:px-6 md:px-8 pt-24 pb-12 md:pt-32 md:pb-16">
          <div className="w-full max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              
              {/* Left Content - Mobile First */}
              <div className="space-y-8 lg:space-y-10 text-center lg:text-left z-10 order-2 lg:order-1">
                
                {/* Heading Stack */}
                <div className="space-y-4 lg:space-y-6">
                  <div className="inline-block">
                    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm font-medium text-primary mb-4 backdrop-blur-sm">
                      <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      Live Queue Tracking
                    </span>
                  </div>
                  
                  <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold text-foreground leading-[1.1] tracking-tight">
                    QueMe Now
                  </h1>
                  
                  <p className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent leading-tight">
                    Smart Queue Management
                  </p>
                  
                  <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed">
                    Experience the future of queue management. Check live traffic, join queues remotely, and track your position in real-time.
                  </p>
                </div>

                {/* CTA Buttons - Touch Optimized */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Button
                    size="lg"
                    onClick={() => navigate("/about")}
                    className="group relative overflow-hidden rounded-2xl bg-primary hover:bg-primary-dark text-primary-foreground text-base sm:text-lg font-semibold px-8 py-6 sm:py-7 shadow-elevated hover:shadow-[0_35px_100px_-20px_rgba(31,38,135,0.3)] transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] min-h-[56px] w-full sm:w-auto"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Learn More
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary-light to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  </Button>
                  
                  <Button
                    size="lg"
                    onClick={() => navigate("/taj")}
                    className="group rounded-2xl border-2 border-primary/30 bg-background/50 backdrop-blur-sm hover:bg-primary hover:border-primary text-primary hover:text-primary-foreground text-base sm:text-lg font-semibold px-8 py-6 sm:py-7 shadow-glass hover:shadow-glass-hover transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] min-h-[56px] w-full sm:w-auto"
                  >
                    <span className="flex items-center justify-center gap-2">
                      Go to TAJ
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Button>
                </div>

                {/* Stats - Modern Cards */}
                <div className="grid grid-cols-3 gap-3 sm:gap-4 pt-4 lg:pt-6 max-w-lg mx-auto lg:mx-0">
                  <div className="glass rounded-2xl p-4 sm:p-5 text-center hover:scale-105 transition-transform duration-300">
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-br from-primary to-accent bg-clip-text text-transparent">
                      1000+
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">Daily Users</div>
                  </div>
                  <div className="glass rounded-2xl p-4 sm:p-5 text-center hover:scale-105 transition-transform duration-300">
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-br from-secondary to-primary bg-clip-text text-transparent">
                      5
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">Services</div>
                  </div>
                  <div className="glass rounded-2xl p-4 sm:p-5 text-center hover:scale-105 transition-transform duration-300">
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-bold bg-gradient-to-br from-accent to-secondary bg-clip-text text-transparent">
                      24/7
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">Live Updates</div>
                  </div>
                </div>
              </div>

              {/* Right Content - Hero Image */}
              <div className="relative order-1 lg:order-2 lg:block">
                {/* Desktop Image */}
                <div className="hidden lg:block relative animate-fade-in" style={{ animationDelay: '0.3s' }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent rounded-3xl blur-3xl transform scale-110" />
                  <img 
                    src={heroImage} 
                    alt="QueMe Now - Modern Queue Management System"
                    className="relative w-full h-auto max-w-2xl xl:max-w-3xl ml-auto object-contain drop-shadow-2xl"
                  />
                </div>
                
                {/* Mobile/Tablet Image */}
                <div className="lg:hidden relative max-w-md mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-2xl" />
                  <img 
                    src={heroImage} 
                    alt="QueMe Now - Modern Queue Management System"
                    className="relative w-full h-auto object-contain drop-shadow-xl"
                  />
                </div>
              </div>

            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;

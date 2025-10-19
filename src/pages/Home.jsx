import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Zap, Clock, Shield } from "lucide-react";
import heroImage from "@/assets/hero-image.png";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Navbar />

      {/* Animated gradient orbs */}
      <div className="absolute top-20 right-1/4 w-96 h-96 bg-gradient-to-br from-primary/30 to-secondary/30 rounded-full blur-3xl animate-pulse-glow" />
      <div className="absolute bottom-40 left-1/3 w-80 h-80 bg-gradient-to-br from-accent/25 to-primary/25 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/3 left-10 w-64 h-64 bg-gradient-to-br from-secondary/20 to-accent/20 rounded-full blur-3xl animate-float" />

      {/* Hero Section */}
      <section className="min-h-screen flex items-center lg:pl-24 pb-24 lg:pb-0">
        <div className="max-w-7xl mx-auto px-6 md:px-8 lg:px-12 w-full">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8 lg:space-y-10 animate-slide-in-left z-10">
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/20">
                <div className="w-2 h-2 bg-status-light rounded-full animate-pulse" />
                <span className="text-sm font-medium text-foreground/80">Live Queue Updates</span>
              </div>

              <div className="space-y-6">
                <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold leading-[1.1]">
                  <span className="text-foreground">QueMe</span>
                  <br />
                  <span className="gradient-text">Now</span>
                </h1>
                <p className="text-xl sm:text-2xl lg:text-3xl font-semibold text-foreground/70">
                  Join the Line — Without Standing In It
                </p>
                <p className="text-base sm:text-lg lg:text-xl text-muted-foreground max-w-xl leading-relaxed">
                  Smart digital queue management for Tax Administration Jamaica. Check live traffic, join remotely, and track your position in real-time.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  size="lg"
                  className="text-base sm:text-lg px-8 py-6 sm:py-7 rounded-2xl bg-primary hover:bg-primary-dark shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 group relative overflow-hidden"
                  onClick={() => navigate("/taj")}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    Join Queue (TAJ)
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base sm:text-lg px-8 py-6 sm:py-7 rounded-2xl border-2 glass hover:bg-primary/5 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300"
                  onClick={() => navigate("/about")}
                >
                  Learn More
                </Button>
              </div>

              {/* Feature highlights */}
              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="glass p-4 rounded-xl hover:scale-105 transition-transform duration-300">
                  <Zap className="w-6 h-6 text-primary mb-2" />
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">1000+</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Daily Users</div>
                </div>
                <div className="glass p-4 rounded-xl hover:scale-105 transition-transform duration-300">
                  <Clock className="w-6 h-6 text-secondary mb-2" />
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">24/7</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Live Updates</div>
                </div>
                <div className="glass p-4 rounded-xl hover:scale-105 transition-transform duration-300">
                  <Shield className="w-6 h-6 text-accent mb-2" />
                  <div className="text-2xl sm:text-3xl font-bold text-foreground">100%</div>
                  <div className="text-xs sm:text-sm text-muted-foreground">Secure</div>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Image */}
            <div className="relative hidden lg:block animate-slide-up">
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 rounded-3xl blur-3xl opacity-50 animate-pulse-glow" />
              <img 
                src={heroImage} 
                alt="QmeNow digital queue management interface showing real-time queue status" 
                className="relative w-full h-auto max-w-2xl xl:max-w-3xl ml-auto object-contain drop-shadow-2xl"
              />
            </div>

            {/* Mobile Hero Image - Bottom Right Corner */}
            <div className="lg:hidden fixed bottom-0 right-0 w-[60%] sm:w-[50%] max-w-md pointer-events-none z-0">
              <img 
                src={heroImage} 
                alt="QmeNow digital queue management" 
                className="w-full h-auto object-contain opacity-30"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

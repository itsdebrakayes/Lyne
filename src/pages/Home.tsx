import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import heroImage from "@/assets/hero-image.png";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-secondary/10">
      <Navbar />
      
      {/* Decorative blue circles */}
      <div className="absolute top-20 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-20 right-10 w-48 h-48 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />

      {/* Hero Section */}
      <section className="min-h-screen flex items-center pt-20 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 md:px-8 w-full relative">
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center relative">
            {/* Left Content */}
            <div className="space-y-6 md:space-y-8 animate-fade-in z-10">
              <div className="space-y-3 md:space-y-4">
                <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground leading-tight">
                  QueMe Now
                </h1>
                <p className="text-xl sm:text-2xl md:text-3xl text-primary font-semibold">
                  Smart Queue Management
                </p>
                <p className="text-base md:text-lg text-muted-foreground max-w-lg">
                  Experience the future of queue management. Check live traffic, join queues remotely, and track your position in real-time at Tax Administration Jamaica.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-3 md:gap-4">
                <Button
                  size="lg"
                  className="text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-full bg-primary hover:bg-primary-dark shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                  onClick={() => navigate("/about")}
                >
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base md:text-lg px-6 md:px-8 py-5 md:py-6 rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-white shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                  onClick={() => navigate("/taj")}
                >
                  Go to TAJ
                </Button>
              </div>

              {/* Stats */}
              <div className="flex gap-6 md:gap-8 pt-6 md:pt-8 justify-center sm:justify-start">
                <div>
                  <div className="text-2xl md:text-3xl font-bold text-primary">1000+</div>
                  <div className="text-xs md:text-sm text-muted-foreground">Daily Users</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-bold text-primary">5</div>
                  <div className="text-xs md:text-sm text-muted-foreground">Services</div>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-bold text-primary">24/7</div>
                  <div className="text-xs md:text-sm text-muted-foreground">Live Updates</div>
                </div>
              </div>
            </div>

            {/* Right Content - Hero Image */}
            <div className="relative animate-fade-in md:block hidden" style={{ animationDelay: '0.2s' }}>
              <img 
                src={heroImage} 
                alt="QueMe Now Queue Management" 
                className="w-full h-auto max-w-4xl xl:max-w-5xl ml-auto object-contain"
              />
            </div>

            {/* Mobile Hero Image - Bottom Right */}
            <img 
              src={heroImage} 
              alt="QueMe Now Queue Management" 
              className="md:hidden fixed bottom-0 right-0 w-80 sm:w-96 h-auto object-contain opacity-40 z-0 pointer-events-none"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

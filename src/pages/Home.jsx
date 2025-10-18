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
        <div className="w-full px-4 md:px-8 lg:px-12 xl:px-16 relative">
          <div className="relative w-full min-h-[calc(100vh-5rem)]">
            {/* Left Content */}
            <div className="space-y-6 md:space-y-8 lg:space-y-10 animate-fade-in z-10 max-w-3xl">
              <div className="space-y-4 md:space-y-6">
                <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold text-foreground leading-tight">
                  QueMe Now
                </h1>
                <p className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl text-primary font-semibold">
                  Smart Queue Management
                </p>
                <p className="text-lg md:text-xl lg:text-2xl xl:text-3xl text-muted-foreground max-w-2xl">
                  Experience the future of queue management. Check live traffic, join queues remotely, and track your position in real-time at Tax Administration Jamaica.
                </p>
              </div>

              <div className="flex flex-row flex-wrap gap-4 md:gap-5 lg:gap-6">
                <Button
                  size="lg"
                  className="text-lg md:text-xl lg:text-2xl xl:text-3xl px-8 md:px-10 lg:px-14 xl:px-16 py-6 md:py-7 lg:py-8 xl:py-10 rounded-full bg-primary hover:bg-primary-dark shadow-lg hover:shadow-xl transition-all"
                  onClick={() => navigate("/about")}
                >
                  Learn More
                  <ArrowRight className="ml-2 h-5 w-5 md:h-6 md:w-6 lg:h-7 lg:w-7" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg md:text-xl lg:text-2xl xl:text-3xl px-8 md:px-10 lg:px-14 xl:px-16 py-6 md:py-7 lg:py-8 xl:py-10 rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-white shadow-lg hover:shadow-xl transition-all"
                  onClick={() => navigate("/taj")}
                >
                  Go to TAJ
                </Button>
              </div>

              {/* Stats */}
              <div className="flex gap-8 md:gap-10 lg:gap-16 xl:gap-20 pt-8 md:pt-10 lg:pt-12 justify-start">
                <div>
                  <div className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-primary">1000+</div>
                  <div className="text-sm md:text-base lg:text-lg xl:text-xl text-muted-foreground">Daily Users</div>
                </div>
                <div>
                  <div className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-primary">5</div>
                  <div className="text-sm md:text-base lg:text-lg xl:text-xl text-muted-foreground">Services</div>
                </div>
                <div>
                  <div className="text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-primary">24/7</div>
                  <div className="text-sm md:text-base lg:text-lg xl:text-xl text-muted-foreground">Live Updates</div>
                </div>
              </div>
            </div>

            {/* Hero Image - Desktop - Bottom Right Anchored */}
            <div className="hidden md:block fixed bottom-0 right-0 w-[45vw] lg:w-[50vw] xl:w-[55vw] 2xl:w-[60vw] max-w-[1200px] z-0 animate-fade-in pointer-events-none" style={{ animationDelay: '0.2s' }}>
              <img 
                src={heroImage} 
                alt="QueMe Now Queue Management" 
                className="w-full h-auto object-contain"
              />
            </div>

            {/* Mobile Hero Image - Bottom Right */}
            <img 
              src={heroImage} 
              alt="QueMe Now Queue Management" 
              className="md:hidden fixed bottom-0 right-0 w-[70vw] sm:w-[65vw] h-auto object-contain opacity-30 z-0 pointer-events-none"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

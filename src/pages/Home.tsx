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
      
      {/* Hero Section */}
      <section className="h-screen flex items-center relative">
        {/* Hero Image - Full Height */}
        <img 
          src={heroImage} 
          alt="QueMe Now Hero" 
          className="absolute inset-0 w-full h-full object-cover object-right"
        />
        
        {/* Content Overlay */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 w-full">
          <div className="max-w-2xl">
            {/* Left Content */}
            <div className="space-y-8 animate-fade-in">
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-bold text-foreground leading-tight">
                  QueMe Now
                </h1>
                <p className="text-2xl md:text-3xl text-primary font-semibold">
                  Smart Queue Management
                </p>
                <p className="text-lg text-muted-foreground max-w-lg">
                  Experience the future of queue management. Check live traffic, join queues remotely, and track your position in real-time at Tax Administration Jamaica.
                </p>
              </div>

              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 rounded-full bg-primary hover:bg-primary-dark shadow-lg hover:shadow-xl transition-all"
                  onClick={() => navigate("/about")}
                >
                  Learn More
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 rounded-full border-2 border-primary text-primary hover:bg-primary hover:text-white shadow-lg hover:shadow-xl transition-all"
                  onClick={() => navigate("/taj")}
                >
                  Go to TAJ
                </Button>
              </div>

              {/* Stats */}
              <div className="flex gap-8 pt-8">
                <div>
                  <div className="text-3xl font-bold text-primary">1000+</div>
                  <div className="text-sm text-muted-foreground">Daily Users</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">5</div>
                  <div className="text-sm text-muted-foreground">Services</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary">24/7</div>
                  <div className="text-sm text-muted-foreground">Live Updates</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

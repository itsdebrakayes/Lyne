import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

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
      <section className="min-h-screen flex items-center pt-20">
        <div className="max-w-7xl mx-auto px-4 md:px-8 w-full">
          <div className="grid md:grid-cols-2 gap-12 items-center">
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

            {/* Right Content - Image Placeholder */}
            <div className="relative animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <div className="relative aspect-square max-w-lg mx-auto">
                {/* Placeholder for hero image */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-3xl backdrop-blur-sm flex items-center justify-center border-2 border-primary/20">
                  <div className="text-center space-y-4">
                    <div className="w-32 h-32 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-4xl">🎯</span>
                    </div>
                    <p className="text-muted-foreground text-sm">Hero image will be displayed here</p>
                  </div>
                </div>
                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-primary rounded-2xl blur-xl opacity-50" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-secondary rounded-2xl blur-xl opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

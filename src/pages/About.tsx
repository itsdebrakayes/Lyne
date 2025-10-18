import { Navbar } from "@/components/Navbar";
import { GlassCard } from "@/components/GlassCard";
import { Clock, Users, Shield, Zap } from "lucide-react";

const About = () => {
  const features = [
    {
      icon: Clock,
      title: "Save Time",
      description: "Check wait times before you leave home and plan your visit accordingly.",
    },
    {
      icon: Users,
      title: "Real-time Updates",
      description: "Get live updates on queue status and your position in line.",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data is encrypted and handled with the highest security standards.",
    },
    {
      icon: Zap,
      title: "Fast & Efficient",
      description: "Streamlined process to get you in and out as quickly as possible.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-secondary/10">
      <Navbar />
      
      <div className="pt-32 pb-16 px-4 md:px-8">
        <div className="max-w-6xl mx-auto space-y-16">
          {/* Header */}
          <div className="text-center space-y-4 animate-fade-in">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground">
              About QueMe Now
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Revolutionizing the way you interact with Tax Administration Jamaica through smart technology and real-time data.
            </p>
          </div>

          {/* Mission */}
          <GlassCard className="p-8 md:p-12 animate-slide-up">
            <div className="space-y-4">
              <h2 className="text-3xl font-bold text-primary">Our Mission</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                QueMe Now is designed to eliminate the frustration of long wait times and uncertainty. 
                We provide real-time traffic information, remote queue joining, and live position tracking 
                to make your visit to Tax Administration Jamaica as smooth and efficient as possible.
              </p>
            </div>
          </GlassCard>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <GlassCard
                key={feature.title}
                className="p-8 animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <feature.icon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </GlassCard>
            ))}
          </div>

          {/* How It Works */}
          <div className="space-y-8 animate-slide-up">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-foreground">
              How It Works
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: 1, title: "Check Traffic", desc: "View live traffic data for all services" },
                { step: 2, title: "Join Queue", desc: "Select your service and get your ticket" },
                { step: 3, title: "Track Position", desc: "Monitor your position in real-time" },
              ].map((item) => (
                <GlassCard key={item.step} className="p-8 text-center">
                  <div className="space-y-4">
                    <div className="w-16 h-16 mx-auto bg-primary text-white rounded-full flex items-center justify-center text-2xl font-bold">
                      {item.step}
                    </div>
                    <h3 className="text-xl font-bold text-foreground">{item.title}</h3>
                    <p className="text-muted-foreground">{item.desc}</p>
                  </div>
                </GlassCard>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;

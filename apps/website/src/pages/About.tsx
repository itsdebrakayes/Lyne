/**
 * About — Lyne story, mission and values in the marketing design language.
 */
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Clock, Users, Shield, Zap, ArrowRight } from "lucide-react";
import { MarketingNav, MarketingFooter } from "@/components/lyne/Marketing";

const features = [
  {
    icon: Clock,
    title: "Save time",
    description: "Check wait times before you leave home and plan your visit accordingly.",
  },
  {
    icon: Users,
    title: "Real-time updates",
    description: "Get live updates on queue status and your position in line.",
  },
  {
    icon: Shield,
    title: "Secure & private",
    description: "Your data is encrypted and handled with the highest security standards.",
  },
  {
    icon: Zap,
    title: "Fast & efficient",
    description: "Streamlined process to get you in and out as quickly as possible.",
  },
];

const steps = [
  { step: "01", title: "Check the wait", desc: "View live wait times for every branch and service" },
  { step: "02", title: "Join the queue", desc: "Pick your service and get your ticket from anywhere" },
  { step: "03", title: "Track your spot", desc: "Watch your position update in real time until you're called" },
];

const About = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-lyne-night text-white">
      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-lyne-purple/20 blur-[140px]" />
        <div className="absolute top-[40%] left-[-15%] h-[460px] w-[460px] rounded-full bg-lyne-violet/25 blur-[150px]" />
      </div>

      <MarketingNav />

      <div className="pb-24 pt-20">
        <div className="lux-container space-y-16">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              The story behind <span className="serif accent-text">the calm.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-lyne-lavender/70">
              Revolutionizing the way people wait — with smart technology,
              real-time data, and queues that respect everyone's time.
            </p>
          </motion.div>

          {/* Mission */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="panel-elev p-8 md:p-12"
          >
            <h2 className="mb-4 text-3xl font-bold tracking-tight">
              Our <span className="serif accent-text">mission.</span>
            </h2>
            <p className="max-w-3xl text-lg leading-relaxed text-lyne-lavender/75">
              Lyne is designed to eliminate the frustration of long wait times
              and uncertainty. We provide real-time queue information, remote
              joining, and live position tracking so a visit to any of our partner
              institutions is as smooth and efficient as possible — for the
              customers in line and the teams serving them.
            </p>
          </motion.div>

          {/* Features Grid */}
          <div className="grid gap-5 md:grid-cols-2">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.05 }}
                className="panel panel-hover p-8"
              >
                <span className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-lyne-purple/15 text-lyne-lavender">
                  <feature.icon className="h-6 w-6" />
                </span>
                <h3 className="mb-2 text-2xl font-semibold tracking-tight">{feature.title}</h3>
                <p className="leading-relaxed text-lyne-lavender/70">{feature.description}</p>
              </motion.div>
            ))}
          </div>

          {/* How It Works */}
          <div>
            <h2 className="mb-10 text-center text-3xl font-bold tracking-tight md:text-4xl">
              How it <span className="serif accent-text">works.</span>
            </h2>
            <div className="grid gap-5 md:grid-cols-3">
              {steps.map((item) => (
                <div key={item.step} className="panel-elev p-8 text-center">
                  <div className="mb-4 font-serif text-5xl italic accent-text">{item.step}</div>
                  <h3 className="mb-2 text-xl font-semibold tracking-tight">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-lyne-lavender/65">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <Link to="/join-us" className="btn btn-primary btn-lg">
              Partner with us <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
};

export default About;

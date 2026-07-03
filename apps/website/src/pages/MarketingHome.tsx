/**
 * QME Now — Marketing Landing Page
 * Design ported from queue-master-reimagined (Lovable): deep violet canvas,
 * hairline glass panels, serif accents, aurora text-clip hero.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  ArrowRight,
  Clock,
  QrCode,
  Bell,
  Zap,
  TrendingUp,
  ShieldCheck,
  Check,
  X,
  Building2,
  Mail,
  Star,
  Radio,
  Layers,
  Sparkles,
  Users,
  MapPin,
} from "lucide-react";
import { MarketingNav, MarketingFooter } from "@/components/qme/Marketing";
import { FloatingSquares } from "@/components/qme/FloatingSquares";
import heroAurora from "@/assets/hero-aurora.jpg";

export default function MarketingHome() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-qme-night text-white">
      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-qme-purple/20 blur-[140px]" />
        <div className="absolute top-[40%] left-[-15%] h-[460px] w-[460px] rounded-full bg-qme-violet/25 blur-[150px]" />
        <div className="absolute bottom-0 right-[10%] h-[400px] w-[400px] rounded-full bg-qme-purple/10 blur-[140px]" />
      </div>

      <MarketingNav />
      <Hero />
      <WhatItIs />
      <TheOldWay />
      <Features />
      <HowItWorks />
      <Pricing />
      <ForBusiness />
      <Testimonials />
      <Newsletter />
      <MarketingFooter />
    </div>
  );
}

/* ------------------------------ HERO ------------------------------ */

function Hero() {
  return (
    <section className="relative flex min-h-[92vh] items-center justify-center overflow-hidden pb-28 pt-24">
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      {/* ambient hero glows */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[46%] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-qme-purple/25 blur-[160px]" />
        <div className="absolute left-[10%] top-[58%] h-[24rem] w-[24rem] rounded-full bg-qme-violet/30 blur-[150px]" />
        <div className="absolute right-[8%] top-[40%] h-[24rem] w-[24rem] rounded-full bg-qme-purple/20 blur-[150px]" />
      </div>

      {/* floating glass squares with cursor parallax */}
      <FloatingSquares />

      <div className="lux-container relative z-20 text-center">
        <motion.span
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="chip mx-auto"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-qme-green blink-dot" />
          Trusted by Jamaica's leading institutions
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-7 max-w-4xl text-balance text-6xl font-bold leading-[1.02] tracking-tight text-white sm:text-7xl lg:text-8xl xl:max-w-5xl xl:text-[6.5rem] 2xl:text-[7rem]"
        >
          The calm{" "}
          <span
            className="serif text-clip-img text-clip-glow"
            style={{ backgroundImage: `url(${heroAurora})` }}
          >
            queue layer
          </span>
          <br className="hidden sm:block" /> for modern business.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-qme-lavender/75 xl:text-xl"
        >
          QME Now replaces crowded waiting rooms and guesswork with a single
          live queue — real-time wait times, barcode check-in and dashboards for
          everyone from a single counter to a multi-branch network.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a href="#pricing" className="btn btn-primary btn-lg">
            Download the app <ArrowUpRight className="h-5 w-5" />
          </a>
          <a href="#features" className="btn btn-ghost btn-lg">
            Learn more <ArrowRight className="h-5 w-5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}

/* --------------------------- WHAT IT IS --------------------------- */

function WhatItIs() {
  return (
    <section className="py-24 md:py-32">
      <div className="lux-container grid items-start gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="chip chip-mute mb-5">What it is</div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            One quiet system for <span className="serif accent-text">everything that happens</span> before the appointment.
          </h2>
        </div>
        <div className="space-y-5 text-lg leading-relaxed text-qme-lavender/75 lg:col-span-7">
          <p>
            <strong className="text-white">QME Now</strong> replaces the clipboard,
            the sign-in sheet and the "how long's the wait?" chorus with a single
            live queue your clients can join from their phone — and watch in
            real time.
          </p>
          <p>
            Clients always know where they stand. Your team works from calm,
            purpose-built dashboards. Owners get a live operating picture across
            every location — no spreadsheets, no hardware, no training day.
          </p>
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            {[
              { i: Radio, t: "Real-time" },
              { i: ShieldCheck, t: "Secure by design" },
              { i: Layers, t: "Built for teams" },
            ].map(({ i: Icon, t }) => (
              <div key={t} className="panel flex items-center gap-3 px-4 py-3">
                <Icon className="h-5 w-5 text-qme-lavender" />
                <span className="text-sm font-medium text-white">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- THE OLD WAY --------------------------- */

function TheOldWay() {
  const oldWay = [
    { icon: Users, title: "Stand in a physical line", body: "Show up, join the back of the crowd, and hope it moves. Leaving means losing your place." },
    { icon: QrCode, title: "Take a paper number", body: "Pull a ticket and stare at a wall display. No idea if it's 10 minutes or two hours away." },
    { icon: Clock, title: "Guess the wait", body: "No visibility into how busy it is before you leave home — so you plan your whole day around it." },
    { icon: Bell, title: "Miss your turn", body: "Step out for air or a call and your number gets skipped. Back to the end of the line." },
  ];
  const newWay = [
    { icon: MapPin, title: "Join from anywhere", body: "See live wait times across every branch and take your place in line from your phone — before you leave." },
    { icon: Clock, title: "Watch your spot move", body: "Your position and estimated wait update in real time. Wait from your car, a café, or your couch." },
    { icon: Bell, title: "Get called at the right moment", body: "A push notification tells you exactly when to head over — plus a GPS-aware reminder if you're far away." },
    { icon: ShieldCheck, title: "Keep your place", body: "A scannable barcode ticket verifies you at the counter. No crowding, no line-jumping, no lost turns." },
  ];
  return (
    <section className="border-t border-white/[0.06] py-24 md:py-32">
      <div className="lux-container">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <div className="chip chip-mute mb-5">Why it matters</div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            The line hasn't changed in <span className="serif accent-text">a hundred years.</span>
          </h2>
          <p className="mt-4 text-lg text-qme-lavender/70">
            Most places still run on a crowded room and a paper ticket. QME Now
            replaces the whole experience — for the people waiting and the people serving.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Old way */}
          <div className="panel p-7">
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-qme-lavender/60">
                <X className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-qme-lavender/50">Today, without QME Now</div>
                <div className="text-lg font-semibold">The take-a-number line</div>
              </div>
            </div>
            <div className="space-y-4">
              {oldWay.map((item) => (
                <div key={item.title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04] text-qme-lavender/45">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="font-semibold text-white/80">{item.title}</h4>
                    <p className="text-[14px] leading-relaxed text-qme-lavender/55">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* New way */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="panel-elev p-7 ring-1 ring-qme-purple/40 shadow-[0_0_70px_-24px_rgba(123,95,255,0.65)]"
          >
            <div className="mb-6 flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-qme-purple/30 bg-qme-purple/15 text-qme-lavender">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-qme-lavender/70">With QME Now</div>
                <div className="text-lg font-semibold">The calm live queue</div>
              </div>
            </div>
            <div className="space-y-4">
              {newWay.map((item) => (
                <div key={item.title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-qme-purple/20 text-qme-lavender">
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="font-semibold text-white">{item.title}</h4>
                    <p className="text-[14px] leading-relaxed text-qme-lavender/70">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Impact stats */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { stat: "0", label: "minutes standing in a physical line" },
            { stat: "Live", label: "wait times before you leave home" },
            { stat: "1 tap", label: "to rejoin if your turn slips" },
          ].map((s) => (
            <div key={s.label} className="panel px-6 py-6 text-center">
              <div className="font-serif text-4xl italic accent-text">{s.stat}</div>
              <div className="mt-2 text-sm text-qme-lavender/65">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- FEATURES ---------------------------- */

function Features() {
  const features = [
    { icon: Clock, tag: "Live", title: "Real-time wait times", body: "Customers always know exactly how long until their turn — no guessing, no crowding, no front-desk interruptions." },
    { icon: QrCode, tag: "Secure", title: "Barcode check-in", body: "A scannable ticket code verifies every customer before service starts — the line stays honest and on schedule." },
    { icon: Zap, tag: "Teams", title: "Role-based dashboards", body: "Line staff, manager and executive views out of the box — each person sees exactly what they need, nothing more." },
    { icon: Bell, tag: "Focus", title: "Smart notifications", body: "Automatic 'you're next' pings — and GPS-aware departure reminders — let customers wait wherever they like." },
    { icon: TrendingUp, tag: "Insight", title: "Live analytics", body: "Throughput, no-shows and wait times per branch — tracked on charts that update as the day unfolds." },
    { icon: ShieldCheck, tag: "Trust", title: "Reliable & secure", body: "Encrypted traffic and role-scoped access keep customer data locked down and your operation audit-ready." },
  ];
  return (
    <section id="features" className="scroll-mt-24 border-t border-white/[0.06] py-24 md:py-28">
      <div className="lux-container">
        <div className="mb-14 max-w-2xl">
          <div className="chip chip-mute mb-5">The product</div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Six tools. <span className="serif accent-text">One calm surface.</span>
          </h2>
          <p className="mt-4 text-lg text-qme-lavender/70">
            Each piece works on its own — together they become the daily backbone
            of how your business runs.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="panel panel-hover flex flex-col p-6"
            >
              <div className="mb-5 flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-qme-purple/15 text-qme-lavender">
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-qme-lavender/50">
                  {f.tag}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-semibold tracking-tight">{f.title}</h3>
              <p className="text-[15px] leading-relaxed text-qme-lavender/70">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------- HOW IT WORKS -------------------------- */

function HowItWorks() {
  const steps = [
    { n: "01", t: "Join from anywhere", d: "Customers pick a branch in the app and drop straight into the live queue — before they even leave home." },
    { n: "02", t: "Track in real time", d: "They watch their position and wait time update live on their phone, free to wait wherever they like." },
    { n: "03", t: "Get the call", d: "A push notification tells them to head over the moment you're ready. No shouting names across the room." },
    { n: "04", t: "Run the numbers", d: "Every visit feeds your dashboards — so owners see throughput and efficiency without lifting a finger." },
  ];
  return (
    <section className="border-t border-white/[0.06] py-24 md:py-32">
      <div className="lux-container">
        <div className="mb-14 max-w-3xl">
          <div className="chip chip-mute mb-5">How it works</div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            From download to <span className="serif accent-text">a calmer day</span> in minutes.
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="panel-elev relative overflow-hidden p-6">
              <div className="mb-3 font-serif text-5xl italic accent-text">{s.n}</div>
              <h4 className="mb-1.5 text-lg font-semibold tracking-tight">{s.t}</h4>
              <p className="text-sm leading-relaxed text-qme-lavender/65">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- PRICING ---------------------------- */

const plans = [
  {
    name: "Free",
    price: { m: "Free", y: "Free" },
    desc: "For customers checking in and tracking their place in line.",
    features: ["Join any QME Now queue", "Live position & wait time", "Barcode check-in ticket", "Push notifications", "Visit history"],
    highlighted: false,
    cta: "Download the app for free",
    href: "#pricing",
    internal: false,
  },
  {
    name: "Pro",
    price: { m: "$9.99/mo", y: "$95.90/yr" },
    desc: "For frequent customers who want priority and richer tracking.",
    features: ["Everything in Free", "Priority queue notifications", "Favourites with branch wait times", "Personal queue analytics", "Multi-line tracking"],
    highlighted: true,
    cta: "Start a subscription",
    href: "#pricing",
    internal: false,
  },
  {
    name: "Executive / Business",
    price: { m: "Custom", y: "Custom" },
    desc: "For businesses running their own queues across one or many locations.",
    features: ["Staff, Manager & Executive dashboards", "Unlimited counters & branches", "Live analytics & no-show handling", "Predictive insights & heatmaps", "Dedicated onboarding & support"],
    highlighted: false,
    cta: "Get a license quote",
    href: "/join-us",
    internal: true,
  },
];

function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" className="scroll-mt-24 border-t border-white/[0.06] py-24 md:py-32">
      <div className="lux-container">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <div className="chip chip-mute mb-5">Plans · for the mobile app</div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Plans that <span className="serif accent-text">grow with you.</span>
          </h2>
          <p className="mt-4 text-lg text-qme-lavender/70">
            Download the app for free, start a subscription, or license QME Now
            for your business.
          </p>
        </div>

        <div className="mb-12 flex items-center justify-center gap-3">
          <span className={`text-sm ${!yearly ? "text-white" : "text-qme-lavender/55"}`}>Monthly</span>
          <button
            onClick={() => setYearly((v) => !v)}
            className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${yearly ? "bg-qme-purple" : "bg-white/15"}`}
            aria-label="Toggle yearly billing"
          >
            <span className={`h-5 w-5 rounded-full bg-white transition-transform ${yearly ? "translate-x-5" : ""}`} />
          </button>
          <span className={`text-sm ${yearly ? "text-white" : "text-qme-lavender/55"}`}>
            Yearly
            <span className="ml-2 rounded-full bg-qme-green/20 px-2 py-0.5 text-xs text-qme-green">Save 20%</span>
          </span>
        </div>

        <div className="grid items-stretch gap-6 md:grid-cols-3">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`flex flex-col p-7 ${
                plan.highlighted
                  ? "panel-elev shadow-[0_0_70px_-20px_rgba(123,95,255,0.7)] ring-1 ring-qme-purple/40"
                  : "panel"
              }`}
            >
              {plan.highlighted && (
                <span className="chip mb-4 w-fit">
                  <Sparkles className="h-3 w-3" /> Most popular
                </span>
              )}
              <p className="text-sm text-qme-lavender/65">{plan.name}</p>
              <p className="mt-1 text-4xl font-bold tracking-tight">{yearly ? plan.price.y : plan.price.m}</p>
              <p className="mt-3 text-sm text-qme-lavender/60">{plan.desc}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10">
                      <Check className="h-3 w-3 text-qme-green" />
                    </span>
                    <span className="text-qme-lavender/85">{f}</span>
                  </li>
                ))}
              </ul>
              {plan.internal ? (
                <Link
                  to={plan.href}
                  className={`mt-8 block rounded-full py-3.5 text-center text-sm font-semibold transition-transform hover:scale-[1.02] ${
                    plan.highlighted ? "btn-primary" : "border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <a
                  href={plan.href}
                  className={`mt-8 block rounded-full py-3.5 text-center text-sm font-semibold transition-transform hover:scale-[1.02] ${
                    plan.highlighted ? "btn-primary" : "border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  {plan.cta}
                </a>
              )}
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-qme-lavender/50">
          iOS and Android apps are coming to the App Store and Google Play.
        </p>
      </div>
    </section>
  );
}

/* --------------------------- FOR BUSINESS --------------------------- */

function ForBusiness() {
  const points = [
    { t: "A live operating picture", d: "See every branch's queue, throughput and efficiency in one place — the way you'd check the weather." },
    { t: "Zero new hardware", d: "Works on the phones, tablets and desktops you already own. Set up a branch in an afternoon." },
    { t: "Role-scoped access", d: "Line staff, managers and executives each get a focused dashboard. Permissions live server-side, validated on every read." },
    { t: "No-show protection", d: "Automated reminders and smart hold windows quietly recover the time empty counters used to cost you." },
    { t: "Predictive insights", d: "Notebook-driven analytics recommend staffing levels, flag busy hours, and score branch performance." },
  ];
  return (
    <section id="partners" className="scroll-mt-24 border-t border-white/[0.06] py-24 md:py-32">
      <div className="lux-container grid items-start gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5 lg:sticky lg:top-24">
          <div className="chip mb-5">
            <Building2 className="h-3.5 w-3.5" /> Partners & business
          </div>
          <h2 className="mb-5 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Trusted by the teams <span className="serif accent-text">that run the day.</span>
          </h2>
          <p className="mb-7 text-lg leading-relaxed text-qme-lavender/70">
            From government agencies to clinics and studios, QME Now powers calmer
            queues at scale. Want to bring it to your business? Size your setup
            and talk to sales about a license.
          </p>
          <Link to="/join-us" className="btn btn-primary">
            Contact sales <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Tax Administration Jamaica", "NHT", "PICA"].map((p) => (
              <span key={p} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-qme-lavender/80">
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-3 lg:col-span-7">
          {points.map((x) => (
            <div key={x.t} className="panel flex items-start gap-4 p-5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-qme-purple/30 bg-qme-purple/15">
                <Check className="h-4 w-4 text-qme-lavender" />
              </div>
              <div>
                <h4 className="mb-1 text-lg font-semibold tracking-tight">{x.t}</h4>
                <p className="text-[15px] leading-relaxed text-qme-lavender/65">{x.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------- TESTIMONIALS -------------------------- */

function Testimonials() {
  const quotes = [
    { name: "Maya R.", role: "Branch Manager", body: "We cut our walk-in chaos overnight. Customers love seeing their spot in line, and no-shows dropped by a third." },
    { name: "Devon K.", role: "Line Staff", body: "The service timer keeps me on schedule and the barcode check-in means nobody jumps the queue. Quietly brilliant." },
    { name: "Priya S.", role: "Regional Executive", body: "The executive dashboard finally gives me a live view across all five branches. I check it with my coffee." },
  ];
  return (
    <section className="border-t border-white/[0.06] py-24 md:py-32">
      <div className="lux-container">
        <div className="mx-auto mb-14 max-w-2xl text-center">
          <div className="chip chip-mute mb-5">Loved by teams</div>
          <h2 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Calmer days, <span className="serif accent-text">in their words.</span>
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {quotes.map((q) => (
            <div key={q.name} className="panel flex flex-col p-6">
              <div className="flex gap-1 text-qme-yellow">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <p className="mt-4 flex-1 text-[15px] leading-relaxed text-qme-lavender/85">"{q.body}"</p>
              <div className="mt-6 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-qme-purple/30 text-xs font-bold">
                  {q.name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold">{q.name}</p>
                  <p className="text-xs text-qme-lavender/55">{q.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- NEWSLETTER --------------------------- */

function Newsletter() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <section className="border-t border-white/[0.06] py-24">
      <div className="w-full px-6 md:px-10 lg:px-16">
        <div className="panel-elev relative overflow-hidden px-8 py-16 text-center md:px-16 lg:py-20">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-qme-purple/30 blur-3xl" />
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-qme-purple/15 text-qme-lavender">
            <Mail className="h-5 w-5" />
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            Stay in <span className="serif accent-text">the loop.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-qme-lavender/65">
            Product updates, queue craft and the occasional behind-the-scenes.
            No spam — unsubscribe anytime.
          </p>

          {submitted ? (
            <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-qme-green/20 px-5 py-3 text-sm font-semibold text-qme-green">
              <Check className="h-4 w-4" /> You're subscribed! Check your inbox.
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) setSubmitted(true);
              }}
              className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.com"
                maxLength={255}
                className="flex-1 rounded-full border border-white/[0.12] bg-white/[0.05] px-5 py-3.5 text-sm outline-none placeholder:text-white/30 focus:border-qme-purple"
              />
              <button
                type="submit"
                disabled={!valid}
                className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Subscribe
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

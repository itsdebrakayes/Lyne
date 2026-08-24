import { useState } from "react";
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
  Building2,
  Mail,
  Radio,
  Layers,
  Sparkles,
} from "lucide-react";
import { MobileMarketingNav, MobileMarketingFooter } from "@/components/lyne/mobile/MobileMarketing";
import { FloatingSquares } from "@/components/lyne/FloatingSquares";
import heroAurora from "@/assets/hero-aurora.jpg";


export default function MobileMarketingHome() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-lyne-night text-white">
      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-lyne-purple/20 blur-[140px]" />
        <div className="absolute top-[40%] left-[-15%] h-[460px] w-[460px] rounded-full bg-lyne-violet/25 blur-[150px]" />
        <div className="absolute bottom-0 right-[10%] h-[400px] w-[400px] rounded-full bg-lyne-purple/10 blur-[140px]" />
      </div>

      <MobileMarketingNav />
      <Hero />
      <WhatItIs />
      <Features />
      <HowItWorks />
      <Pricing />
      <ForBusiness />
      <Newsletter />
      <MobileMarketingFooter />
    </div>
  );
}

/* ------------------------------ HERO ------------------------------ */

function Hero() {
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden pb-20 pt-14 sm:pb-24 sm:pt-20">
      <div className="pointer-events-none absolute inset-0 grid-bg" />

      {/* ambient hero glows */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[46%] h-[46rem] w-[46rem] -translate-x-1/2 rounded-full bg-lyne-purple/25 blur-[160px]" />
        <div className="absolute left-[10%] top-[58%] h-[24rem] w-[24rem] rounded-full bg-lyne-violet/30 blur-[150px]" />
        <div className="absolute right-[8%] top-[40%] h-[24rem] w-[24rem] rounded-full bg-lyne-purple/20 blur-[150px]" />
      </div>

      {/* floating glass squares with cursor parallax */}
      <FloatingSquares />

      <div className="lux-container relative z-20 text-center">

        <motion.h1
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-balance text-[3.15rem] font-bold leading-[0.98] tracking-tight text-white sm:text-6xl"
        >
          Stop waiting around.
          <br /> Hold your spot.
          <br /> In{" "}
          <span className="relative inline-block align-baseline">
            {/* snaking flourish that trails off the wordmark */}
            <svg
              viewBox="0 0 600 220"
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[2.8em] w-[5.5em] -translate-x-1/2 -translate-y-1/2 overflow-visible opacity-70 sm:h-[3.2em] sm:w-[7em]"
            >
              <path
                d="M-160 150 C -40 200, 60 130, 120 70 S 240 -20, 300 40 S 420 190, 520 120 S 700 40, 820 90"
                fill="none"
                stroke="url(#lyneFlourish)"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="lyneFlourish" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2f6bff" stopOpacity="0" />
                  <stop offset="25%" stopColor="#2f6bff" stopOpacity="0.75" />
                  <stop offset="60%" stopColor="#b7d5ff" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#b7d5ff" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <span
              className="hero-wordmark script text-clip-img text-clip-glow inline-block pr-[0.06em] text-[1.42em] sm:text-[1.58em]"
              style={{ backgroundImage: `url(${heroAurora})` }}
            >
              Lyne
            </span>
          </span>
        </motion.h1>


        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mx-auto mt-10 max-w-xl text-base leading-relaxed text-lyne-lavender/75 sm:text-lg"
        >
          Lyne shows you how long the wait really is before you leave home,
          holds your spot while you go about your day, and tells you when it is
          your turn. Simple for you. Simple for the people serving you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
        >
          <a href="#pricing" className="btn btn-primary btn-lg w-full sm:w-auto">
            Get the app free <ArrowUpRight className="h-5 w-5" />
          </a>
          <a href="#features" className="btn btn-ghost btn-lg w-full sm:w-auto">
            See how it works <ArrowRight className="h-5 w-5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}


/* --------------------------- WHAT IT IS --------------------------- */

function WhatItIs() {
  return (
    <section className="py-16 sm:py-20">
      <div className="lux-container grid items-start gap-8">
        <div>
          <div className="chip chip-mute mb-5">What it is</div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            A simpler way to <span className="serif accent-text">wait your turn</span> — for everybody.
          </h2>
        </div>
        <div className="space-y-5 text-base leading-relaxed text-lyne-lavender/75 sm:text-lg">
          <p>
            <strong className="text-white">Lyne</strong> takes away the sign-in
            sheet, the crowded waiting area and the endless "how much longer?"
            You join from your phone, you see exactly where you are, and you
            watch it move in real time.
          </p>
          <p>
            Customers always know where they stand. Staff work from a clear,
            easy screen instead of shouting names. Owners see how the day is
            going across every branch — no paperwork, no new machines, no
            training day.
          </p>
          <div className="grid gap-3 pt-2 sm:grid-cols-3">
            {[
              { i: Radio, t: "Live updates" },
              { i: ShieldCheck, t: "Secure by design" },
              { i: Layers, t: "Easy for everyone" },
            ].map(({ i: Icon, t }) => (
              <div key={t} className="panel flex items-center gap-3 px-4 py-3">
                <Icon className="h-5 w-5 text-lyne-lavender" />
                <span className="text-sm font-medium text-white">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- FEATURES ---------------------------- */

function Features() {
  const features = [
    { icon: Clock, tag: "Live", title: "See the real wait", body: "Know how long it will take before you leave home — no guessing, and no standing around wondering." },
    { icon: QrCode, tag: "Fair", title: "Scan to check in", body: "A quick scan confirms you are there. Nobody skips ahead, and nobody loses their spot." },
    { icon: Bell, tag: "Free time", title: "We will call you", body: "Get a ping when you are next, so you can run an errand or grab something to eat and still keep your place." },
    { icon: Zap, tag: "Staff", title: "Screens that make sense", body: "Front desk, supervisor and owner each get one simple screen showing only what they need." },
    { icon: TrendingUp, tag: "Insight", title: "Know your busy hours", body: "See how many people you served, when the rush hits, and where things slow down — updated as the day goes." },
    { icon: ShieldCheck, tag: "Trust", title: "Safe and private", body: "Strong encryption and strict access rules keep customer details protected from day one." },
  ];
  return (
    <section id="features" className="scroll-mt-20 border-t border-white/[0.06] py-16 sm:py-20">
      <div className="lux-container">
        <div className="mb-14 max-w-2xl">
          <div className="chip chip-mute mb-5">The product</div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Six simple things. <span className="serif accent-text">One easy app.</span>
          </h2>
          <p className="mt-4 text-lg text-lyne-lavender/70">
            Each one helps on its own. Together they change how your whole day
            runs.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-lyne-purple/15 text-lyne-lavender">
                  <f.icon className="h-5 w-5" />
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-lyne-lavender/50">
                  {f.tag}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-semibold tracking-tight">{f.title}</h3>
              <p className="text-[15px] leading-relaxed text-lyne-lavender/70">{f.body}</p>
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
    { n: "01", t: "Join the line", d: "Scan a code or tap a link and you are in. No download needed to get started." },
    { n: "02", t: "Watch it move", d: "See your number and your wait time update live on your phone. Wait wherever you like." },
    { n: "03", t: "Get the ping", d: "Your phone tells you when to head over. No shouting names across the room." },
    { n: "04", t: "See the day clearly", d: "Every visit feeds the owner screen, so the business knows how it is doing without lifting a finger." },
  ];
  return (
    <section className="border-t border-white/[0.06] py-16 sm:py-20">
      <div className="lux-container">
        <div className="mb-14 max-w-3xl">
          <div className="chip chip-mute mb-5">How it works</div>
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Up and running in <span className="serif accent-text">minutes,</span> not months.
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {steps.map((s) => (
            <div key={s.n} className="panel-elev relative overflow-hidden p-6">
              <div className="mb-3 font-serif text-5xl italic accent-text">{s.n}</div>
              <h4 className="mb-1.5 text-lg font-semibold tracking-tight">{s.t}</h4>
              <p className="text-sm leading-relaxed text-lyne-lavender/65">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* --------------------------- FOR BUSINESS --------------------------- */

function ForBusiness() {
  const points = [
    { t: "You see your whole day at a glance", d: "Every branch, how many people are waiting and how fast you are moving — as easy to check as the weather." },
    { t: "Nothing new to buy", d: "Print one code and you are live. It works on the phones and tablets you already have." },
    { t: "Everybody sees only their part", d: "Front desk, supervisor and owner each get their own screen, with access checked on our side every single time." },
    { t: "Fewer people walking away", d: "Reminders and short hold windows bring back the money that empty chairs and long waits used to cost you." },
    { t: "It can carry your brand", d: "Your colours, your name and your look on the customer experience. We fit in; we do not take over." },
    { t: "We grow with you", d: "Start with one location and add more whenever you are ready — no rebuild, no restart." },
  ];
  return (
    <section id="partners" className="scroll-mt-20 border-t border-white/[0.06] py-16 sm:py-20">
      <div className="lux-container grid items-start gap-10">
        <div>
          <div className="chip mb-5">
            <Building2 className="h-3.5 w-3.5" /> For business
          </div>
          <h2 className="mb-5 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Trust us to help you <span className="serif accent-text">run your day.</span>
          </h2>
          <p className="mb-7 text-lg leading-relaxed text-lyne-lavender/70">
            Lyne is brand new, and we are looking for the first businesses to
            build it with. Whether you serve ten people a day or ten thousand,
            here is what you stand to gain when you come on board early.
          </p>
          <a href="mailto:hello@lyne.app" className="btn btn-primary min-h-12 w-full sm:w-auto">
            Talk to us <ArrowRight className="h-4 w-4" />
          </a>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Early-partner pricing", "Set up with you", "Direct line to the team"].map((p) => (
              <span key={p} className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-lyne-lavender/80">
                {p}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {points.map((x) => (
            <div key={x.t} className="panel flex items-start gap-4 p-5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-lyne-purple/30 bg-lyne-purple/15">
                <Check className="h-4 w-4 text-lyne-lavender" />
              </div>
              <div>
                <h4 className="mb-1 text-lg font-semibold tracking-tight">{x.t}</h4>
                <p className="text-[15px] leading-relaxed text-lyne-lavender/65">{x.d}</p>
              </div>
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
    desc: "For anybody checking in and keeping track of their spot.",
    features: ["Join any Lyne", "Live spot number and wait time", "Scan-to-check-in pass", "Push notifications", "Visit history"],
    highlighted: false,
    cta: "Download the app for free",
    href: "#pricing",
  },
  {
    name: "Pro",
    price: { m: "$9.99/mo", y: "$95.90/yr" },
    desc: "For people who wait often and want more control.",
    features: ["Everything in Free", "Priority alerts when it is nearly your turn", "Favourites with branch wait times", "Your own wait history and trends", "Track more than one line at a time"],
    highlighted: true,
    cta: "Start a subscription",
    href: "#partners",
  },
  {
    name: "Business",
    price: { m: "Custom", y: "Custom" },
    desc: "For businesses running their own lines, at one place or many.",
    features: ["Front desk, supervisor & owner screens", "Unlimited stations & locations", "Live numbers and no-show handling", "White-label & API access", "Dedicated onboarding & support"],
    highlighted: false,
    cta: "Buy a license",
    href: "#partners",
  },
];

function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" className="scroll-mt-20 border-t border-white/[0.06] py-16 sm:py-20">
      <div className="lux-container">
        <div className="mx-auto mb-10 max-w-2xl overflow-visible text-center">
          <div className="chip chip-mute mb-5">Plans</div>
          <h2 className="pb-1 text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl">
            Plans that <span className="serif accent-text">grow with you.</span>
          </h2>
          <p className="mt-4 text-lg text-lyne-lavender/70">
            Get the app free, upgrade if you want more, or bring Lyne to your
            business.
          </p>
        </div>

        <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
          <span className={`text-sm ${!yearly ? "text-white" : "text-lyne-lavender/55"}`}>Monthly</span>
          <button
            onClick={() => setYearly((v) => !v)}
            className={`flex h-7 w-12 items-center rounded-full p-1 transition-colors ${yearly ? "bg-lyne-purple" : "bg-white/15"}`}
            aria-label="Toggle yearly billing"
          >
            <span className={`h-5 w-5 rounded-full bg-white transition-transform ${yearly ? "translate-x-5" : ""}`} />
          </button>
          <span className={`text-sm ${yearly ? "text-white" : "text-lyne-lavender/55"}`}>
            Yearly
            <span className="ml-2 rounded-full bg-lyne-green/20 px-2 py-0.5 text-xs text-lyne-green">Save 20%</span>
          </span>
        </div>

        <div className="grid items-stretch gap-5 sm:grid-cols-2">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`flex flex-col p-6 ${i === 2 ? "sm:col-span-2" : ""} ${
                plan.highlighted
                  ? "panel-elev shadow-[0_0_70px_-20px_rgba(123,95,255,0.7)] ring-1 ring-lyne-purple/40"
                  : "panel"
              }`}
            >
              {plan.highlighted && (
                <span className="chip mb-4 w-fit">
                  <Sparkles className="h-3 w-3" /> Most popular
                </span>
              )}
              <p className="text-sm text-lyne-lavender/65">{plan.name}</p>
              <p className="mt-1 text-4xl font-bold tracking-tight">{yearly ? plan.price.y : plan.price.m}</p>
              <p className="mt-3 text-sm text-lyne-lavender/60">{plan.desc}</p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10">
                      <Check className="h-3 w-3 text-lyne-green" />
                    </span>
                    <span className="text-lyne-lavender/85">{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={plan.href}
                className={`mt-8 block rounded-full py-3.5 text-center text-sm font-semibold transition-transform hover:scale-[1.02] ${
                  plan.highlighted ? "btn-primary" : "border border-white/12 bg-white/[0.04] hover:bg-white/[0.08]"
                }`}
              >
                {plan.cta}
              </a>
            </motion.div>
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
    <section className="border-t border-white/[0.06] py-16 sm:py-20">
      <div className="w-full px-4 sm:px-8">
        <div className="panel-elev relative overflow-hidden px-5 py-12 text-center sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-lyne-purple/30 blur-3xl" />
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-lyne-purple/15 text-lyne-lavender">
            <Mail className="h-5 w-5" />
          </span>
          <h2 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
            Stay in <span className="serif accent-text">the loop.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-lyne-lavender/65">
            Be first to know when Lyne lands near you, plus tips and the odd
            behind-the-scenes. No spam — leave anytime.
          </p>

          {submitted ? (
            <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full bg-lyne-green/20 px-5 py-3 text-sm font-semibold text-lyne-green">
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
                placeholder="you@email.com"
                maxLength={255}
                className="flex-1 rounded-full border border-white/12 bg-white/[0.05] px-5 py-3.5 text-sm outline-none placeholder:text-white/30 focus:border-lyne-purple"
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

/**
 * Join Us — partner estimation + sales contact.
 * Size your deployment (branches, services, busyness, setup tier),
 * get an indicative estimate, and send the configuration to sales.
 */
import * as React from "react";
import { motion } from "framer-motion";
import { MarketingNav, MarketingFooter } from "@/components/qme/Marketing";
import { Building2, Calculator, Users, Mail, Phone, MapPin, ArrowRight, Check } from "lucide-react";

type Busyness = "light" | "moderate" | "heavy";
type SetupTier = "essentials" | "professional" | "enterprise";

const BUSYNESS_OPTIONS: Array<{ id: Busyness; label: string; detail: string; multiplier: number }> = [
  { id: "light", label: "Light", detail: "Short lines, quiet periods", multiplier: 1 },
  { id: "moderate", label: "Moderate", detail: "Steady lines through the day", multiplier: 1.15 },
  { id: "heavy", label: "Heavy", detail: "Long lines, peak-hour crowding", multiplier: 1.35 },
];

const TIER_OPTIONS: Array<{ id: SetupTier; label: string; detail: string; perBranch: number; perService: number }> = [
  { id: "essentials", label: "Essentials", detail: "Queues, tickets, staff dashboard", perBranch: 120, perService: 10 },
  { id: "professional", label: "Professional", detail: "Adds manager analytics and heatmaps", perBranch: 200, perService: 15 },
  { id: "enterprise", label: "Enterprise", detail: "Full predictive analytics and executive insights", perBranch: 320, perService: 20 },
];

function estimateMonthly(branches: number, services: number, busyness: Busyness, tier: SetupTier) {
  const tierOption = TIER_OPTIONS.find((option) => option.id === tier)!;
  const busynessOption = BUSYNESS_OPTIONS.find((option) => option.id === busyness)!;
  const base = branches * tierOption.perBranch + branches * services * tierOption.perService;
  return Math.round(base * busynessOption.multiplier);
}

const inputClass =
  "w-full rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-qme-purple";

const JoinUs = () => {
  const [submitted, setSubmitted] = React.useState(false);
  const [branches, setBranches] = React.useState(3);
  const [services, setServices] = React.useState(4);
  const [busyness, setBusyness] = React.useState<Busyness>("moderate");
  const [tier, setTier] = React.useState<SetupTier>("professional");
  const [message, setMessage] = React.useState("");
  const formRef = React.useRef<HTMLDivElement>(null);

  const monthly = estimateMonthly(branches, services, busyness, tier);
  const tierLabel = TIER_OPTIONS.find((option) => option.id === tier)!.label;
  const busynessLabel = BUSYNESS_OPTIONS.find((option) => option.id === busyness)!.label;

  const applyEstimateToForm = () => {
    setMessage(
      [
        "We would like a formal quote for Lyne.",
        "",
        `Branches: ${branches}`,
        `Services per branch: ${services}`,
        `Current busyness: ${busynessLabel}`,
        `Setup: ${tierLabel}`,
        `Website estimate: ~US$${monthly.toLocaleString()}/month`,
        "",
        "Additional details:",
      ].join("\n"),
    );
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name") || "");
    const email = String(data.get("email") || "");
    const phone = String(data.get("phone") || "");
    const body = encodeURIComponent([`Name: ${name}`, `Email: ${email}`, `Phone: ${phone}`, "", message].join("\n"));
    setSubmitted(true);
    window.location.href = `mailto:support@uselyne.com?subject=Lyne%20Quote%20Request&body=${body}`;
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-qme-night text-white">
      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-qme-purple/20 blur-[140px]" />
        <div className="absolute top-[40%] left-[-15%] h-[460px] w-[460px] rounded-full bg-qme-violet/25 blur-[150px]" />
      </div>

      <MarketingNav />

      <div className="pb-24 pt-20">
        <div className="lux-container space-y-14">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="chip mx-auto mb-5">
              <Building2 className="h-3.5 w-3.5" /> Partner with us
            </div>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Bring the calm to <span className="serif accent-text">your business.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-qme-lavender/70">
              Tell us about your business, get an instant estimate, and our sales
              team will take it from there.
            </p>
          </motion.div>

          {/* Estimator */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="panel-elev p-8"
          >
            <div className="mb-8 flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-qme-purple/15 text-qme-lavender">
                <Calculator className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Estimate your setup</h2>
                <p className="text-sm text-qme-lavender/60">
                  Size the deployment to your business — final pricing is confirmed by our sales team.
                </p>
              </div>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              <div className="space-y-8 lg:col-span-2">
                <div className="grid gap-8 md:grid-cols-2">
                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label htmlFor="branches-range" className="flex items-center gap-2 text-sm font-medium">
                        <Building2 className="h-4 w-4 text-qme-purple" /> Branches
                      </label>
                      <span className="text-lg font-bold">{branches}</span>
                    </div>
                    <input
                      id="branches-range"
                      type="range"
                      min={1}
                      max={50}
                      step={1}
                      value={branches}
                      onChange={(event) => setBranches(Number(event.target.value))}
                      className="w-full accent-qme-purple"
                    />
                    <p className="mt-2 text-xs text-qme-lavender/55">Locations that will run live queues.</p>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label htmlFor="services-range" className="flex items-center gap-2 text-sm font-medium">
                        <Users className="h-4 w-4 text-qme-purple" /> Services per branch
                      </label>
                      <span className="text-lg font-bold">{services}</span>
                    </div>
                    <input
                      id="services-range"
                      type="range"
                      min={1}
                      max={25}
                      step={1}
                      value={services}
                      onChange={(event) => setServices(Number(event.target.value))}
                      className="w-full accent-qme-purple"
                    />
                    <p className="mt-2 text-xs text-qme-lavender/55">Distinct lines customers can join.</p>
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium">How busy are you today?</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {BUSYNESS_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setBusyness(option.id)}
                        aria-pressed={busyness === option.id}
                        className={`panel panel-hover p-4 text-left transition-colors ${
                          busyness === option.id ? "border-qme-purple/60 bg-qme-purple/10" : ""
                        }`}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="mt-1 text-xs text-qme-lavender/60">{option.detail}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium">Which setup fits you?</p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {TIER_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setTier(option.id)}
                        aria-pressed={tier === option.id}
                        className={`panel panel-hover p-4 text-left transition-colors ${
                          tier === option.id ? "border-qme-purple/60 bg-qme-purple/10" : ""
                        }`}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="mt-1 text-xs text-qme-lavender/60">{option.detail}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="panel flex flex-col p-6 ring-1 ring-qme-purple/30">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-qme-lavender/60">
                  Estimated subscription
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold tracking-tight">US${monthly.toLocaleString()}</span>
                  <span className="text-sm text-qme-lavender/60">/month</span>
                </div>
                <div className="mt-5 space-y-2.5 text-sm text-qme-lavender/65">
                  <div className="flex justify-between"><span>Branches</span><span className="font-medium text-white">{branches}</span></div>
                  <div className="flex justify-between"><span>Total service lines</span><span className="font-medium text-white">{branches * services}</span></div>
                  <div className="flex justify-between"><span>Busyness</span><span className="font-medium text-white">{busynessLabel}</span></div>
                  <div className="flex justify-between"><span>Setup</span><span className="font-medium text-white">{tierLabel}</span></div>
                </div>
                <p className="mt-4 text-xs text-qme-lavender/50">
                  Indicative only. Volume discounts, onboarding, and hardware are finalised with sales.
                </p>
                <button type="button" onClick={applyEstimateToForm} className="btn btn-primary mt-6 w-full">
                  Contact sales with this estimate <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Contact */}
          <div ref={formRef} className="grid scroll-mt-24 gap-8 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="panel p-8"
            >
              <h2 className="mb-6 text-2xl font-bold tracking-tight">Request a quote</h2>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="quote-name" className="mb-2 block text-sm font-medium">Name</label>
                  <input id="quote-name" name="name" required placeholder="Your full name" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="quote-email" className="mb-2 block text-sm font-medium">Email</label>
                  <input id="quote-email" name="email" type="email" required placeholder="your.email@example.com" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="quote-phone" className="mb-2 block text-sm font-medium">Phone</label>
                  <input id="quote-phone" name="phone" type="tel" placeholder="+1 (876) 000-0000" className={inputClass} />
                </div>
                <div>
                  <label htmlFor="quote-message" className="mb-2 block text-sm font-medium">Message</label>
                  <textarea
                    id="quote-message"
                    name="message"
                    required
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Tell us how we can help..."
                    rows={8}
                    className={inputClass}
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-lg w-full">
                  Request quote <ArrowRight className="h-5 w-5" />
                </button>
                {submitted && (
                  <p className="flex items-center gap-2 text-sm text-qme-green">
                    <Check className="h-4 w-4" /> Thanks. Your email client should open with the quote request ready to send.
                  </p>
                )}
              </form>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="space-y-6"
            >
              <div className="panel p-8">
                <h2 className="mb-6 text-2xl font-bold tracking-tight">Contact information</h2>
                <div className="space-y-5">
                  {[
                    { icon: Mail, label: "Email", value: "support@quemenow.com" },
                    { icon: Phone, label: "Phone", value: "+1 (876) 000-0000" },
                    { icon: MapPin, label: "Location", value: "Kingston, Jamaica" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-qme-purple/15 text-qme-lavender">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold">{label}</div>
                        <div className="text-sm text-qme-lavender/65">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel p-8">
                <h3 className="mb-4 text-xl font-bold tracking-tight">Office hours</h3>
                <div className="space-y-2.5 text-sm text-qme-lavender/65">
                  <div className="flex justify-between"><span>Monday - Friday</span><span className="font-medium text-white">8:00 AM - 4:00 PM</span></div>
                  <div className="flex justify-between"><span>Saturday</span><span className="font-medium text-white">Closed</span></div>
                  <div className="flex justify-between"><span>Sunday</span><span className="font-medium text-white">Closed</span></div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      <MarketingFooter />
    </div>
  );
};

export default JoinUs;

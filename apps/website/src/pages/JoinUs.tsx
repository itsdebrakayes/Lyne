/**
 * Join Us — partner estimation + sales contact.
 * Size your deployment (locations, services, busyness, plan),
 * get an indicative estimate, and send the configuration to sales.
 */
import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { LEGAL_ENTITY } from "@/lib/legalEntity";
import { PLANS, MESSAGING_NOTE, estimate, estimateLines, planFits, usd, type PlanId } from "@/lib/pricing";
import { MarketingNav, MarketingFooter } from "@/components/lyne/Marketing";
import { Building2, Calculator, Users, Mail, Phone, MapPin, ArrowRight, Check } from "lucide-react";

type Busyness = "light" | "moderate" | "heavy";

/* Busyness is asked for scoping only; it does not change the price
   (lib/pricing.ts). */
const BUSYNESS_OPTIONS: Array<{ id: Busyness; label: string; detail: string }> = [
  { id: "light", label: "Light", detail: "Short lines, quiet periods" },
  { id: "moderate", label: "Moderate", detail: "Steady lines through the day" },
  { id: "heavy", label: "Heavy", detail: "Long lines, peak-hour crowding" },
];

const inputClass =
  "w-full rounded-xl border border-white/[0.12] bg-white/[0.05] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-lyne-purple";

const JoinUs = () => {
  const [submitted, setSubmitted] = React.useState(false);
  const [branches, setBranches] = React.useState(3);
  const [services, setServices] = React.useState(4);
  const [busyness, setBusyness] = React.useState<Busyness>("moderate");
  // null = the smallest plan that covers the locations; a click picks a larger one.
  const [plan, setPlan] = React.useState<PlanId | null>(null);
  const [message, setMessage] = React.useState("");
  const formRef = React.useRef<HTMLDivElement>(null);

  const quote = estimate(branches, plan);
  const busynessLabel = BUSYNESS_OPTIONS.find((option) => option.id === busyness)!.label;

  const applyEstimateToForm = () => {
    setMessage(
      [
        "We would like a formal quote for Lyne.",
        "",
        `Locations: ${branches}`,
        `Services per branch: ${services}`,
        `Current busyness: ${busynessLabel}`,
        ...estimateLines(quote),
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
    window.location.href = `mailto:customersupport@uselyne.com?subject=Lyne%20Quote%20Request&body=${body}`;
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-lyne-night text-white">
      {/* ambient glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-lyne-purple/20 blur-[140px]" />
        <div className="absolute top-[40%] left-[-15%] h-[460px] w-[460px] rounded-full bg-lyne-violet/25 blur-[150px]" />
      </div>

      <MarketingNav />
      <main id="main">

      <div className="pb-24 pt-20">
        <div className="lux-container space-y-14">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-3xl text-center"
          >
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Bring the calm to <span className="serif accent-text">your business.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-lyne-lavender/70">
              Tell us about your business, get an instant estimate, and our sales
              team will take it from there.
            </p>
          </motion.div>

          {/* Estimator */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            id="estimate"
            className="scroll-mt-24 panel-elev p-8"
          >
            <div className="mb-8 flex items-center gap-4">
              <span className="grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-lyne-purple/15 text-lyne-lavender">
                <Calculator className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Estimate your setup</h2>
                <p className="text-sm text-lyne-lavender/60">
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
                        <Building2 className="h-4 w-4 text-lyne-purple" /> Locations
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
                      className="w-full accent-lyne-purple"
                    />
                    <p className="mt-2 text-xs text-lyne-lavender/55">Locations that will run live queues.</p>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center justify-between">
                      <label htmlFor="services-range" className="flex items-center gap-2 text-sm font-medium">
                        <Users className="h-4 w-4 text-lyne-purple" /> Services per branch
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
                      className="w-full accent-lyne-purple"
                    />
                    <p className="mt-2 text-xs text-lyne-lavender/55">Distinct lines customers can join.</p>
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
                          busyness === option.id ? "border-lyne-purple/60 bg-lyne-purple/10" : ""
                        }`}
                      >
                        <div className="font-semibold">{option.label}</div>
                        <div className="mt-1 text-xs text-lyne-lavender/60">{option.detail}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium">Which plan fits you?</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {PLANS.map((option) => {
                      const fits = planFits(option, branches);
                      const selected = quote.plan.id === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => fits && setPlan(option.id)}
                          disabled={!fits}
                          aria-pressed={selected}
                          className={`panel panel-hover p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            selected ? "border-lyne-purple/60 bg-lyne-purple/10" : ""
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-semibold">{option.name}</span>
                            <span className="text-xs text-lyne-lavender/70">
                              {option.custom ? "Custom" : `${usd(option.monthly!)}/mo`}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-lyne-lavender/60">
                            {fits ? option.detail : `Covers up to ${option.maxLocations} location${option.maxLocations === 1 ? "" : "s"}`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="panel flex flex-col p-6 ring-1 ring-lyne-purple/30">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-lyne-lavender/60">
                  {quote.plan.custom ? "Custom contract" : "Estimated subscription"}
                </div>
                <div className="mt-1 text-sm font-semibold text-white">{quote.plan.name}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  {quote.plan.custom ? (
                    <>
                      <span className="text-sm text-lyne-lavender/60">from</span>
                      <span className="text-4xl font-bold tracking-tight">{usd(quote.annual)}</span>
                      <span className="text-sm text-lyne-lavender/60">/year</span>
                    </>
                  ) : (
                    <>
                      <span className="text-4xl font-bold tracking-tight">{usd(quote.monthly!)}</span>
                      <span className="text-sm text-lyne-lavender/60">/month</span>
                    </>
                  )}
                </div>
                <div className="mt-5 space-y-2.5 text-sm text-lyne-lavender/65">
                  {!quote.plan.custom && (
                    <div className="flex justify-between gap-3"><span>Billed annually</span><span className="text-right font-medium text-white">{usd(quote.annual)}/year</span></div>
                  )}
                  <div className="flex justify-between gap-3"><span>Implementation (one-time)</span><span className="text-right font-medium text-white">{quote.plan.custom ? "from " : ""}{usd(quote.implementation)}</span></div>
                  <div className="flex justify-between gap-3"><span>Messaging / SMS</span><span className="text-right font-medium text-white">{MESSAGING_NOTE}</span></div>
                  <div className="flex justify-between gap-3"><span>Locations</span><span className="font-medium text-white">{branches}{quote.plan.custom ? "" : ` of ${quote.plan.maxLocations}`}</span></div>
                  <div className="flex justify-between gap-3"><span>Total service lines</span><span className="font-medium text-white">{branches * services}</span></div>
                  <div className="flex justify-between gap-3"><span>Busyness</span><span className="font-medium text-white">{busynessLabel}</span></div>
                </div>
                <p className="mt-4 text-xs text-lyne-lavender/50">
                  {quote.plan.custom
                    ? "Government and enterprise contracts are scoped with you: locations, integrations, security and SLAs."
                    : "Indicative. Final pricing, messaging and any integrations are confirmed with sales."}
                </p>
                <button type="button" onClick={applyEstimateToForm} className="btn btn-primary mt-6 w-full">
                  Contact sales with this estimate <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Contact */}
          <div ref={formRef} id="quote" className="grid scroll-mt-24 gap-8 md:grid-cols-2">
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
                  <input id="quote-phone" name="phone" type="tel" placeholder="876 000 0000" className={inputClass} />
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
                {/* Consent, stated before the action rather than after it.
                    No pre-ticked box and no separate checkbox, because this
                    form does not transmit anything on its own: it opens your
                    own mail client with a draft, and nothing reaches us until
                    you press send there. Demanding a tick for a submission
                    that has not happened would be theatre; saying plainly what
                    happens to the message once it does arrive is the part that
                    actually matters. */}
                <p id="quote-consent" className="text-xs leading-relaxed text-lyne-lavender/60">
                  Pressing this opens your own email app with the details above as a draft.
                  Nothing is sent until you send it. When it reaches us we use your name,
                  email and phone number only to answer your enquiry and, if it goes further,
                  to prepare a quote — we do not add you to a mailing list and we do not share
                  it with anyone else. We keep enquiries for 24&nbsp;months, and you can ask us
                  to delete yours at any time.{" "}
                  <Link to="/privacy" className="underline underline-offset-2 hover:text-white">
                    Privacy Policy
                  </Link>
                  .
                </p>

                <button
                  type="submit"
                  aria-describedby="quote-consent"
                  className="btn btn-primary btn-lg w-full"
                >
                  Request quote <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
                {submitted && (
                  <p className="flex items-center gap-2 text-sm text-lyne-green">
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
                    { icon: Mail, label: "Email", value: "customersupport@uselyne.com" },
                    /* A published contact number has to be one that rings. "+1 (876)
                       000-0000" was a placeholder being displayed as fact —
                       put the real line here and restore this row. */
                    { icon: Mail, label: "Enquiries", value: LEGAL_ENTITY.supportEmail },
                    { icon: MapPin, label: "Location", value: "Kingston, Jamaica" },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-4">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-lyne-purple/15 text-lyne-lavender">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold">{label}</div>
                        <div className="text-sm text-lyne-lavender/65">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel p-8">
                <h3 className="mb-4 text-xl font-bold tracking-tight">Office hours</h3>
                <div className="space-y-2.5 text-sm text-lyne-lavender/65">
                  <div className="flex justify-between"><span>Monday - Friday</span><span className="font-medium text-white">8:00 AM - 4:00 PM</span></div>
                  <div className="flex justify-between"><span>Saturday</span><span className="font-medium text-white">Closed</span></div>
                  <div className="flex justify-between"><span>Sunday</span><span className="font-medium text-white">Closed</span></div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      </main>
      <MarketingFooter />
    </div>
  );
};

export default JoinUs;

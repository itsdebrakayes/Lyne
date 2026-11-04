/**
 * Get the app — one page that sends a person to the right store.
 *
 * Every "Download" and "Get the app free" control points here. A store that is
 * not live yet (lib/mobileRelease.ts) shows as "Coming soon" rather than a
 * link that goes nowhere; the day its URL is set, it becomes a button.
 */
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { MOBILE_STORES } from "@/lib/mobileRelease";
import { MarketingNav, MarketingFooter } from "@/components/lyne/Marketing";
import { MobileMarketingNav, MobileMarketingFooter } from "@/components/lyne/mobile/MobileMarketing";

/* The stores' own badges, unaltered, as both companies' guidelines require:
   public/badges/app-store-badge.svg from developer.apple.com and
   public/badges/google-play-badge.png from play.google.com/intl/en_us/badges.
   Google's PNG carries its own clear space, so it is drawn taller and pulled in
   by the same amount to sit at the same visual height as Apple's. */
const STORE_COPY = {
  ios: { badge: "/badges/app-store-badge.svg", alt: "Download on the App Store", sub: "For iPhone and iPad", height: 56, pull: 0 },
  android: { badge: "/badges/google-play-badge.png", alt: "Get it on Google Play", sub: "For Android phones", height: 83, pull: -13.5 },
} as const;

const INCLUDED = [
  "Join a line from your phone and see your live place",
  "A ticket with your code, and a notification when it is your turn",
  "Busy times, the week planner and Line Helper",
  "Free for everyone: no subscriptions, no in-app purchases",
];

const GetApp = ({ mobile = false }: { mobile?: boolean }) => {
  const Nav = mobile ? MobileMarketingNav : MarketingNav;
  const Footer = mobile ? MobileMarketingFooter : MarketingFooter;
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-lyne-night text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-lyne-purple/20 blur-[140px]" />
        <div className="absolute top-[40%] left-[-15%] h-[460px] w-[460px] rounded-full bg-lyne-violet/25 blur-[150px]" />
      </div>
      <Nav />
      <main id="main" className={mobile ? "pb-16 pt-12" : "pb-24 pt-20"}>
        <div className="lux-container">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mx-auto max-w-2xl text-center"
          >
            <div className="chip chip-mute mx-auto mb-5 w-fit">Free for everyone</div>
            <h1 className={`${mobile ? "text-4xl" : "text-5xl sm:text-6xl"} font-bold leading-[1.05] tracking-tight`}>
              Get <span className="serif accent-text">Lyne.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-lyne-lavender/70">
              Choose your store. The app is the same on both.
            </p>
          </motion.div>

          <div className="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2">
            {MOBILE_STORES.map((store) => {
              const copy = STORE_COPY[store.id];
              const badge = (
                <img
                  src={copy.badge}
                  alt={copy.alt}
                  style={{ height: copy.height, margin: `${copy.pull}px 0` }}
                  className="w-auto"
                />
              );
              return (
                <div key={store.id} className="panel flex flex-col items-center gap-3 p-7 text-center">
                  {store.available ? (
                    <a
                      href={store.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={copy.alt}
                      className="rounded-xl transition-transform hover:scale-[1.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lyne-lavender"
                    >
                      {badge}
                    </a>
                  ) : (
                    /* Not live yet: the real badge, not a link, and a plain
                       label under it. The badge itself is never altered. */
                    <span aria-disabled="true">{badge}</span>
                  )}
                  <span className="text-sm text-lyne-lavender/60">
                    {store.available ? copy.sub : `Coming soon · ${copy.sub.replace("For ", "for ")}`}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="panel mx-auto mt-10 max-w-3xl p-7">
            <h2 className="mb-4 text-lg font-bold tracking-tight">What you get</h2>
            <ul className="space-y-3">
              {INCLUDED.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/10">
                    <Check className="h-3 w-3 text-lyne-green" />
                  </span>
                  <span className="text-lyne-lavender/85">{f}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default GetApp;

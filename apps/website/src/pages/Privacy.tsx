/**
 * Privacy — the published Privacy Policy.
 *
 * Content comes from legal/PRIVACY_POLICY.md so there is exactly one copy of
 * the wording. The footer linked here to /about until 21 Aug 2026, which meant
 * the site advertised a privacy policy and delivered a marketing page.
 */
import { motion } from "framer-motion";
import { MarketingNav, MarketingFooter } from "@/components/qme/Marketing";
import { LegalDocument } from "@/components/qme/LegalDocument";
import privacyMarkdown from "../../../../legal/PRIVACY_POLICY.md?raw";

export default function Privacy() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-qme-night text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-qme-purple/20 blur-[140px]" />
      </div>
      <MarketingNav />
      <main className="lux-container pb-24 pt-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <LegalDocument markdown={privacyMarkdown} />
        </motion.div>
      </main>
      <MarketingFooter />
    </div>
  );
}

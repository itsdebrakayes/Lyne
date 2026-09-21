/**
 * Refunds — the published Refund and Cancellation Policy.
 *
 * Content comes from legal/REFUND_POLICY.md so there is exactly one copy of the
 * wording, shared with every other surface that has to state the same thing.
 */
import { motion } from "framer-motion";
import { MarketingNav, MarketingFooter } from "@/components/lyne/Marketing";
import { LegalDocument } from "@/components/lyne/LegalDocument";
import markdown from "../../../../legal/REFUND_POLICY.md?raw";

export default function Refunds() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-lyne-night text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-lyne-purple/20 blur-[140px]" />
      </div>
      <MarketingNav />
      <main id="main" className="lux-container pb-24 pt-16">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <LegalDocument markdown={markdown} />
        </motion.div>
      </main>
      <MarketingFooter />
    </div>
  );
}

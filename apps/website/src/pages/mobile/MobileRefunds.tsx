/**
 * MobileRefunds — the published Refund and Cancellation Policy, phone layout.
 *
 * Same markdown source as the desktop page. If the wording differs between
 * the two, one of them is wrong — there is only supposed to be one policy.
 */
import { motion } from "framer-motion";
import { MobileMarketingNav, MobileMarketingFooter } from "@/components/lyne/mobile/MobileMarketing";
import { LegalDocument } from "@/components/lyne/LegalDocument";
import markdown from "../../../../../legal/REFUND_POLICY.md?raw";

export default function MobileRefunds() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-lyne-night text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-lyne-purple/20 blur-[140px]" />
      </div>
      <MobileMarketingNav />
      <main id="main" className="px-4 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <LegalDocument markdown={markdown} />
        </motion.div>
      </main>
      <MobileMarketingFooter />
    </div>
  );
}

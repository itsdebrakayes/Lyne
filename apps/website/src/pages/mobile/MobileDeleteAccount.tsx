/**
 * DeleteAccount — the account-deletion route both stores require.
 *
 * Google Play requires a publicly reachable URL where a user can request
 * deletion WITHOUT the app installed, and it is submitted separately in the
 * Play Console data-safety form. The app has had an in-app deletion path for a
 * while; what was missing was somewhere to point a person who has already
 * uninstalled it.
 *
 * Content comes from legal/ACCOUNT_DELETION.md so there is one copy of the
 * wording, the same as Privacy and Terms.
 */
import { motion } from "framer-motion";
import { MobileMarketingNav, MobileMarketingFooter } from "@/components/lyne/mobile/MobileMarketing";
import { LegalDocument } from "@/components/lyne/LegalDocument";
import deletionMarkdown from "../../../../../legal/ACCOUNT_DELETION.md?raw";

export default function MobileDeleteAccount() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-lyne-night text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 right-[-10%] h-[520px] w-[520px] rounded-full bg-lyne-purple/20 blur-[140px]" />
      </div>
      <MobileMarketingNav />
      <main className="px-4 pb-16 pt-10 sm:px-8 sm:pb-20 sm:pt-14">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <LegalDocument markdown={deletionMarkdown} />
        </motion.div>
      </main>
      <MobileMarketingFooter />
    </div>
  );
}

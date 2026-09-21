/**
 * independence.ts — the disclaimer, in the words it has to be said in.
 *
 * Lyne queues people for government agencies. That is the exact shape Google
 * Play's impersonation policy is written about, and the exact shape App Review
 * reads as a claim of official status unless something says otherwise. This
 * sentence is the mitigation, not decoration.
 *
 * **It must say the same thing in all four places it appears:**
 *   1. apps/mobile/src/lib/legalContent.ts  (INDEPENDENCE_DISCLAIMER)
 *   2. this file — the website footer
 *   3. the Google Play store description
 *   4. the App Store reviewer notes
 *
 * If you change the wording, change it in all four in the same commit. A
 * reviewer comparing the store listing against the app is the reason it is
 * worded identically rather than merely similarly.
 *
 * The company name is pulled from legalEntity.ts rather than typed again, so
 * renaming the business cannot leave a stale name in the disclaimer.
 */
import { LEGAL_ENTITY } from "./legalEntity";

export const INDEPENDENCE_DISCLAIMER =
  `Lyne is an independent service operated by ${LEGAL_ENTITY.registeredName}. ` +
  `It is not affiliated with, endorsed by, or operated on behalf of any government agency. ` +
  `Queue information is provided by the organisation you are queueing with.`;

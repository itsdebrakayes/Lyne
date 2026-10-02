/**
 * features.ts — what version one deliberately does not ship.
 *
 * Each flag here is off because shipping it would get the app rejected, not
 * because the code is unfinished. The reasoning lives beside the flag so the
 * person who turns it on knows what has to be true first.
 *
 * A disabled control that explains itself feels honest to us and reads as an
 * unfinished app to a reviewer. App Review Guideline 2.1 covers exactly that:
 * placeholder features, greyed-out buttons, and "coming soon" are rejections.
 * The fix is never a better explanation — it is not shipping the control.
 */

/**
 * Apple and Google sign-in.
 *
 * The buttons exist and are rendered disabled under the line "Apple and Google
 * sign-in arrive with the App Store release." That sentence is the problem: it
 * tells a reviewer, in the app, that part of the sign-in screen does not work
 * yet. Guideline 2.1 rejects placeholder functionality.
 *
 * Email and password sign-in is complete and is the only path version one
 * offers, which is a coherent product rather than a broken one.
 *
 * TO ENABLE: wire the providers in Supabase (Authentication → Providers), add
 * the iOS Services ID and the Android SHA-1 fingerprints from
 * docs/PROVIDER_SETUP.md, and test both on a real device. Then flip this.
 * Note that Apple requires Sign in with Apple to be offered wherever another
 * social sign-in is, so these two go live together or not at all.
 */
export const SOCIAL_AUTH_ENABLED = false;

/**
 * Lyne Premium — the upsell, the free trial, and the saved-cards screen.
 *
 * Three separate problems, all solved by not showing it in version one:
 *
 * 1. **It cannot complete.** Payments are stubbed on the server, and the
 *    publishable key is empty. Every path ends in failure.
 *
 * 2. **The destination is a 404.** The upgrade flow sends people to
 *    uselyne.com/account, which does not exist on the live site.
 *
 * 3. **Steering outside the store breaks Guideline 3.1.1.** Sending an iOS
 *    customer to a website to pay for digital content is permitted only on the
 *    US storefront, in the EU, South Korea and Japan. **Jamaica is not covered**,
 *    so the app's primary market is exactly where this is prohibited. It is
 *    worth being clear that Claude and ChatGPT do NOT do this on iOS — they
 *    use Apple's in-app purchase. Copying "the big apps" here means copying
 *    IAP, not copying a web link.
 *
 * TO ENABLE: implement StoreKit in-app purchase for iOS and Google Play
 * Billing for Android, confirm Apple supports developer payouts to a Jamaican
 * bank account, then flip this. A web checkout is NOT the route for the
 * consumer subscription.
 *
 * This does not affect the ORGANISATION subscription. That is a business
 * buying administrator software through an invoice or a web checkout, Apple
 * has no jurisdiction over it, and nothing about it is sold inside this app.
 */
export const PREMIUM_ENABLED = false;

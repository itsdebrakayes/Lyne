/**
 * Where the mobile app lives, and whether it is published yet.
 *
 * Same reasoning as desktopRelease.ts, and the same failure it exists to
 * prevent. Every "Get the app" control on this site pointed at `#pricing`,
 * which scrolls the page and downloads nothing — and the button inside the
 * pricing card linked to the card it was already in. Somebody who wants the app
 * clicks, the page moves, and they conclude it is broken. It is the kind of bug
 * that costs an install without ever being reported.
 *
 * It happened because there was nowhere honest to send them: the app is not on
 * the stores yet. So that fact is modelled here instead of being papered over.
 * With no store URL configured, the call to action becomes **join the waitlist**
 * — which is a real thing a person can do and a real thing we can act on. The
 * day either store is live, set its URL and every one of those controls turns
 * into an actual download link, with no copy to rewrite.
 *
 *   VITE_IOS_APP_URL      https://apps.apple.com/app/id...
 *   VITE_ANDROID_APP_URL  https://play.google.com/store/apps/details?id=com.lyne.com
 *
 * Set whichever exists. One store going live first is the normal case — Play
 * review is usually faster than App Review — and a half-published state should
 * show one real button and one honest "coming soon", not block both.
 */

const env = import.meta.env;

const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export type MobilePlatform = 'ios' | 'android';

export interface MobileStore {
  id: MobilePlatform;
  label: string;
  /** Where to send someone. Empty when the app is not published there yet. */
  url: string;
  available: boolean;
}

export const MOBILE_STORES: MobileStore[] = [
  { id: 'ios', label: 'App Store', url: clean(env.VITE_IOS_APP_URL), available: false },
  { id: 'android', label: 'Google Play', url: clean(env.VITE_ANDROID_APP_URL), available: false },
].map((s) => ({ ...s, available: s.url.length > 0 }));

/** True once the app can actually be downloaded from at least one store. */
export const mobileAppPublished = MOBILE_STORES.some((s) => s.available);

/**
 * What a "get the app" control should say and do right now.
 *
 * Returned together so the label and the destination can never drift apart —
 * a button reading "Download" that scrolls to a waitlist is the original bug in
 * a new costume.
 */
export function appCta(): { label: string; href: string; isDownload: boolean } {
  if (!mobileAppPublished) {
    return { label: 'Join the waitlist', href: '#waitlist', isDownload: false };
  }
  const ios = MOBILE_STORES.find((s) => s.id === 'ios' && s.available);
  const android = MOBILE_STORES.find((s) => s.id === 'android' && s.available);

  /* On a phone, send the person straight to their own store rather than to a
     chooser. On a desktop there is no right guess, so the waitlist section —
     which also carries both store badges once they exist — is the honest
     landing place. */
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) && ios) return { label: 'Download on the App Store', href: ios.url, isDownload: true };
  if (/Android/i.test(ua) && android) return { label: 'Get it on Google Play', href: android.url, isDownload: true };

  const only = MOBILE_STORES.filter((s) => s.available);
  if (only.length === 1) return { label: `Download on ${only[0].label}`, href: only[0].url, isDownload: true };
  return { label: 'Get the app', href: '#waitlist', isDownload: false };
}

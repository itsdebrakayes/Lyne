/**
 * haptics — the four moments in Lyne worth feeling.
 *
 * The checklist asks for "subtle haptics for joining, checking in, and
 * confirming destructive actions" — subtle being the operative word. A phone
 * that buzzes at every tap is worse than one that never buzzes at all, so this
 * module deliberately exposes only these four, and every screen goes through
 * it rather than calling expo-haptics directly.
 *
 * All of them are fire-and-forget: haptics are a garnish, and a device that
 * cannot produce them (most Android hardware, a simulator) must never turn a
 * successful queue join into a thrown error.
 */
import * as Haptics from 'expo-haptics';

const swallow = (promise: Promise<void>) => { promise.catch(() => {}); };

/** You are in the line. The one genuinely worth celebrating. */
export const hapticJoined = () => swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Checked in at the counter — confirmation that the code was accepted. */
export const hapticCheckedIn = () => swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** A destructive confirmation: leaving a queue, deleting an account. */
export const hapticDestructive = () => swallow(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Something failed. Distinct from success so it reads without looking. */
export const hapticFailed = () => swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));

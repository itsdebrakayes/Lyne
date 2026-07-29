import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Semantic haptic feedback for key moments. Haptics are iOS/Android only — on
 * web the calls throw — so we guard once here and swallow any platform error
 * (e.g. a device with no Taptic engine) so feedback can never break a flow.
 *
 * Use sparingly and meaningfully: a confirmation of something that matters
 * (joined, called forward, gave up your place), not every tap.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';
function run(fn: () => Promise<unknown>) { if (enabled) fn().catch(() => {}); }

export const haptics = {
  /** A light tick for a meaningful selection (e.g. picking a service). */
  select: () => run(() => Haptics.selectionAsync()),
  /** A medium tap for a primary action press. */
  press:  () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Success: joined the line, walk-in added, it's your turn. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Warning: a destructive/irreversible confirmation (leaving the queue). */
  warning: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Error: an action failed. */
  error:   () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

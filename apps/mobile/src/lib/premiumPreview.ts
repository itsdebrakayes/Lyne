/**
 * premiumPreview — a local, non-persistent-to-the-server toggle to demo the
 * free vs premium experience without a real payment.
 *
 * Live premium is the DB flag `users.is_premium` (set by the Stripe webhook and
 * read on every login — it persists across all app states). This preview is a
 * device-local override for demos/pre-launch; the toggle is only surfaced while
 * payments aren't configured yet, and disappears once the app goes live.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lyne.premium-preview';

export async function getPremiumPreview(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY)) === '1';
}
export async function setPremiumPreview(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY, on ? '1' : '0');
}

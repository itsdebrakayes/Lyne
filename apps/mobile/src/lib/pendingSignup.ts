/**
 * pendingSignup.ts — an account created on this device that still needs its
 * email code.
 *
 * Only the email address and the time are kept, so that reopening the app
 * returns to the code screen instead of a blank sign-up form. The password is
 * never written anywhere.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'lyne.pending-signup';
/** Supabase's confirmation code lasts an hour; a day covers a resend or two. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export async function rememberPendingSignup(email: string): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify({ email, at: Date.now() })); } catch { /* best effort */ }
}

export async function readPendingSignup(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const { email, at } = JSON.parse(raw) as { email?: string; at?: number };
    if (!email || !at || Date.now() - at > MAX_AGE_MS) { await AsyncStorage.removeItem(KEY); return null; }
    return email;
  } catch {
    return null;
  }
}

export async function clearPendingSignup(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch { /* best effort */ }
}

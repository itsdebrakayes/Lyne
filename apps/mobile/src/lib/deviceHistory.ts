/**
 * deviceHistory.ts — has anybody ever signed in on this device?
 *
 * A first launch lands on sign-up rather than sign-in: someone opening Lyne
 * for the first time almost always needs an account, and the sign-in form is
 * where they were starting to type one. Once any account has signed in here,
 * the device is a returning one and opens on sign-in, as before.
 *
 * Only a boolean is stored. Nothing about who signed in.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'lyne.device.has-signed-in';

export async function markDeviceSignedIn(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, '1'); } catch { /* a missed write only costs the default screen */ }
}

/** null while reading; then whether the device has seen a sign-in before. */
export function useReturningDevice(): boolean | null {
  const [returning, setReturning] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY)
      .then(v => { if (live) setReturning(v === '1'); })
      .catch(() => { if (live) setReturning(true); });
    return () => { live = false; };
  }, []);
  return returning;
}

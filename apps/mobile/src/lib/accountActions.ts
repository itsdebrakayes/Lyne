/**
 * Account actions shared by Account and Privacy and security.
 *
 * Download my data: a copy of everything the server holds about the person, as
 * JSON, handed to the share sheet so it can be saved to Files, emailed or kept.
 * The file is deleted from the app's cache straight after: the copy is theirs,
 * not ours. Offered from Account and from Privacy and security.
 */
import { Alert } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import api from './apiClient';

export async function downloadMyData() {
  let file: File | null = null;
  try {
    const data = await api.get<unknown>('/auth/export');
    file = new File(Paths.cache, `lyne-my-data-${new Date().toISOString().slice(0, 10)}.json`);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(data, null, 2));
    if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Your Lyne data', UTI: 'public.json' });
  } catch (caught) {
    Alert.alert('Could not prepare your data', caught instanceof Error ? caught.message : 'Try again in a moment.');
  } finally {
    try { file?.delete(); } catch { /* already gone */ }
  }
}

/**
 * Sign out of all devices: ends every session for this account (the server
 * signs the account out everywhere and drops every phone's push token), then
 * this phone. Asks first, because it signs the person out here too.
 */
export function confirmSignOutEverywhere(signOut: () => Promise<void>, setBusy: (b: boolean) => void) {
  Alert.alert(
    'Sign out of all devices?',
    'Every phone signed in to this account is signed out, including this one, and stops getting its alerts.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out everywhere', style: 'destructive', onPress: async () => {
      try { setBusy(true); await api.post('/auth/signout-everywhere', {}); } catch { /* still sign out here */ }
      finally { setBusy(false); await signOut(); }
    } }],
  );
}

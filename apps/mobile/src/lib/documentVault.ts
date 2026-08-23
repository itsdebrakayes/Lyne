/**
 * documentVault — identification numbers, kept on this device and nowhere else.
 *
 * The privacy policy tells customers their TRN and national ID are "stored on
 * your device". That was not true: the number was PATCHed to /auth/profile and
 * written to the users table on our server, where nothing ever read it back —
 * no staff endpoint returns these fields, so not one agency ever saw the value
 * we had collected. We were holding Jamaican citizens' government ID numbers
 * for no functional purpose, having told them we were not holding them at all.
 *
 * So they live here instead: in the device keychain, via expo-secure-store,
 * the same place the auth session is kept. Nothing in this module talks to the
 * network. A number typed on one device does not appear on another, and a
 * breach of our database cannot expose a single one of them.
 *
 * If a future version needs the agency to see an ID at the counter, it must
 * send it at that moment, to that branch, with the customer's consent — not by
 * quietly keeping a copy on the server from the day they signed up.
 */
import * as SecureStore from 'expo-secure-store';

export type DocumentField = 'trn' | 'national_id';

const KEY_PREFIX = 'lyne.doc.';
const PROTECT_PREFIX = 'lyne.doc-protected.';

const valueKey = (field: DocumentField) => `${KEY_PREFIX}${field}`;
const protectKey = (field: DocumentField) => `${PROTECT_PREFIX}${field}`;

/** Never let a keychain failure crash a screen; an unreadable value is absent. */
async function safeGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function getDocument(field: DocumentField): Promise<string | null> {
  return safeGet(valueKey(field));
}

export async function setDocument(field: DocumentField, value: string): Promise<void> {
  await SecureStore.setItemAsync(valueKey(field), value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearDocument(field: DocumentField): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(valueKey(field));
    await SecureStore.deleteItemAsync(protectKey(field));
  } catch { /* already gone */ }
}

/** Whether this number should require a Face ID unlock before it is revealed. */
export async function isProtected(field: DocumentField): Promise<boolean> {
  return (await safeGet(protectKey(field))) === '1';
}

export async function setProtected(field: DocumentField, on: boolean): Promise<void> {
  await SecureStore.setItemAsync(protectKey(field), on ? '1' : '0', {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * Wipe every stored document. Called on sign-out and on account deletion:
 * these numbers are not on our server, so if they are not cleared here they
 * are not cleared anywhere, and the next person to use the phone inherits them.
 */
export async function clearAllDocuments(): Promise<void> {
  await Promise.all((['trn', 'national_id'] as DocumentField[]).map(clearDocument));
}

/**
 * secureSessionStorage — Supabase session storage backed by the device keychain.
 *
 * App Review expects authentication and refresh tokens in the Keychain (iOS) or
 * the Android Keystore, not in ordinary app storage. AsyncStorage is neither: it
 * is an unencrypted file, readable from a backup or a jailbroken device.
 *
 * SecureStore caps a single value at 2048 bytes and a Supabase session — which
 * carries an access token, a refresh token and the user object — regularly
 * exceeds that. So values are split into numbered chunks, with a small index
 * entry recording how many there are. Reading reassembles them; writing always
 * clears the previous chunks first, so a shorter session can never leave a stale
 * tail behind that would corrupt the next read.
 */
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;              // headroom under SecureStore's 2048-byte limit
const COUNT_SUFFIX = '__chunks';

/** SecureStore keys allow only alphanumerics, ".", "-" and "_". */
function safeKey(key: string) {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

const chunkKey = (key: string, index: number) => `${safeKey(key)}_${index}`;
const countKey = (key: string) => `${safeKey(key)}${COUNT_SUFFIX}`;

async function readCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(key));
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

async function clearChunks(key: string, count: number) {
  const deletions: Promise<void>[] = [];
  for (let index = 0; index < count; index += 1) {
    deletions.push(SecureStore.deleteItemAsync(chunkKey(key, index)));
  }
  await Promise.all(deletions);
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const count = await readCount(key);
      if (count === 0) return null;

      const parts = await Promise.all(
        Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index)))
      );
      // A missing chunk means the stored value is torn — treat it as absent
      // rather than handing Supabase a truncated session to parse.
      if (parts.some((part) => part === null)) {
        await this.removeItem(key);
        return null;
      }
      return parts.join('');
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await readCount(key);

    const chunks: string[] = [];
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      chunks.push(value.slice(offset, offset + CHUNK_SIZE));
    }

    await Promise.all(
      chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk))
    );
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));

    // Drop any chunks left over from a longer previous value.
    if (previousCount > chunks.length) {
      await Promise.all(
        Array.from({ length: previousCount - chunks.length }, (_, offset) =>
          SecureStore.deleteItemAsync(chunkKey(key, chunks.length + offset))
        )
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    const count = await readCount(key);
    await clearChunks(key, count);
    await SecureStore.deleteItemAsync(countKey(key));
  },
};

export default secureSessionStorage;

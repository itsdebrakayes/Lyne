/**
 * Field-level encryption for personal details the database should never hold
 * readable: a walk-in's phone number, email and date of birth.
 *
 * The managed database is already encrypted on disk by the provider. This is
 * the layer above it: a database dump, a read replica, a backup restored
 * somewhere else, or anyone with SQL access sees "enc:v1:…", not the number.
 * Only the API, holding FIELD_ENCRYPTION_KEY, can read them.
 *
 * AES-256-GCM, a fresh 12-byte IV per value, the auth tag stored with it, so a
 * tampered value fails to open instead of opening to garbage.
 *
 * Reads need nothing: src/db/pool.js opens every sealed value in every result.
 * Writes call seal() on the value, and pool.js refuses an INSERT or UPDATE
 * that puts a plaintext value into a column in SEALED_COLUMNS.
 *
 * Losing the key loses these values. It is backed up with the server's other
 * secrets, never in git and never in the database backup.
 */
const crypto = require('node:crypto');

const PREFIX = 'enc:v1:';

/** Columns whose values are only ever stored sealed. Same names in every table that has them. */
const SEALED_COLUMNS = ['guest_phone', 'guest_email', 'guest_dob'];

let cachedKey;
function key() {
  if (cachedKey === undefined) {
    const raw = (process.env.FIELD_ENCRYPTION_KEY || '').trim();
    if (!raw) {
      cachedKey = null;
    } else {
      const buf = Buffer.from(raw, 'base64');
      if (buf.length !== 32) {
        throw new Error('FIELD_ENCRYPTION_KEY must be 32 bytes, base64. Make one with: openssl rand -base64 32');
      }
      cachedKey = buf;
    }
  }
  return cachedKey;
}

/* A DATE column read back as a Date: keep the calendar day the database meant (pool timezone is 'local'). */
const localDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const isSealed = (value) => typeof value === 'string' && value.startsWith(PREFIX);

/** Encrypts a value for storage. null/undefined/'' stay as they are. Without a key (local dev only) it is stored as given. */
function seal(value) {
  if (value === null || value === undefined || value === '') return value ?? null;
  if (isSealed(value)) return value;
  if (value instanceof Date) value = localDate(value);
  const k = key();
  if (!k) return String(value);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const ct = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `${PREFIX}${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${ct.toString('base64')}`;
}

/** Decrypts a stored value. Plaintext from before encryption comes back unchanged. */
function open(value) {
  if (!isSealed(value)) return value;
  const k = key();
  if (!k) throw new Error('A sealed value was read but FIELD_ENCRYPTION_KEY is not set on this server.');
  const [iv, tag, ct] = value.slice(PREFIX.length).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]).toString('utf8');
}

/** Production refuses to start without a key, so no deploy quietly stores plaintext. */
function assertReady() {
  if (process.env.NODE_ENV === 'production' && !key()) {
    throw new Error('FIELD_ENCRYPTION_KEY is not set. Generate one (openssl rand -base64 32), add it to .env, back it up with the other secrets, then restart. See README "Field encryption".');
  }
}

/** For tests: forget the cached key after changing the environment. */
function resetKeyForTests() { cachedKey = undefined; }

module.exports = { seal, open, isSealed, assertReady, SEALED_COLUMNS, PREFIX, resetKeyForTests };

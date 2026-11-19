/**
 * Field-level encryption for personal details the database should never hold
 * readable: names, emails, phone numbers, dates of birth and addresses of app
 * users, staff, staff invitations, walk-ins and session registrants.
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
 * that puts a plaintext value into a column listed in SEALED, or writes a
 * fingerprinted column without its fingerprint.
 *
 * A sealed value cannot be searched, sorted or compared in SQL. Exact lookups
 * (sign-in by email, the review simulator's visitor) use a fingerprint column
 * beside it: fingerprint(value), an HMAC that is equal for equal values and
 * reveals nothing else. Sorting and partial search happen in JavaScript after
 * the rows are read.
 *
 * Losing the key loses these values. It is backed up with the server's other
 * secrets, never in git and never in the database backup.
 */
const crypto = require('node:crypto');

const PREFIX = 'enc:v1:';

/** Per table: the columns only ever stored sealed. */
const SEALED = {
  users: ['full_name', 'email', 'phone', 'date_of_birth'],
  staff: ['full_name', 'email', 'phone', 'date_of_birth', 'address'],
  staff_invites: ['full_name', 'email'],
  queue_tickets: ['guest_name', 'guest_phone', 'guest_dob'],
  session_registrations: ['guest_name', 'guest_phone', 'guest_email'],
};

/** Per table: sealed column -> the fingerprint column that must be written with it. */
const FINGERPRINTED = {
  users: { email: 'email_hash' },
  staff: { email: 'email_hash' },
  staff_invites: { email: 'email_hash' },
  queue_tickets: { guest_name: 'guest_name_hash' },
};

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

/* Fingerprints use their own key, derived from the encryption key. Without one
   (local dev) a fixed development key, so lookups still work; the sealing
   script recomputes every fingerprint once the real key is set. */
let cachedPepper;
function pepper() {
  if (cachedPepper === undefined) {
    const k = key();
    cachedPepper = k ? Buffer.from(crypto.hkdfSync('sha256', k, Buffer.alloc(0), 'lyne-fingerprint-v1', 32))
      : Buffer.from('lyne-local-development-fingerprint');
  }
  return cachedPepper;
}

/** Same value, same fingerprint: case and surrounding/double spaces do not count. null stays null. */
function fingerprint(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const normal = String(value).trim().replace(/\s+/g, ' ').toLowerCase();
  return crypto.createHmac('sha256', pepper()).update(normal).digest('hex');
}

/** Production refuses to start without a key, so no deploy quietly stores plaintext. */
function assertReady() {
  if (process.env.NODE_ENV === 'production' && !key()) {
    throw new Error('FIELD_ENCRYPTION_KEY is not set. Generate one (openssl rand -base64 32), add it to .env, back it up with the other secrets, then restart. See README "Field encryption".');
  }
}

/** For tests: forget the cached key after changing the environment. */
function resetKeyForTests() { cachedKey = undefined; cachedPepper = undefined; }

const SEALED_COLUMNS = [...new Set(Object.values(SEALED).flat())];

module.exports = { seal, open, isSealed, fingerprint, assertReady, SEALED, FINGERPRINTED, SEALED_COLUMNS, PREFIX, resetKeyForTests };

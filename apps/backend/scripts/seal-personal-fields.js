#!/usr/bin/env node
/**
 * Seals every personal field written before field encryption (migrations 054
 * and 055, the columns in SEALED in src/lib/fieldCrypto.js) and recomputes
 * every fingerprint, so lookups by email work for old rows too. Safe to run
 * again: sealed values stay as they are; fingerprints are recomputed.
 *
 *   node scripts/seal-personal-fields.js            counts what would change
 *   node scripts/seal-personal-fields.js --apply    seals them
 *
 * Needs FIELD_ENCRYPTION_KEY and migrations 054 and 055. On production: backup first
 * (deploy/backup-managed-db.sh) and the owner's approval, as for any write.
 */
require('dotenv').config();
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const { seal, open, isSealed, fingerprint, SEALED, FINGERPRINTED } = require('../src/lib/fieldCrypto');

/*
 * SMS: opt-outs were keyed by the number, the log by an unkeyed SHA-256 of it.
 * Both become fingerprints. An unkeyed hash of a Jamaican mobile number is
 * reversed by trying all of them (+1876/+1658 and seven digits), which is the
 * reason it is replaced; each one found becomes the number's fingerprint.
 */
async function smsTables(db, apply) {
  const [optOuts] = await db.query('SELECT phone_hash FROM sms_opt_outs WHERE CHAR_LENGTH(phone_hash) < 64');
  console.log(`sms_opt_outs: ${optOuts.length} plain number(s)`);
  if (apply) {
    for (const r of optOuts) {
      await db.query('UPDATE IGNORE sms_opt_outs SET phone_hash = ? WHERE phone_hash = ?', [fingerprint(r.phone_hash), r.phone_hash]);
    }
  }

  const [logged] = await db.query('SELECT DISTINCT phone_hash FROM sms_log');
  if (!logged.length) { console.log('sms_log: nothing to convert'); return; }
  const wanted = new Set(logged.map((r) => r.phone_hash));
  const found = new Map();
  for (const prefix of ['+1876', '+1658']) {
    for (let n = 0; n < 1e7 && found.size < wanted.size; n += 1) {
      const phone = prefix + String(n).padStart(7, '0');
      const h = crypto.createHash('sha256').update(phone).digest('hex');
      if (wanted.has(h)) found.set(h, phone);
    }
  }
  console.log(`sms_log: ${found.size} of ${wanted.size} number(s) to re-key; the rest are already keyed`);
  if (apply) {
    for (const [h, phone] of found) await db.query('UPDATE sms_log SET phone_hash = ? WHERE phone_hash = ?', [fingerprint(phone), h]);
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  if (!process.env.FIELD_ENCRYPTION_KEY) throw new Error('Set FIELD_ENCRYPTION_KEY first.');
  /* A plain connection, not src/db/pool: the pool opens sealed values on read, and this needs to see them as stored. */
  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'lyne',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'lyne',
    dateStrings: true,
    ...(process.env.MYSQL_SSL_CA ? { ssl: { ca: require('node:fs').readFileSync(process.env.MYSQL_SSL_CA, 'utf8') } } : {}),
  });
  try {
    for (const [table, cols] of Object.entries(SEALED)) {
      const prints = Object.entries(FINGERPRINTED[table] || {});
      const [rows] = await db.query(`SELECT id, ${[...cols, ...prints.map(([, h]) => h)].join(', ')} FROM ${table}`);
      const changes = [];
      for (const row of rows) {
        const set = {};
        for (const c of cols) if (row[c] != null && row[c] !== '' && !isSealed(row[c])) set[c] = seal(row[c]);
        for (const [c, h] of prints) {
          const want = row[c] == null ? null : fingerprint(open(row[c]));
          if (row[h] !== want) set[h] = want;
        }
        if (Object.keys(set).length) changes.push([row.id, set]);
      }
      console.log(`${table}: ${changes.length} of ${rows.length} row(s) to update`);
      if (!apply) continue;
      for (const [id, set] of changes) {
        const keys = Object.keys(set);
        await db.query(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`, [...keys.map((k) => set[k]), id]);
      }
      console.log(`${table}: done`);
    }
    await smsTables(db, apply);
    if (!apply) console.log('Nothing changed. Run with --apply to seal.');
  } finally {
    await db.end();
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });

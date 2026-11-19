#!/usr/bin/env node
/**
 * Seals walk-in phone numbers, emails and dates of birth written before field
 * encryption (migration 054). Safe to run again: sealed values are skipped.
 *
 *   node scripts/seal-guest-fields.js            counts what would change
 *   node scripts/seal-guest-fields.js --apply    seals them
 *
 * Needs FIELD_ENCRYPTION_KEY and migration 054. On production: backup first
 * (deploy/backup-managed-db.sh) and the owner's approval, as for any write.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const { seal, isSealed } = require('../src/lib/fieldCrypto');

const TABLES = {
  queue_tickets: ['guest_phone', 'guest_dob'],
  session_registrations: ['guest_phone', 'guest_email'],
};

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
    for (const [table, cols] of Object.entries(TABLES)) {
      const where = cols.map((c) => `(${c} IS NOT NULL AND ${c} <> '' AND ${c} NOT LIKE 'enc:v1:%')`).join(' OR ');
      const [rows] = await db.query(`SELECT id, ${cols.join(', ')} FROM ${table} WHERE ${where}`);
      console.log(`${table}: ${rows.length} row(s) with plain values`);
      if (!apply) continue;
      for (const row of rows) {
        const sets = cols.filter((c) => row[c] && !isSealed(row[c]));
        await db.query(`UPDATE ${table} SET ${sets.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
          [...sets.map((c) => seal(row[c])), row.id]);
      }
      console.log(`${table}: sealed`);
    }
    if (!apply) console.log('Nothing changed. Run with --apply to seal.');
  } finally {
    await db.end();
  }
}

main().catch((err) => { console.error(err.message); process.exit(1); });

/**
 * Field encryption (src/lib/fieldCrypto.js) and the database guard that
 * enforces it (src/db/sealing.js).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

process.env.FIELD_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
const fc = require('../src/lib/fieldCrypto');
const { checkWrite, openResult } = require('../src/db/sealing');

test('seal then open returns the value; the stored form reveals nothing', () => {
  fc.resetKeyForTests();
  const sealed = fc.seal('8765550123');
  assert.match(sealed, /^enc:v1:/);
  assert.ok(!sealed.includes('8765550123'));
  assert.notEqual(fc.seal('8765550123'), sealed, 'a fresh IV each time');
  assert.equal(fc.open(sealed), '8765550123');
});

test('empty values stay empty; plaintext from before passes through open', () => {
  assert.equal(fc.seal(null), null);
  assert.equal(fc.seal(undefined), null);
  assert.equal(fc.seal(''), '');
  assert.equal(fc.open('8765550123'), '8765550123');
  assert.equal(fc.seal(fc.seal('x')).length, fc.seal('x').length, 'sealing twice is a no-op');
});

test('a date of birth read back as a Date seals as its calendar day', () => {
  assert.equal(fc.open(fc.seal(new Date(1990, 0, 31))), '1990-01-31');
});

test('a tampered value refuses to open', () => {
  const sealed = fc.seal('8765550123');
  const [iv, tag, ct] = sealed.slice(fc.PREFIX.length).split('.');
  const flipped = Buffer.from(ct, 'base64'); flipped[0] ^= 1;
  assert.throws(() => fc.open(`${fc.PREFIX}${iv}.${tag}.${flipped.toString('base64')}`));
});

test('the wrong key cannot open it', () => {
  const sealed = fc.seal('8765550123');
  process.env.FIELD_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
  fc.resetKeyForTests();
  assert.throws(() => fc.open(sealed));
});

test('production refuses to start without a key', () => {
  const saved = { key: process.env.FIELD_ENCRYPTION_KEY, env: process.env.NODE_ENV };
  delete process.env.FIELD_ENCRYPTION_KEY; process.env.NODE_ENV = 'production'; fc.resetKeyForTests();
  assert.throws(() => fc.assertReady(), /FIELD_ENCRYPTION_KEY/);
  process.env.FIELD_ENCRYPTION_KEY = saved.key; process.env.NODE_ENV = saved.env; fc.resetKeyForTests();
  assert.doesNotThrow(() => fc.assertReady());
});

const WALKIN = `INSERT INTO queue_tickets
   (id, queue_id, user_id, guest_name, guest_phone, guest_dob, ticket_number, status, channel)
 VALUES (?, ?, NULL, ?, ?, ?, ?, 'waiting', 'kiosk')`;

test('the guard refuses a plaintext phone in an INSERT and names the column', () => {
  assert.throws(() => checkWrite(WALKIN, ['t1', 'q1', 'Ann', '8765550123', null, 'A-001']), /guest_phone must be stored sealed/);
  assert.throws(() => checkWrite(WALKIN, ['t1', 'q1', 'Ann', null, '1990-01-31', 'A-001']), /guest_dob/);
});

test('the guard lets sealed and empty values through, and ignores other columns', () => {
  assert.doesNotThrow(() => checkWrite(WALKIN, ['t1', 'q1', 'Ann', fc.seal('8765550123'), fc.seal('1990-01-31'), 'A-001']));
  assert.doesNotThrow(() => checkWrite(WALKIN, ['t1', 'q1', 'Ann', null, '', 'A-001']));
  assert.doesNotThrow(() => checkWrite('INSERT INTO users (id, phone) VALUES (?, ?)', ['u', '8765550123']));
  assert.doesNotThrow(() => checkWrite('SELECT guest_phone FROM queue_tickets WHERE id = ?', ['t1']));
});

test('the guard checks UPDATE ... SET guest_phone = ?', () => {
  assert.throws(() => checkWrite('UPDATE session_registrations SET guest_name = ?, guest_phone = ? WHERE id = ?', ['Ann', '8765550123', 'r1']), /guest_phone/);
  assert.doesNotThrow(() => checkWrite('UPDATE session_registrations SET guest_phone = NULL, guest_email = NULL WHERE user_id = ?', ['u1']));
});

test('every sealed value in a result comes back open, other values untouched', () => {
  const when = new Date();
  const result = openResult([[{ guest_phone: fc.seal('8765550123'), guest_email: 'plain@example.com', joined_at: when, n: 3 }], []]);
  assert.deepEqual(result[0][0], { guest_phone: '8765550123', guest_email: 'plain@example.com', joined_at: when, n: 3 });
  assert.deepEqual(openResult([{ affectedRows: 1 }, undefined]), [{ affectedRows: 1 }, undefined]);
});

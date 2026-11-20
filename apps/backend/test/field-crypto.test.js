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
   (id, queue_id, user_id, guest_name, guest_name_hash, guest_phone, guest_dob, ticket_number, status, channel)
 VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'waiting', 'kiosk')`;
const walkin = (phone, dob, name = fc.seal('Ann')) => ['t1', 'q1', name, fc.fingerprint('Ann'), phone, dob, 'A-001'];

test('the guard refuses a plaintext value in an INSERT and names table and column', () => {
  assert.throws(() => checkWrite(WALKIN, walkin('8765550123', null)), /queue_tickets\.guest_phone must be stored sealed/);
  assert.throws(() => checkWrite(WALKIN, walkin(null, '1990-01-31')), /queue_tickets\.guest_dob/);
  assert.throws(() => checkWrite(WALKIN, walkin(null, null, 'Ann')), /queue_tickets\.guest_name/);
  assert.throws(() => checkWrite('INSERT INTO users (id, email, email_hash, full_name) VALUES (?, ?, ?, ?)',
    ['u', fc.seal('a@b.co'), fc.fingerprint('a@b.co'), 'Ann Lee']), /users\.full_name/);
});

test('the guard lets sealed and empty values through, and ignores other tables', () => {
  assert.doesNotThrow(() => checkWrite(WALKIN, walkin(fc.seal('8765550123'), fc.seal('1990-01-31'))));
  assert.doesNotThrow(() => checkWrite(WALKIN, walkin(null, '')));
  assert.doesNotThrow(() => checkWrite('INSERT INTO businesses (id, phone, email) VALUES (?, ?, ?)', ['b', '8765550123', 'hi@org.example']));
  assert.doesNotThrow(() => checkWrite('UPDATE branches SET phone = ?, address = ? WHERE id = ?', ['876', '1 Road', 'b']));
  assert.doesNotThrow(() => checkWrite('SELECT guest_phone FROM queue_tickets WHERE id = ?', ['t1']));
});

test('a fingerprinted column cannot be written without its fingerprint', () => {
  assert.throws(() => checkWrite('INSERT INTO staff (id, full_name, email) VALUES (?, ?, ?)', ['s', fc.seal('A'), fc.seal('a@b.co')]),
    /staff\.email is written without email_hash/);
  assert.throws(() => checkWrite('UPDATE users SET email = ? WHERE id = ?', [fc.seal('a@b.co'), 'u']), /email_hash/);
  assert.doesNotThrow(() => checkWrite('UPDATE users SET email = ?, email_hash = ? WHERE id = ?', [fc.seal('a@b.co'), fc.fingerprint('a@b.co'), 'u']));
  assert.doesNotThrow(() => checkWrite('UPDATE queue_tickets SET guest_name = NULL, guest_phone = NULL WHERE user_id = ?', ['u']));
});

test('the guard checks UPDATE ... SET col = ? and COALESCE(?, col), with aliases', () => {
  assert.throws(() => checkWrite('UPDATE session_registrations SET guest_name = ?, guest_phone = ? WHERE id = ?', [fc.seal('Ann'), '8765550123', 'r1']), /guest_phone/);
  assert.throws(() => checkWrite('UPDATE users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone) WHERE id = ?', [null, '876', 'u']), /users\.phone/);
  assert.throws(() => checkWrite('UPDATE staff s JOIN branches b ON b.id = s.branch_id SET s.address = ? WHERE s.id = ?', ['1 Road', 's']), /staff\.address/);
  assert.doesNotThrow(() => checkWrite('UPDATE session_registrations SET guest_phone = NULL, guest_email = NULL WHERE user_id = ?', ['u1']));
});

test('fingerprints match regardless of case and spacing, and differ otherwise', () => {
  assert.equal(fc.fingerprint(' Ann  Lee '), fc.fingerprint('ann lee'));
  assert.notEqual(fc.fingerprint('ann lee'), fc.fingerprint('ann leo'));
  assert.equal(fc.fingerprint(''), null);
  assert.match(fc.fingerprint('a@b.co'), /^[0-9a-f]{64}$/);
});

test('every sealed value in a result comes back open, other values untouched', () => {
  const when = new Date();
  const result = openResult([[{ guest_phone: fc.seal('8765550123'), guest_email: 'plain@example.com', joined_at: when, n: 3 }], []]);
  assert.deepEqual(result[0][0], { guest_phone: '8765550123', guest_email: 'plain@example.com', joined_at: when, n: 3 });
  assert.deepEqual(openResult([{ affectedRows: 1 }, undefined]), [{ affectedRows: 1 }, undefined]);
});

test('every row of a multi-row INSERT is checked, and a quoted literal is plaintext', () => {
  const sql = 'INSERT INTO session_registrations (id, guest_name) VALUES (?, ?), (?, ?)';
  assert.throws(() => checkWrite(sql, ['r1', fc.seal('Ann'), 'r2', 'Bob']), /guest_name/);
  assert.doesNotThrow(() => checkWrite(sql, ['r1', fc.seal('Ann'), 'r2', fc.seal('Bob')]));
  assert.throws(() => checkWrite("INSERT INTO staff (id, full_name, email, email_hash) VALUES (?, 'Plain Name', ?, ?)",
    ['s', fc.seal('a@b.co'), fc.fingerprint('a@b.co')]), /staff\.full_name/);
});

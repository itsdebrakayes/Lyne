/**
 * sms.test.js — texts cost money and reach a person's own phone, so what may be
 * sent matters more than how. No text is sent by any test here.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeJamaican, fitsOneSegment, smsAvailable } = require('../src/utils/smsSender');
const { calledMessage, stopCode } = require('../src/utils/smsAlerts');

const on = { SMS_ENABLED: 'true', TWILIO_ACCOUNT_SID: 'x', TWILIO_AUTH_TOKEN: 'y', TWILIO_MESSAGING_SERVICE_SID: 'z' };

test('Jamaican numbers come out the same however they are typed', () => {
  for (const typed of ['876-555-0100', '(876) 555 0100', '+1 876 555 0100', '18765550100', '555-0100']) {
    assert.equal(normalizeJamaican(typed), '+18765550100', typed);
  }
  assert.equal(normalizeJamaican('658-555-0100'), '+16585550100');
});

test('a number outside Jamaica is not a number we can text', () => {
  for (const typed of ['212-555-0100', '+44 20 7946 0958', '12345', '', null]) assert.equal(normalizeJamaican(typed), null);
});

test('nothing can send unless switched on and fully configured', () => {
  assert.equal(smsAvailable(on), true);
  assert.equal(smsAvailable({ ...on, SMS_ENABLED: 'false' }), false);
  assert.equal(smsAvailable({ ...on, SMS_ENABLED: undefined }), false);
  assert.equal(smsAvailable({ ...on, TWILIO_AUTH_TOKEN: '' }), false);
});

test('one segment means 160 GSM characters', () => {
  assert.equal(fitsOneSegment('a'.repeat(160)), true);
  assert.equal(fitsOneSegment('a'.repeat(161)), false);
  assert.equal(fitsOneSegment('Lyne — a dash from a word processor'), false);
});

test('every called alert names Lyne, says how to stop, and fits one segment', () => {
  const samples = [
    { ticket: 'ACC-106', branch: 'Half Way Tree', stop: 'AB23CD45' },
    { ticket: 'ACC-106', branch: 'Half Way Tree' },
    { ticket: 'ACC-1060', branch: 'The Extremely Long Named Branch Of The Organisation On The Northern Coast Of Jamaica Near The Airport And The Hotels', stop: 'AB23CD45' },
    { ticket: 'TEL-001', branch: 'Kingston — Half Way Tree', stop: 'AB23CD45' },
    { ticket: 'TEL-001', branch: null },
  ];
  for (const s of samples) {
    const text = calledMessage(s);
    assert.match(text, /^Lyne: /);
    assert.match(text, /Stop texts/);
    assert.equal(fitsOneSegment(text), true, text);
  }
});

test('a stop code is short, readable, and not guessable by counting', () => {
  const a = stopCode();
  assert.match(a, /^[2-9A-HJKMNP-Z]{8}$/);
  assert.notEqual(a, stopCode());
});

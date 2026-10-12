/**
 * TRN extraction against text shaped like what Vision and ML Kit return.
 * Every number here is invented.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { extractTrn, formatTrn, isValidTrn } from '../src/lib/trn';

test('reads a labelled TRN printed with hyphens', () => {
  assert.equal(extractTrn(['TAX ADMINISTRATION JAMAICA', 'TRN: 123-456-789', 'Name: JANE DOE']), '123-456-789');
});

test('reads a TRN printed with spaces, label on the line above', () => {
  assert.equal(extractTrn(['Taxpayer Registration Number', '123 456 789']), '123-456-789');
});

test('reads a TRN printed as one run', () => {
  assert.equal(extractTrn(['TRN 123456789']), '123-456-789');
});

test('repairs common misreads inside a labelled number', () => {
  assert.equal(extractTrn(['TRN: 1O2-456-7B9']), '102-456-789');
  assert.equal(extractTrn(['TRN: l23 456 789']), '123-456-789');
});

test('prefers the labelled number over other nine-digit runs', () => {
  assert.equal(extractTrn(['Ref 555 555 555', 'TRN 123-456-789', 'Phone 876 555 0142']), '123-456-789');
});

test('accepts a lone unlabelled nine-digit number', () => {
  assert.equal(extractTrn(['JANE DOE', '123-456-789', 'KINGSTON']), '123-456-789');
});

test('returns null for a blank or blurry image', () => {
  assert.equal(extractTrn([]), null);
  assert.equal(extractTrn(['', '  ']), null);
  assert.equal(extractTrn(['~ . , ;', 'll1 ::']), null);
});

test('returns null when there is no TRN in the text', () => {
  assert.equal(extractTrn(['Grocery receipt', 'Total $1,250.00', 'Thank you']), null);
});

test('does not guess between two different unlabelled numbers', () => {
  assert.equal(extractTrn(['123-456-789', '987-654-321']), null);
});

test('does not guess between two different labelled numbers', () => {
  assert.equal(extractTrn(['TRN 123-456-789', 'TRN 987-654-321']), null);
});

test('ignores longer digit runs (phone numbers, account numbers)', () => {
  assert.equal(extractTrn(['Account 1234567890123']), null);
  assert.equal(extractTrn(['Call 18765550142']), null);
});

test('does not turn words into numbers', () => {
  assert.equal(extractTrn(['TRN GOODBOSS']), null);
});

test('formatTrn and isValidTrn', () => {
  assert.equal(formatTrn('123456789'), '123-456-789');
  assert.equal(isValidTrn('123-456-789'), true);
  assert.equal(isValidTrn('123 456 789'), true);
  assert.equal(isValidTrn('12345678'), false);
  assert.equal(isValidTrn('1234567890'), false);
});

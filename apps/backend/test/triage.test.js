/**
 * Healthcare triage: a red-flag "yes" tags the ticket possibly urgent; nothing
 * else about joining changes, and every question must be answered.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateTriage } = require('../src/utils/triage');

const Q = [
  { id: 'q1', question: 'Have you hit your head in the last 24 hours?', red_flag: true },
  { id: 'q2', question: 'Is this a follow-up visit?', red_flag: false },
];

test('no questions means no triage and no tag', () => {
  assert.deepEqual(evaluateTriage([], undefined), { ok: true, answers: null, flag: 'none' });
});

test('a department with questions requires every answer', () => {
  assert.equal(evaluateTriage(Q, undefined).ok, false);
  assert.equal(evaluateTriage(Q, [{ question_id: 'q1', answer: false }]).ok, false);
  assert.equal(evaluateTriage(Q, [{ question_id: 'q1', answer: 'yes' }, { question_id: 'q2', answer: false }]).ok, false);
});

test('a yes to a red-flag question tags the ticket possibly urgent', () => {
  const r = evaluateTriage(Q, [{ question_id: 'q1', answer: true }, { question_id: 'q2', answer: false }]);
  assert.equal(r.ok, true);
  assert.equal(r.flag, 'possibly_urgent');
  assert.equal(r.answers[0].question, Q[0].question);
});

test('a yes to a non-red-flag question does not', () => {
  const r = evaluateTriage(Q, [{ question_id: 'q1', answer: false }, { question_id: 'q2', answer: true }]);
  assert.equal(r.flag, 'none');
});

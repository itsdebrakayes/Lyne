/**
 * triage.js — a department's triage questions, and what a patient's answers mean.
 *
 * The rule, which every caller relies on:
 *   A "yes" to any red-flag question tags the ticket 'possibly_urgent'.
 *   Nothing else changes. The patient joins the same line at the same place;
 *   a person reviews the tag and decides whether to move them. Lyne never
 *   diagnoses and never reorders a line by itself.
 *
 * Answers are stored with each question's wording copied in, so a record still
 * reads correctly after the question is reworded or retired.
 */

/** Active questions for a department, in order. */
async function triageQuestionsFor(db, serviceId) {
  const [rows] = await db.query(
    `SELECT id, seq, question, detail, red_flag
       FROM service_triage_questions
      WHERE service_id = ? AND is_active = TRUE
      ORDER BY seq, created_at`,
    [serviceId]
  );
  return rows.map((r) => ({ ...r, red_flag: Boolean(r.red_flag) }));
}

/**
 * Check a patient's answers against the department's questions.
 *
 * @param {Array<{id:string,question:string,detail?:string,red_flag:boolean}>} questions
 * @param {unknown} answers  [{ question_id, answer: boolean }]
 * @returns {{ ok: true, answers: Array, flag: 'none'|'possibly_urgent' } | { ok: false, error: string }}
 */
function evaluateTriage(questions, answers) {
  if (!questions.length) return { ok: true, answers: null, flag: 'none' };
  if (!Array.isArray(answers)) {
    return { ok: false, error: 'Answer the questions for this department before joining the line.' };
  }
  const byId = new Map();
  for (const a of answers) {
    if (!a || typeof a.question_id !== 'string' || typeof a.answer !== 'boolean') {
      return { ok: false, error: 'Each question needs a yes or no answer.' };
    }
    byId.set(a.question_id, a.answer);
  }
  const unanswered = questions.filter((q) => !byId.has(q.id));
  if (unanswered.length) {
    return { ok: false, error: 'Answer every question for this department before joining the line.' };
  }
  const recorded = questions.map((q) => ({
    question_id: q.id,
    question: q.question,
    red_flag: q.red_flag,
    answer: byId.get(q.id),
  }));
  const flag = recorded.some((r) => r.red_flag && r.answer === true) ? 'possibly_urgent' : 'none';
  return { ok: true, answers: recorded, flag };
}

module.exports = { triageQuestionsFor, evaluateTriage };

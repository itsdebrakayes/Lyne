/**
 * branchClosures.js — is this branch closed today, and what to say about it.
 *
 * A closure is one row for a run of days: a hurricane, a holiday, a building that
 * cannot open. With branch_id NULL it covers the whole organisation. The end date
 * is the last closed day, so the branch is expected back the day after it, and a
 * person is told that with the plain caveat that a further notice can change it.
 */
const SQL = `
  SELECT c.id, c.kind, c.reason, c.business_id, c.branch_id,
         DATE_FORMAT(c.starts_on, '%Y-%m-%d') AS starts_on,
         DATE_FORMAT(c.ends_on, '%Y-%m-%d') AS ends_on,
         DATE_FORMAT(c.ends_on + INTERVAL 1 DAY, '%W %e %M') AS reopens_label,
         br.name AS branch_name
    FROM branches br
    JOIN branch_closures c
      ON c.business_id = br.business_id AND (c.branch_id IS NULL OR c.branch_id = br.id)
   WHERE br.id = ? AND c.lifted_at IS NULL AND CURDATE() BETWEEN c.starts_on AND c.ends_on
   ORDER BY c.ends_on DESC LIMIT 1`;

/** Today's closure for this branch, or null. */
async function activeClosure(db, branchId) {
  if (!branchId) return null;
  const [rows] = await db.query(SQL, [branchId]);
  return rows?.[0] || null;
}

/** The sentence a person sees. */
function closureMessage(c) {
  const what = c.kind === 'outage' ? 'is out of service' : 'is closed';
  return `${c.branch_name || 'This branch'} ${what} today: ${c.reason}. It is expected to reopen on ${c.reopens_label}, unless a further notice says otherwise.`;
}

/** For a SELECT over branches aliased `br`: any closure in force, as columns. */
const closureColumns = `
  (SELECT JSON_OBJECT('kind', c.kind, 'reason', c.reason, 'ends_on', DATE_FORMAT(c.ends_on, '%Y-%m-%d'),
                      'reopens_label', DATE_FORMAT(c.ends_on + INTERVAL 1 DAY, '%W %e %M'))
     FROM branch_closures c
    WHERE c.business_id = br.business_id AND (c.branch_id IS NULL OR c.branch_id = br.id)
      AND c.lifted_at IS NULL AND CURDATE() BETWEEN c.starts_on AND c.ends_on
    ORDER BY c.ends_on DESC LIMIT 1) AS closure`;

module.exports = { activeClosure, closureMessage, closureColumns };

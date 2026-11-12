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
         br.name AS branch_name, br.open_days, br.country_code
    FROM branches br
    JOIN branch_closures c
      ON c.business_id = br.business_id AND (c.branch_id IS NULL OR c.branch_id = br.id)
   WHERE br.id = ? AND c.lifted_at IS NULL AND CURDATE() BETWEEN c.starts_on AND c.ends_on
   ORDER BY c.ends_on DESC LIMIT 1`;

/* A hospital does not shut for a public holiday, so health organisations are left
   out. Every other organisation closes unless it has chosen to stay open. */
const HOLIDAY_SECTOR = "b.sector <> 'healthcare'";

const longLabel = (iso) => new Date(`${iso}T12:00:00Z`)
  .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).replace(',', '');

/** The next day after `from` the branch normally opens and is not a holiday. */
function nextOpenDay(from, openDays, holidays) {
  const days = String(openDays || '1,2,3,4,5').split(',').map(Number);
  const d = new Date(`${from}T12:00:00Z`);
  for (let i = 0; i < 21; i += 1) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.toISOString().slice(0, 10);
    if (days.includes(d.getUTCDay()) && !holidays.has(iso)) return iso;
  }
  return from;
}

async function upcomingHolidays(db, country) {
  const [rows] = await db.query(
    `SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS day FROM public_holidays
      WHERE country = ? AND holiday_date BETWEEN CURDATE() AND CURDATE() + INTERVAL 30 DAY`, [country]);
  return new Set((rows || []).map((r) => r.day));
}

/** Today's national holiday for this branch, unless it chose to stay open. */
async function holidayClosure(db, branchId) {
  const [rows] = await db.query(
    `SELECT ph.name AS reason, br.name AS branch_name, br.business_id, br.open_days, br.country_code,
            DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today
       FROM branches br
       JOIN businesses b ON b.id = br.business_id
       JOIN public_holidays ph ON ph.country = br.country_code AND ph.holiday_date = CURDATE() AND ph.is_full_day = 1
      WHERE br.id = ? AND ${HOLIDAY_SECTOR}
        AND NOT EXISTS (SELECT 1 FROM holiday_openings o
                         WHERE o.business_id = b.id AND o.holiday_date = ph.holiday_date
                           AND (o.branch_id IS NULL OR o.branch_id = br.id))`, [branchId]);
  const h = rows?.[0];
  if (!h) return null;
  const reopens = nextOpenDay(h.today, h.open_days, await upcomingHolidays(db, h.country_code));
  return { kind: 'holiday', reason: h.reason, branch_name: h.branch_name, branch_id: branchId, reopens_label: longLabel(reopens) };
}

/** Today's closure for this branch, or null. A recorded closure comes first. */
async function activeClosure(db, branchId) {
  if (!branchId) return null;
  const [rows] = await db.query(SQL, [branchId]);
  const c = rows?.[0];
  if (!c) return holidayClosure(db, branchId);
  return { ...c, reopens_label: await reopensAfter(db, c.ends_on, c.open_days, c.country_code) };
}

/** The first day after a closure the branch really opens: not simply the next day. */
async function reopensAfter(db, lastDay, openDays, country) {
  const [rows] = await db.query(
    `SELECT DATE_FORMAT(holiday_date, '%Y-%m-%d') AS day FROM public_holidays
      WHERE country = ? AND holiday_date BETWEEN ? AND ? + INTERVAL 21 DAY`, [country, lastDay, lastDay]);
  return longLabel(nextOpenDay(lastDay, openDays, new Set((rows || []).map((r) => r.day))));
}

/** Marks a list of branches with today's holiday, in one pass. */
async function withHolidayClosures(db, branches) {
  for (const b of branches) {
    if (typeof b.closure === 'string') b.closure = JSON.parse(b.closure);
    if (!b.closure) continue;
    // eslint-disable-next-line no-await-in-loop
    b.closure.reopens_label = await reopensAfter(db, b.closure.ends_on, b.open_days, b.country_code);
  }
  const open = branches.filter((b) => !b.closure && b.sector !== 'healthcare');
  if (!open.length) return branches;
  const [holidays] = await db.query(
    `SELECT country, name, DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today FROM public_holidays WHERE holiday_date = CURDATE() AND is_full_day = 1`);
  if (!holidays?.length) return branches;
  const [openings] = await db.query('SELECT business_id, branch_id FROM holiday_openings WHERE holiday_date = CURDATE()');
  for (const h of holidays) {
    // eslint-disable-next-line no-await-in-loop
    const later = await upcomingHolidays(db, h.country);
    for (const b of open) {
      if (b.country_code !== h.country) continue;
      if ((openings || []).some((o) => o.business_id === b.business_id && (!o.branch_id || o.branch_id === b.id))) continue;
      b.closure = { kind: 'holiday', reason: h.name, reopens_label: longLabel(nextOpenDay(h.today, b.open_days, later)) };
    }
  }
  return branches;
}

/** The sentence a person sees. */
function closureMessage(c) {
  if (c.kind === 'holiday') {
    return `${c.branch_name || 'This branch'} is closed today for ${c.reason}. It is expected to reopen on ${c.reopens_label}.`;
  }
  const what = c.kind === 'outage' ? 'is out of service' : 'is closed';
  return `${c.branch_name || 'This branch'} ${what} today: ${c.reason}. It is expected to reopen on ${c.reopens_label}, unless a further notice says otherwise.`;
}

/** For a SELECT over branches aliased `br`: any closure in force, as columns. */
const closureColumns = `
  (SELECT JSON_OBJECT('kind', c.kind, 'reason', c.reason, 'ends_on', DATE_FORMAT(c.ends_on, '%Y-%m-%d'))
     FROM branch_closures c
    WHERE c.business_id = br.business_id AND (c.branch_id IS NULL OR c.branch_id = br.id)
      AND c.lifted_at IS NULL AND CURDATE() BETWEEN c.starts_on AND c.ends_on
    ORDER BY c.ends_on DESC LIMIT 1) AS closure`;

module.exports = { activeClosure, closureMessage, closureColumns, withHolidayClosures, nextOpenDay };

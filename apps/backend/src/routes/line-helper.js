/**
 * Line Helper — "Lyne joins the line at the time you agree."
 *
 * A premium customer names the time they want to be SERVED. We work backwards
 * through the predicted wait for that branch, service and hour, join the queue
 * on their behalf at the right moment, and tell them when to leave home.
 *
 * THE FAIRNESS PROBLEM, AND WHAT ANSWERS IT
 *
 * Holding a physical position for somebody who is not in the building is the
 * part of this that could be unfair, and it is worth being plain about: an
 * agency will not accept a paid product that lets a subscriber jump a queue in
 * absentia, and the first complaint about one ends the pilot.
 *
 * `let_pass` is the answer. When the helper's ticket is called and the customer
 * has not checked in, the place YIELDS to the people behind them — up to
 * max_pass_turns times, then it expires. So the helper buys a good position,
 * not an immovable one, and nobody standing in the room is stuck behind an
 * empty space indefinitely.
 *
 * A branch can refuse the feature outright (branches.line_helper_enabled). The
 * app asks before offering it, so an agency that says no never has a customer
 * turn up holding a ticket its clerks will not honour.
 */
const express = require('express');
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { validate, schemas } = require('../middleware/validate');
const { hasPremium } = require('../lib/premium');

const router = express.Router();

/** How far ahead somebody may schedule. A week is the design's "next week". */
const MAX_DAYS_AHEAD = 7;
/** Below this there is no helper to run — just join the line. */
const MIN_LEAD_MINUTES = 20;

/**
 * The predicted wait for one (branch, service, weekday, hour), from the same
 * wait_time_records history /predictions/best-times reads.
 *
 * Returns null when there is not enough history, and the caller refuses rather
 * than guessing: scheduling somebody's morning around an invented number is
 * worse than telling them we cannot do it for that slot yet.
 */
async function predictWait(branchId, serviceId, dow, hour) {
  /* Columns and window identical to /predictions/best-times, deliberately:
     the number quoted here is the number the scheduler will act on, and the
     number the customer was shown on the heatmap. Three different queries over
     the same history would eventually disagree, and the disagreement would
     surface as a helper joining at a time the app did not predict.

     wait_time_records carries branch_id and service_id directly — there is no
     queue join, and the date column is visit_date. */
  const [rows] = await pool.query(
    `SELECT ROUND(AVG(w.wait_time_minutes), 0) AS avg_wait, COUNT(*) AS visits
       FROM wait_time_records w
      WHERE w.branch_id = ?
        AND w.service_id = ?
        AND w.day_of_week = ?
        AND w.hour_of_day = ?
        AND w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)`,
    [branchId, serviceId, dow, hour]
  );
  const row = rows[0];
  if (!row || Number(row.visits) < 5) return null;
  return Number(row.avg_wait);
}

/** The row as the app should see it, with the ticket's live position if it has one. */
function shape(r) {
  return {
    id: r.id,
    branch_id: r.branch_id,
    branch_name: r.branch_name,
    service_id: r.service_id,
    service_name: r.service_name,
    target_served_at: r.target_served_at,
    travel_minutes: Number(r.travel_minutes),
    let_pass: Boolean(Number(r.let_pass)),
    max_pass_turns: Number(r.max_pass_turns),
    passes_used: Number(r.passes_used),
    scheduled_join_at: r.scheduled_join_at,
    leave_home_at: r.leave_home_at,
    predicted_wait_minutes: Number(r.predicted_wait_minutes),
    status: r.status,
    ticket_id: r.ticket_id,
    ticket_number: r.ticket_number || null,
    people_ahead: r.people_ahead === null || r.people_ahead === undefined
      ? null : Number(r.people_ahead),
  };
}

const SELECT_WITH_CONTEXT = `
  SELECT h.*, b.name AS branch_name, s.name AS service_name,
         t.ticket_number,
         (SELECT COUNT(*) FROM queue_tickets x
           WHERE x.queue_id = t.queue_id
             AND x.status = 'waiting'
             AND x.position < t.position) AS people_ahead
    FROM line_helper_requests h
    JOIN branches b ON b.id = h.branch_id
    JOIN services s ON s.id = h.service_id
    LEFT JOIN queue_tickets t ON t.id = h.ticket_id
`;

// ── GET /api/line-helper/active ───────────────────────────────
// The one the app shows on the hold screen. At most one is live at a time.
router.get('/active', requireAuth, async (req, res) => {
  try {
    if (!req.dbUser?.id) return res.status(403).json({ error: 'Customer account required.' });
    const [rows] = await pool.query(
      `${SELECT_WITH_CONTEXT}
        WHERE h.user_id = ?
          AND h.status IN ('scheduled', 'holding', 'checked_in')
        ORDER BY h.scheduled_join_at ASC
        LIMIT 1`,
      [req.dbUser.id]
    );
    res.json({ helper: rows.length ? shape(rows[0]) : null });
  } catch (err) {
    console.error('line-helper active:', err);
    res.status(500).json({ error: 'Could not load your Line Helper.' });
  }
});

// ── POST /api/line-helper/quote ───────────────────────────────
// What WOULD happen, without committing to it. The setup screen needs the
// predicted wait for each arrival option before the customer picks one, and
// quoting is not the same as scheduling.
router.post('/quote', requireAuth, validate(schemas.lineHelperQuote), async (req, res) => {
  try {
    if (!hasPremium(req.dbUser)) {
      return res.status(402).json({ error: 'Line Helper is part of Lyne Premium.' });
    }
    const { branch_id: branchId, service_id: serviceId, target_served_at: targetIso } = req.body;
    const target = new Date(targetIso);
    if (Number.isNaN(target.getTime())) {
      return res.status(400).json({ error: 'That is not a valid time.' });
    }
    const wait = await predictWait(branchId, serviceId, target.getDay(), target.getHours());
    res.json({
      predicted_wait_minutes: wait,
      /* Null is a real answer and the client must say so rather than showing a
         confident zero. */
      enough_history: wait !== null,
    });
  } catch (err) {
    console.error('line-helper quote:', err);
    res.status(500).json({ error: 'Could not work that out.' });
  }
});

// ── POST /api/line-helper ─────────────────────────────────────
router.post('/', requireAuth, validate(schemas.lineHelperCreate), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    if (!req.dbUser?.id) return res.status(403).json({ error: 'Customer account required.' });
    if (!hasPremium(req.dbUser)) {
      return res.status(402).json({ error: 'Line Helper is part of Lyne Premium.' });
    }

    const {
      branch_id: branchId, service_id: serviceId,
      target_served_at: targetIso, travel_minutes: travelMinutes,
      let_pass: letPass,
    } = req.body;

    const target = new Date(targetIso);
    if (Number.isNaN(target.getTime())) {
      return res.status(400).json({ error: 'That is not a valid time.' });
    }
    const now = new Date();
    if (target.getTime() <= now.getTime()) {
      return res.status(400).json({ error: 'Pick a time in the future.' });
    }
    if (target.getTime() - now.getTime() > MAX_DAYS_AHEAD * 86400000) {
      return res.status(400).json({ error: `Line Helper can be scheduled up to ${MAX_DAYS_AHEAD} days ahead.` });
    }

    await conn.beginTransaction();

    /* The branch has to allow it, and the service has to belong to the branch —
       both checked here rather than trusted from the client. */
    const [[branch]] = await conn.query(
      `SELECT b.id, b.business_id, b.line_helper_enabled, b.name
         FROM branches b WHERE b.id = ? LIMIT 1`,
      [branchId]
    );
    if (!branch) { await conn.rollback(); return res.status(404).json({ error: 'Branch not found.' }); }
    if (!Number(branch.line_helper_enabled)) {
      await conn.rollback();
      return res.status(409).json({ error: `${branch.name} does not offer Line Helper.` });
    }

    const [[queue]] = await conn.query(
      `SELECT id FROM queues WHERE branch_id = ? AND service_id = ? AND is_active = TRUE LIMIT 1`,
      [branchId, serviceId]
    );
    if (!queue) { await conn.rollback(); return res.status(404).json({ error: 'That service is not running at this branch.' }); }

    /* ONE AT A TIME, for the same reason the app allows one live ticket: two
       helpers holding two places for one person is the abuse this feature would
       otherwise enable, and it is the first thing an agency would find. */
    const [[existing]] = await conn.query(
      `SELECT id FROM line_helper_requests
        WHERE user_id = ? AND status IN ('scheduled','holding','checked_in') LIMIT 1`,
      [req.dbUser.id]
    );
    if (existing) {
      await conn.rollback();
      return res.status(409).json({ error: 'You already have a Line Helper running. Release that one first.' });
    }

    const wait = await predictWait(branchId, serviceId, target.getDay(), target.getHours());
    if (wait === null) {
      await conn.rollback();
      return res.status(422).json({
        error: 'There is not enough history for that slot yet, so a helper would be guessing. Try another time.',
      });
    }

    const joinAt = new Date(target.getTime() - wait * 60000);
    const leaveAt = new Date(target.getTime() - Number(travelMinutes) * 60000);

    if (joinAt.getTime() - now.getTime() < MIN_LEAD_MINUTES * 60000) {
      await conn.rollback();
      return res.status(422).json({
        error: `That is too soon for a helper — the line would need joining in under ${MIN_LEAD_MINUTES} minutes. Join it yourself instead.`,
      });
    }

    const id = uuidv4();
    await conn.query(
      `INSERT INTO line_helper_requests
         (id, user_id, business_id, branch_id, service_id,
          target_served_at, travel_minutes, let_pass, max_pass_turns,
          scheduled_join_at, leave_home_at, predicted_wait_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 3, ?, ?, ?, 'scheduled')`,
      [id, req.dbUser.id, branch.business_id, branchId, serviceId,
       target, Number(travelMinutes), letPass ? 1 : 0,
       joinAt, leaveAt, wait]
    );

    await conn.commit();

    const [rows] = await pool.query(`${SELECT_WITH_CONTEXT} WHERE h.id = ?`, [id]);
    res.status(201).json({ helper: shape(rows[0]) });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('line-helper create:', err);
    res.status(500).json({ error: 'Could not schedule the helper.' });
  } finally {
    conn.release();
  }
});

// ── PATCH /api/line-helper/:id ────────────────────────────────
// on_my_way · push_back · check_in · release
router.patch('/:id', requireAuth, validate(schemas.lineHelperUpdate), async (req, res) => {
  try {
    if (!req.dbUser?.id) return res.status(403).json({ error: 'Customer account required.' });
    const { action } = req.body;

    const [[row]] = await pool.query(
      `SELECT * FROM line_helper_requests WHERE id = ? AND user_id = ? LIMIT 1`,
      [req.params.id, req.dbUser.id]
    );
    if (!row) return res.status(404).json({ error: 'No such Line Helper.' });

    if (action === 'release') {
      /* Releasing gives the place up for real: the ticket is left, not simply
         forgotten about, so the people behind actually move up. */
      if (row.ticket_id) {
        await pool.query(
          `UPDATE queue_tickets SET status = 'left', closed_reason = 'helper_released', updated_at = NOW()
            WHERE id = ? AND status IN ('waiting','called')`,
          [row.ticket_id]
        );
      }
      await pool.query(`UPDATE line_helper_requests SET status = 'released' WHERE id = ?`, [row.id]);
    } else if (action === 'check_in') {
      await pool.query(`UPDATE line_helper_requests SET status = 'checked_in' WHERE id = ?`, [row.id]);
    } else if (action === 'on_my_way') {
      /* No state change — it is an acknowledgement, and the value of it is that
         the counter can see the holder is moving rather than absent. Recorded
         by moving to checked_in only once they actually scan in at the kiosk. */
      await pool.query(`UPDATE line_helper_requests SET updated_at = NOW() WHERE id = ?`, [row.id]);
    } else if (action === 'push_back') {
      if (row.status !== 'scheduled') {
        return res.status(409).json({ error: 'The helper has already joined the line, so the time cannot move.' });
      }
      const newTarget = new Date(new Date(row.target_served_at).getTime() + 15 * 60000);
      const newJoin = new Date(new Date(row.scheduled_join_at).getTime() + 15 * 60000);
      const newLeave = new Date(new Date(row.leave_home_at).getTime() + 15 * 60000);
      await pool.query(
        `UPDATE line_helper_requests
            SET target_served_at = ?, scheduled_join_at = ?, leave_home_at = ?
          WHERE id = ?`,
        [newTarget, newJoin, newLeave, row.id]
      );
    }

    const [rows] = await pool.query(`${SELECT_WITH_CONTEXT} WHERE h.id = ?`, [row.id]);
    res.json({ helper: shape(rows[0]) });
  } catch (err) {
    console.error('line-helper update:', err);
    res.status(500).json({ error: 'Could not update the helper.' });
  }
});

module.exports = router;

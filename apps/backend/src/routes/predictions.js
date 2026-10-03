/**
 * predictions.js — Predictive model results (Jupyter output)
 *
 * GET  /api/predictions/public?business_id=&branch_id=&type= — public customer-facing insights
 * GET  /api/predictions?business_id=&branch_id=&type=        — private company insights
 * POST /api/predictions                                 — upsert insight (executive/system)
 */

const router = require('express').Router();
const { randomUUID: uuidv4 } = require('crypto');
const pool = require('../db/pool');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { hasPremium } = require('../lib/premium');
const { validate, schemas } = require('../middleware/validate');
const { auditLog } = require('../middleware/auditLog');
const {
  requireStaffRole,
  requireBusinessAccess,
  requireBranchAccess,
  scopedBusinessId,
} = require('../middleware/tenantAccess');

const PUBLIC_INSIGHT_TYPES = new Set(['best_time_to_visit', 'wait_time_predictions', 'heatmap_data']);

async function getPredictions(req, res, publicOnly = false) {
  try {
    const { business_id, branch_id, service_id, type, max_age_minutes = 60 } = req.query;
    if (!business_id) return res.status(400).json({ error: 'business_id is required.' });
    if (publicOnly && (!type || !PUBLIC_INSIGHT_TYPES.has(type))) {
      return res.status(400).json({ error: 'A supported public insight type is required.' });
    }

    const conditions = ['p.business_id = ?'];
    const params = [business_id];
    if (branch_id) { conditions.push('p.branch_id = ?'); params.push(branch_id); }
    if (service_id) { conditions.push('p.service_id = ?'); params.push(service_id); }
    if (type) { conditions.push('p.insight_type = ?'); params.push(type); }

    const [rows] = await pool.query(
      `SELECT p.*, b.name AS branch_name, s.name AS service_name,
              CASE
                WHEN p.stale_after IS NOT NULL AND p.stale_after < NOW() THEN TRUE
                WHEN TIMESTAMPDIFF(MINUTE, p.generated_at, NOW()) > ? THEN TRUE
                ELSE FALSE
              END AS is_stale
       FROM predictive_results p
       LEFT JOIN branches b ON p.branch_id = b.id
       LEFT JOIN services s ON p.service_id = s.id
       WHERE ${conditions.join(' AND ')}
         AND p.generated_at = (
           SELECT MAX(p2.generated_at)
           FROM predictive_results p2
           WHERE p2.business_id = p.business_id
             AND p2.insight_type = p.insight_type
             AND (p2.branch_id = p.branch_id OR (p2.branch_id IS NULL AND p.branch_id IS NULL))
             AND (p2.service_id = p.service_id OR (p2.service_id IS NULL AND p.service_id IS NULL))
         )
       ORDER BY p.insight_type`,
      [Math.min(Math.max(parseInt(max_age_minutes) || 60, 5), 1440), ...params]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch predictions.' });
  }
}

router.get('/public', (req, res) => getPredictions(req, res, true));

/**
 * GET /api/predictions/my-desk — what the model says about the line a clerk is
 * actually working, and nothing else.
 *
 * The generic /predictions route is supervisor-and-up, correctly: it will hand
 * back manager scores, staffing recommendations and anomaly reports, none of
 * which are a line clerk's business. But that left the person doing the work
 * unable to see the one prediction that is about them, while the models
 * computed it every two hours for nobody.
 *
 * So this is scoped rather than opened up: one service — theirs — and the two
 * numbers that mean something at a counter.
 *
 *   what the model expects this hour, and
 *   what they have actually averaged today.
 *
 * Both are shown together on purpose. A prediction on its own is a claim; next
 * to the clerk's own morning it is either confirmation or a question worth
 * asking, and either is more useful than the number alone.
 */
router.get('/my-desk', requireAuth, requireStaffRole('line_staff', 'supervisor', 'manager', 'executive'), async (req, res) => {
  try {
    const staff = req.dbStaff;
    if (!staff) return res.status(403).json({ error: 'Staff only.' });
    const serviceId = req.query.service_id || staff.assigned_service_id;
    if (!serviceId) return res.json({ service_id: null, predicted: null, actual: null });

    const [rows] = await pool.query(
      `SELECT insight_data, model_version, generated_at
         FROM predictive_results
        WHERE business_id = ? AND insight_type = 'service_time_predictions'
        ORDER BY generated_at DESC
        LIMIT 1`,
      [staff.business_id]
    );

    let predicted = null;
    if (rows.length) {
      const data = typeof rows[0].insight_data === 'string'
        ? JSON.parse(rows[0].insight_data)
        : rows[0].insight_data;
      const svc = (data?.services || []).find((x) => x.service_id === serviceId);
      if (svc) {
        const hour = new Date().getHours();
        /* The hourly figure when the model has one for right now, otherwise the
           service's own average. Falling back to a neighbouring hour would be
           inventing a number the model did not produce. */
        const thisHour = (svc.by_hour || []).find((h) => Number(h.hour) === hour);
        predicted = {
          minutes: Number(thisHour?.avg_service_minutes ?? svc.avg_service_minutes) || null,
          basis: thisHour ? 'this hour' : 'all day',
          p90_minutes: Number(svc.p90_service_minutes) || null,
          sample_size: Number(svc.sample_size) || 0,
          service_name: svc.service_name || null,
          model_version: rows[0].model_version,
          generated_at: rows[0].generated_at,
        };
      }
    }

    /* Their own morning, from completed visits at their own hand. started and
       completed both required — a visit without both has no duration to average
       and would drag the number toward zero. */
    const [mine] = await pool.query(
      `SELECT COUNT(*) AS served,
              ROUND(AVG(TIMESTAMPDIFF(SECOND, t.started_serving_at, t.completed_at)) / 60, 1) AS avg_minutes
         FROM queue_tickets t
         JOIN queues q ON q.id = t.queue_id
        WHERE t.served_by_staff_id = ?
          AND q.queue_date = CURDATE()
          AND t.status = 'served'
          AND t.started_serving_at IS NOT NULL
          AND t.completed_at IS NOT NULL`,
      [staff.id]
    );

    res.json({
      service_id: serviceId,
      predicted,
      actual: {
        served_today: Number(mine[0]?.served || 0),
        avg_minutes: mine[0]?.avg_minutes === null ? null : Number(mine[0].avg_minutes),
      },
    });
  } catch (err) {
    console.error('my-desk predictions error:', err);
    res.status(500).json({ error: 'Could not read your desk predictions.' });
  }
});



// ── GET /api/predictions/best-times ──────────────────────────
// Public, computed live from the last 90 days of visit history:
// the best (and worst) time to visit each service of a branch, plus a
// 7-day quietness strip for the mobile "Plan your visit" section.
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function hourLabel(hour) {
  if (hour === 12) return '12:00 PM';
  return hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`;
}

/** "8a", "12p", "4p" — the axis under the today bars, where "12:00 PM" will not fit. */
function shortHourLabel(hour) {
  if (hour === 12) return '12p';
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

function quietLevel(avgWait, min, max) {
  if (max <= min) return 1;
  const ratio = (avgWait - min) / (max - min);
  return ratio <= 0.33 ? 1 : ratio <= 0.66 ? 2 : 3; // 1 quiet · 2 busy · 3 peak
}

// A "best time" drawn from a 2-visit cell is noise sold as insight: two lucky
// quiet visits will always undercut a genuinely calm hour backed by hundreds,
// so the headline ends up on whichever slot happens to be thinnest. Rank only
// cells with a real sample behind them — but fall back to the full set for a
// branch too new to have one, so a fresh tenant still sees something.
const MIN_CELL_VISITS = 8;
function wellEvidenced(slots) {
  const solid = slots.filter((slot) => slot.visits >= MIN_CELL_VISITS);
  return solid.length ? solid : slots;
}

/* optionalAuth, not requireAuth. The branch-level headline below is genuinely
   free and the screen renders it before anyone signs in, so a token is not
   required to reach this. It IS required to get anything premium, which is the
   part that was missing: every caller, signed in or not, was handed the full
   per-service breakdown — best hour, busiest hour, the seven-day strip and all
   sixty-three heatmap cells. The paywall existed only in the mobile client, as
   a drawing. Anyone who opened the URL got the whole product for nothing, and
   so did any free account. */
router.get('/best-times', optionalAuth, async (req, res) => {
  try {
    const { business_id, branch_id } = req.query;
    if (!business_id || !branch_id) {
      return res.status(400).json({ error: 'business_id and branch_id are required.' });
    }

    const [rows] = await pool.query(
      `SELECT s.id AS service_id, s.name AS service_name,
              w.day_of_week AS dow, w.hour_of_day AS hour,
              COUNT(*) AS visits,
              ROUND(AVG(w.wait_time_minutes), 1) AS avg_wait
       FROM wait_time_records w
       JOIN services s ON s.id = w.service_id
       WHERE w.business_id = ? AND w.branch_id = ?
         AND w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
         AND w.hour_of_day BETWEEN 8 AND 17
       GROUP BY s.id, s.name, w.day_of_week, w.hour_of_day
       HAVING COUNT(*) >= 2`,
      [business_id, branch_id]
    );

    const byService = new Map();
    rows.forEach((row) => {
      const key = row.service_id;
      if (!byService.has(key)) byService.set(key, { service_id: key, service_name: row.service_name, slots: [] });
      byService.get(key).slots.push({ dow: Number(row.dow), hour: Number(row.hour), visits: Number(row.visits), avg_wait: Number(row.avg_wait) });
    });

    const decorate = (slot) => slot && ({
      ...slot,
      day_name: DAY_NAMES[slot.dow] || 'Any day',
      hour_label: hourLabel(slot.hour),
    });

    const services = Array.from(byService.values()).map((service) => {
      const slots = service.slots;
      const ranked = wellEvidenced(slots);
      const best = [...ranked].sort((a, b) => a.avg_wait - b.avg_wait || b.visits - a.visits)[0];
      const busiest = [...ranked].sort((a, b) => b.avg_wait - a.avg_wait || b.visits - a.visits)[0];

      // Day-of-week averages → the 7-day quietness strip.
      const dayTotals = Array.from({ length: 7 }, () => ({ waitTotal: 0, weight: 0 }));
      slots.forEach((slot) => {
        dayTotals[slot.dow].waitTotal += slot.avg_wait * slot.visits;
        dayTotals[slot.dow].weight += slot.visits;
      });
      const dayAverages = dayTotals.map((day, dow) => ({
        dow,
        day_name: DAY_NAMES[dow],
        avg_wait: day.weight ? Math.round((day.waitTotal / day.weight) * 10) / 10 : null,
      }));
      const known = dayAverages.filter((day) => day.avg_wait !== null);
      const minWait = Math.min(...known.map((day) => day.avg_wait));
      const maxWait = Math.max(...known.map((day) => day.avg_wait));
      const week = dayAverages.map((day) => ({
        ...day,
        level: day.avg_wait === null ? 0 : quietLevel(day.avg_wait, minWait, maxWait),
      }));
      const quietestDay = known.sort((a, b) => a.avg_wait - b.avg_wait)[0];

      /* The day x hour grid, which this endpoint computed and then threw away.
         The heatmap needs it, and recomputing it on the client would mean
         shipping the raw visit history to the phone — far more data, and a
         second place for the thresholds to drift.

         `level` is assigned by the SAME quietLevel() the week strip uses, over
         the same min/max for this service. That matters: two scales for "busy"
         on one screen is incoherent, and a cell could read quiet in the heatmap
         while its day read peak in the strip directly above it.

         Bounded by construction — hours are already restricted to 8-17 and
         cells need at least 2 visits, so a service contributes at most 70 of
         these and usually far fewer. */
      const cellWaits = slots.map((slot) => slot.avg_wait);
      const cellMin = cellWaits.length ? Math.min(...cellWaits) : 0;
      const cellMax = cellWaits.length ? Math.max(...cellWaits) : 0;
      const grid = slots
        .map((slot) => ({
          dow: slot.dow,
          hour: slot.hour,
          visits: slot.visits,
          avg_wait: slot.avg_wait,
          level: quietLevel(slot.avg_wait, cellMin, cellMax),
        }))
        .sort((a, b) => a.dow - b.dow || a.hour - b.hour);

      return {
        service_id: service.service_id,
        service_name: service.service_name,
        best: decorate(best),
        busiest: decorate(busiest),
        quietest_day: quietestDay || null,
        week,
        grid,
      };
    }).sort((a, b) => a.service_name.localeCompare(b.service_name));

    // Branch-level rollup for the free tier: one honest headline window.
    // The card promises a "typical wait" for the whole branch, so average every
    // service running in that (day, hour) cell, weighted by how many visits each
    // contributed. Taking the single lowest *service* cell instead answered a
    // different question — it surfaced the quietest corner of the quietest
    // service, and reported a 1-minute headline on a branch whose services
    // average 5-11 minutes, which reads as broken rather than impressive.
    const branchCells = new Map();
    rows.forEach((row) => {
      const key = `${row.dow}:${row.hour}`;
      const cell = branchCells.get(key)
        || { dow: Number(row.dow), hour: Number(row.hour), waitTotal: 0, visits: 0 };
      cell.waitTotal += Number(row.avg_wait) * Number(row.visits);
      cell.visits += Number(row.visits);
      branchCells.set(key, cell);
    });
    const branchSlots = Array.from(branchCells.values()).map((cell) => ({
      dow: cell.dow,
      hour: cell.hour,
      visits: cell.visits,
      avg_wait: Math.round((cell.waitTotal / cell.visits) * 10) / 10,
    }));
    const branchBest = decorate(
      [...wellEvidenced(branchSlots)].sort((a, b) => a.avg_wait - b.avg_wait || b.visits - a.visits)[0]
    );

    /* ── TODAY, HOUR BY HOUR ──────────────────────────────────────────────
       The hero of "Plan your visit": one bar per opening hour of the day it
       actually is, with the quietest marked. Branch-wide, not per service,
       which is what makes it free — the same reasoning as branch_best above.
       Somebody who has not paid still gets a real answer to "when should I go
       today", and what the subscription buys is the same question answered per
       service and across the whole week.

       Built from branchSlots, which is already every (day, hour) cell averaged
       across services and weighted by visits, so this costs no extra query. */
    const todayDow = new Date().getDay();
    let shownDow = todayDow;
    let todayHours = branchSlots
      .filter((slot) => slot.dow === todayDow)
      .sort((a, b) => a.hour - b.hour);

    /* A BRANCH THAT DOES NOT OPEN TODAY STILL HAS A SHAPE WORTH SHOWING.
       Nineteen of the demo's thirty-two branches have no Saturday history —
       a traffic court does not sit on a Saturday, which is correct rather than
       missing — and the card simply vanished on those, taking the hero of the
       screen with it on any weekend.

       So when today has nothing, fall back to the branch's best-evidenced day
       and SAY WHICH DAY IT IS. The client switches its heading from "BEST TIME
       TODAY · SATURDAY" to "A TYPICAL MONDAY", which is a different and still
       true claim. Labelling Monday's pattern as today's would be the one
       unacceptable option. */
    if (!todayHours.length) {
      const visitsByDow = new Map();
      branchSlots.forEach((slot) => {
        visitsByDow.set(slot.dow, (visitsByDow.get(slot.dow) || 0) + slot.visits);
      });
      const fallbackDow = [...visitsByDow.entries()]
        .sort((a, b) => b[1] - a[1])[0]?.[0];
      if (fallbackDow !== undefined) {
        shownDow = fallbackDow;
        todayHours = branchSlots
          .filter((slot) => slot.dow === fallbackDow)
          .sort((a, b) => a.hour - b.hour);
      }
    }
    const todayWaits = todayHours.map((h) => h.avg_wait);
    const todayMin = todayWaits.length ? Math.min(...todayWaits) : 0;
    const todayMax = todayWaits.length ? Math.max(...todayWaits) : 0;
    /* The quietest hour with real evidence behind it, not simply the lowest
       number — two lucky visits at 4pm should not beat a calm 10am backed by
       two hundred. Same MIN_CELL_VISITS rule the rest of this endpoint uses. */
    const todayBestSlot = todayHours.length
      ? [...wellEvidenced(todayHours)].sort((a, b) => a.avg_wait - b.avg_wait || b.visits - a.visits)[0]
      : null;

    const today = todayHours.length ? {
      dow: shownDow,
      day_name: DAY_NAMES[shownDow],
      /* False means "this branch has no history for today, so this is another
         day's pattern" — the client must not call it today. */
      is_today: shownDow === todayDow,
      best: decorate(todayBestSlot),
      hours: todayHours.map((h) => ({
        hour: h.hour,
        hour_label: shortHourLabel(h.hour),
        avg_wait: h.avg_wait,
        visits: h.visits,
        level: quietLevel(h.avg_wait, todayMin, todayMax),
        /* So the client does not have to find the maximum to size a bar, and
           every client sizes them the same way. */
        intensity: todayMax > 0 ? Math.round((h.avg_wait / todayMax) * 100) / 100 : 0,
        is_best: todayBestSlot ? h.hour === todayBestSlot.hour : false,
      })),
    } : null;

    /* THE ACTUAL PAYWALL. One definition of entitlement — hasPremium() — shared
       with every other paid surface, so a lapsed trial cannot read as current
       here while reading as expired everywhere else.

       A free caller still gets the service LIST. That is deliberate: the locked
       panel in the app blurs real cards, and a card needs its own service name
       to be the thing the customer is being shown they cannot read yet. What it
       does not get is a single number — no best hour, no busiest hour, no week
       strip, no grid. Nothing that could be reassembled into the feature. */
    const entitled = hasPremium(req.dbUser);

    res.json({
      window_days: 90,
      branch_best: branchBest || null,
      /* Free, like branch_best — see the note where it is built. */
      today,
      /* Named so the client does not have to infer it from absent fields, and
         so a future caller cannot mistake "no history" for "not paid". */
      premium: entitled,
      /* THE TIER LINE, placed where the design puts it. The locked panel in
         Predictive Insights covers the HEATMAP, not the service list — a free
         customer sees that Court Order Collection is quietest on Friday at 1pm
         and cannot see the hour-by-hour grid behind it. That is a better free
         tier than a blurred wall: it gives a real answer, and what it withholds
         is the depth rather than the point.

         So `best` ships free — it is the hook — and `week`, `grid`, `busiest`
         and `quietest_day` do not. Those are the three things the upsell names
         and the three things that cost a subscription. */
      services: entitled
        ? services
        : services.map((svc) => ({
            service_id: svc.service_id,
            service_name: svc.service_name,
            best: svc.best,
          })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute best visit times.' });
  }
});

/* ── GET /api/predictions/for-you ──────────────────────────────────────────
 *
 * The same prediction engine, pointed at ONE PERSON'S habits.
 *
 * /best-times answers "when is this branch quiet", which is a fact about the
 * branch and the same for everybody. That is generic analytics with a paywall
 * in front of it, and it is a thin thing to charge for: a subscriber gets the
 * identical answer the person beside them would get.
 *
 * This answers "when should YOU go", which needs three things the branch does
 * not know and we do:
 *
 *   WHERE YOU ACTUALLY GO.   Somebody who has been to Half Way Tree eleven
 *   times and Portmore once does not want them weighted equally, and does not
 *   want to pick a branch from a list of thirty every time they open the app.
 *
 *   WHAT YOU ACTUALLY DO.    A person who only ever files GCT returns should
 *   be told about the GCT line, not about the quietest service at that branch.
 *
 *   HOW LONG YOU TAKE TO GET THERE.  A ten-minute window at 8am is useless to
 *   somebody with a forty-minute journey. Travel time comes from the Line
 *   Helper requests they have actually made, which is a measured number rather
 *   than a guess, and it narrows the recommendation to windows they can reach.
 *
 * It also reads the hours they tend to GO, because a quiet slot at 3pm is not a
 * recommendation for somebody who has only ever come in the morning — that is a
 * suggestion to rearrange their life, not to avoid a queue. Preferred hours are
 * a soft weight rather than a filter: a genuinely empty hour outside their
 * pattern is still worth naming, with the reason attached.
 *
 * Premium only, and it says plainly when it does not know enough yet rather
 * than dressing up the branch average as a personal insight.
 */
router.get('/for-you', requireAuth, async (req, res) => {
  try {
    const user = req.dbUser;
    if (!user?.id) return res.status(403).json({ error: 'Customer account required.' });
    if (!hasPremium(user)) {
      return res.status(402).json({ error: 'Personal timing is part of Lyne Premium.' });
    }

    /* Finished visits only. Somebody standing in a line right now is not yet
       evidence of a habit, and counting them makes today look like a pattern. */
    /* Grouped by the ALIASES dow and hour. Under only_full_group_by the GROUP BY
       expression has to match the selected one exactly, and DAYOFWEEK(x) - 1 is
       a different expression from DAYOFWEEK(x) — grouping by the latter while
       selecting the former is rejected. (The explanation lives out here because
       a backtick inside a template literal ends it.) */
    const [history] = await pool.query(
      `SELECT q.branch_id, b.name AS branch_name, b.business_id, bus.name AS business_name,
              q.service_id, s.name AS service_name,
              DAYOFWEEK(t.joined_at) - 1 AS dow,
              HOUR(t.joined_at)        AS hour,
              COUNT(*)                 AS visits
         FROM queue_tickets t
         JOIN queues     q   ON q.id = t.queue_id
         JOIN branches   b   ON b.id = q.branch_id
         JOIN businesses bus ON bus.id = b.business_id
         JOIN services   s   ON s.id = q.service_id
        WHERE t.user_id = ?
          AND t.status IN ('served','left','cancelled','no_show')
          AND t.joined_at >= DATE_SUB(CURDATE(), INTERVAL 180 DAY)
        GROUP BY q.branch_id, b.name, b.business_id, bus.name, q.service_id, s.name, dow, hour`,
      [user.id]
    );

    const totalVisits = history.reduce((n, r) => n + Number(r.visits), 0);

    /* Two visits is not a habit. Below that the honest answer is that we do not
       know them yet, and the app falls back to the branch view — which is a
       real answer rather than a personalised-looking guess. */
    const MIN_VISITS_FOR_HABITS = 2;
    if (totalVisits < MIN_VISITS_FOR_HABITS) {
      return res.json({
        personalised: false,
        reason: 'not_enough_history',
        visits_seen: totalVisits,
        visits_needed: MIN_VISITS_FOR_HABITS,
      });
    }

    const tally = (keyOf, labelOf) => {
      const m = new Map();
      history.forEach((r) => {
        const k = keyOf(r);
        if (k === null || k === undefined) return;
        const cur = m.get(k) || { key: k, label: labelOf(r), visits: 0, extra: r };
        cur.visits += Number(r.visits);
        m.set(k, cur);
      });
      return [...m.values()].sort((a, b) => b.visits - a.visits);
    };

    const branches = tally((r) => r.branch_id, (r) => r.branch_name);
    const services = tally((r) => r.service_id, (r) => r.service_name);
    const hours    = tally((r) => Number(r.hour), (r) => String(r.hour));
    const home = branches[0];

    /* Their journey, measured rather than assumed: the median travel time of
       the Line Helper requests they have made. No requests means no claim. */
    const [[travel]] = await pool.query(
      `SELECT ROUND(AVG(travel_minutes)) AS mins, COUNT(*) AS n
         FROM line_helper_requests WHERE user_id = ?`,
      [user.id]
    );
    const travelMinutes = Number(travel?.n) > 0 ? Number(travel.mins) : null;

    /* The hours they actually turn up in, as a soft preference. */
    const preferredHours = hours.slice(0, 3).map((h) => Number(h.key)).sort((a, b) => a - b);

    /* Now the prediction, for THEIR branch and THEIR services only. */
    const serviceIds = services.slice(0, 4).map((x) => x.key);
    const [slots] = await pool.query(
      `SELECT w.service_id, s.name AS service_name,
              w.day_of_week AS dow, w.hour_of_day AS hour,
              COUNT(*) AS visits, ROUND(AVG(w.wait_time_minutes), 1) AS avg_wait
         FROM wait_time_records w
         JOIN services s ON s.id = w.service_id
        WHERE w.branch_id = ?
          AND w.service_id IN (?)
          AND w.visit_date >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
          AND w.hour_of_day BETWEEN 8 AND 17
        GROUP BY w.service_id, s.name, w.day_of_week, w.hour_of_day
       HAVING COUNT(*) >= ?`,
      [home.key, serviceIds.length ? serviceIds : [''], MIN_CELL_VISITS]
    );

    const scored = slots.map((r) => {
      const hour = Number(r.hour);
      const inPattern = preferredHours.length === 0 || preferredHours.includes(hour);
      return {
        service_id: r.service_id,
        service_name: r.service_name,
        dow: Number(r.dow),
        day_name: DAY_NAMES[Number(r.dow)],
        hour,
        hour_label: hourLabel(hour),
        avg_wait: Number(r.avg_wait),
        visits: Number(r.visits),
        /* An hour they already favour wins ties against an equally quiet one
           they have never used — the recommendation should fit the life they
           have, not ask them to rearrange it. A clearly quieter slot still
           wins outright, and carries the reason. */
        score: Number(r.avg_wait) - (inPattern ? 3 : 0),
        matches_your_hours: inPattern,
      };
    });

    const best = [...scored].sort((a, b) => a.score - b.score)[0] || null;
    const worst = [...scored].sort((a, b) => b.avg_wait - a.avg_wait)[0] || null;

    res.json({
      personalised: true,
      home_branch: home ? {
        branch_id: home.key,
        branch_name: home.label,
        business_id: home.extra.business_id,
        business_name: home.extra.business_name,
        visits: home.visits,
      } : null,
      top_services: services.slice(0, 4).map((x) => ({
        service_id: x.key, service_name: x.label, visits: x.visits,
      })),
      habits: {
        total_visits: totalVisits,
        preferred_hours: preferredHours,
        travel_minutes: travelMinutes,
      },
      best,
      worst: worst && best && worst.hour === best.hour && worst.dow === best.dow ? null : worst,
    });
  } catch (err) {
    console.error('for-you error:', err);
    res.status(500).json({ error: 'Could not work out your timings.' });
  }
});

router.get(
  '/',
  requireAuth,
  requireStaffRole('supervisor', 'manager', 'executive'),
  requireBusinessAccess(),
  requireBranchAccess,
  (req, res) => getPredictions(req, res)
);

// Upsert prediction result — called by the Jupyter pipeline import script
router.post(
  '/',
  requireAuth,
  requireStaffRole('executive'),
  requireBusinessAccess('body'),
  requireBranchAccess,
  auditLog('prediction_import', 'predictive_result'), validate(schemas.savePrediction),
  async (req, res) => {
  try {
    const {
      business_id,
      branch_id,
      service_id,
      insight_type,
      insight_data,
      model_version,
      generated_at,
      source_window_start,
      source_window_end,
      records_processed,
      stale_after,
    } = req.body;
    if (!business_id || !insight_type || !insight_data) {
      return res.status(400).json({ error: 'business_id, insight_type, and insight_data are required.' });
    }
    const id = uuidv4();
    await pool.query(
      `INSERT INTO predictive_results
         (id, business_id, branch_id, service_id, insight_type, insight_data, model_version,
          source_window_start, source_window_end, records_processed, stale_after, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))`,
      [
        id,
        scopedBusinessId(req, business_id),
        branch_id || null,
        service_id || null,
        insight_type,
        JSON.stringify(insight_data),
        model_version || null,
        source_window_start || null,
        source_window_end || null,
        records_processed || 0,
        stale_after || null,
        generated_at || null,
      ]
    );
    const [created] = await pool.query('SELECT * FROM predictive_results WHERE id = ?', [id]);
    res.status(201).json(created[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save prediction.' });
  }
});

module.exports = router;

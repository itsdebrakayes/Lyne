/**
 * sessionPlan.js — how many windows a sitting needs, and what a given number
 * of windows can actually get through.
 *
 * Every other forecast in this product guesses at demand. A session does not
 * have to: people register in advance, so the headcount is KNOWN. That removes
 * the variable everything else is uncertain about and leaves one unknown —
 * how long a person takes at the window — which history can answer.
 *
 * Known demand + measured service time is not a forecast. It is arithmetic.
 * That is what makes this worth showing a Court Administrator a week out
 * rather than a report afterwards.
 *
 * Two questions, and an administrator asks both:
 *
 *   "I have five windows and seven hours — will I clear 400 people?"
 *   "I have 400 people and seven hours — how many windows do I need?"
 *
 * And a third that is not the same question, which is the part people get
 * wrong: "I want nobody waiting more than 30 minutes." Clearing the room and
 * clearing it *without a long queue* need different numbers, because a system
 * run at 99% utilisation finishes on time and has everyone waiting hours to do
 * it. Throughput answers the first. Erlang-C answers the second, and it always
 * asks for more.
 */

/**
 * Expected queue wait in minutes for M/M/c.
 *
 * Mirrors erlang_c_wait_minutes in apps/model/scripts/recommend_staffing.py.
 * Duplicated deliberately rather than shared: the Python runs in the worker
 * every two hours, and a planner has to answer while somebody drags a slider.
 * The two are checked against each other in the tests.
 */
function erlangCWaitMinutes(arrivalsPerHour, servedPerHourPerWindow, windows) {
  if (windows <= 0 || servedPerHourPerWindow <= 0) return Infinity;
  const a = arrivalsPerHour / servedPerHourPerWindow;   // offered load, in Erlangs
  if (a >= windows) return Infinity;                    // at or over capacity the queue never settles

  /* Computed as a running product rather than a**k / k! — 400 registrations
     over a long sitting can push k past 170, where factorial overflows to
     Infinity and the whole expression collapses to NaN. */
  let term = 1;
  let sum = 1;
  for (let k = 1; k < windows; k += 1) {
    term = (term * a) / k;
    sum += term;
  }
  const last = ((term * a) / windows) * (windows / (windows - a));
  const pWait = last / (sum + last);
  return (pWait / (windows * servedPerHourPerWindow - arrivalsPerHour)) * 60;
}

/** Hours between two SQL times, tolerating a sitting that ends past midnight. */
function sittingHours(startsAt, endsAt) {
  const mins = (t) => {
    const [h, m] = String(t || '').split(':').map(Number);
    return Number.isFinite(h) ? h * 60 + (m || 0) : null;
  };
  const a = mins(startsAt);
  const b = mins(endsAt);
  if (a == null || b == null) return 0;
  return ((b - a + 1440) % 1440) / 60;
}

/**
 * The plan.
 *
 * @param {object} input
 * @param {number} input.expected        people expected — registrations, or an estimate
 * @param {number} input.hours           length of the sitting
 * @param {number} input.serviceMinutes  measured minutes per person at the window
 * @param {number} [input.windows]       windows the administrator is considering
 * @param {number} [input.targetWaitMinutes] the promise they want to make
 * @param {number} [input.maxWindows]    physical windows the venue has
 */
function planSession({
  expected,
  hours,
  serviceMinutes,
  windows = null,
  targetWaitMinutes = null,
  maxWindows = 40,
}) {
  const people = Math.max(0, Number(expected) || 0);
  const h = Math.max(0, Number(hours) || 0);
  const svc = Number(serviceMinutes) || 0;

  if (!h || !svc) {
    return { usable: false, reason: 'Need a sitting length and a service time to plan.' };
  }

  // What one window gets through, if it never stops.
  const perWindow = Math.floor((h * 60) / svc);
  const servedPerHourPerWindow = 60 / svc;

  // Direction 1 — windows needed simply to get everyone through the door.
  const windowsToClear = perWindow > 0 ? Math.ceil(people / perWindow) : Infinity;

  // Direction 2 — windows needed to hold the wait promise. Always >= the above,
  // because finishing on time and never queuing are different guarantees.
  const arrivalsPerHour = h > 0 ? people / h : 0;
  let windowsForTarget = null;
  let targetAchievableWait = null;
  if (targetWaitMinutes != null && people > 0) {
    for (let c = 1; c <= maxWindows; c += 1) {
      const wq = erlangCWaitMinutes(arrivalsPerHour, servedPerHourPerWindow, c);
      if (wq <= targetWaitMinutes) { windowsForTarget = c; targetAchievableWait = round1(wq); break; }
    }
  }

  // What the administrator's own proposal actually does.
  let proposal = null;
  if (windows != null && windows > 0) {
    const capacity = perWindow * windows;
    const wq = erlangCWaitMinutes(arrivalsPerHour, servedPerHourPerWindow, windows);
    /* Hours to get through everyone at this width — the honest answer to
       "when do we finish", which is not always "when the sitting ends". */
    const hoursToClear = people > 0 ? (people * svc) / (60 * windows) : 0;
    proposal = {
      windows,
      capacity,
      clears: capacity >= people,
      shortfall: Math.max(0, people - capacity),
      hours_to_clear: round1(hoursToClear),
      overruns_by_minutes: hoursToClear > h ? Math.round((hoursToClear - h) * 60) : 0,
      expected_wait_minutes: Number.isFinite(wq) ? round1(wq) : null,
      /* Utilisation is the number that explains the wait. Above ~85% a queue
         stops being linear: an extra person costs far more than the last one. */
      utilisation_pct: Math.round((arrivalsPerHour / (servedPerHourPerWindow * windows)) * 100),
    };
  }

  return {
    usable: true,
    people,
    hours: round1(h),
    service_minutes: round1(svc),
    per_window: perWindow,
    windows_to_clear: Number.isFinite(windowsToClear) ? windowsToClear : null,
    windows_for_target: windowsForTarget,
    target_wait_minutes: targetWaitMinutes,
    target_achievable_wait: targetAchievableWait,
    target_unreachable: targetWaitMinutes != null && windowsForTarget == null,
    proposal,
  };
}

function round1(n) {
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

module.exports = { planSession, erlangCWaitMinutes, sittingHours };

/**
 * branchReport.js — the evidence behind a branch report.
 *
 * docs/reports/BRANCH_REPORT_REQUIREMENTS.md sets what a report must say. This
 * turns one row per visit into the figures it says them with. It is pure: rows in,
 * figures out, no database, so every rule can be tested.
 *
 * The rules that matter:
 *   - Averages come from the visits themselves, never from daily averages.
 *   - A figure with nothing behind it is null ("unavailable"), never 0.
 *   - Stages (called, started) describe a visit; outcomes (completed, left...)
 *     end one. Every visit has exactly one outcome, so outcomes add up to arrivals.
 *   - A target is judged at the value in force on the day of the visit.
 */

const round = (n, d = 1) => (n === null || n === undefined ? null : Math.round(n * 10 ** d) / 10 ** d);
const rate = (part, whole) => (whole ? round((part / whole) * 100) : null);
const mean = (xs) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : null);

/** Nearest-rank: the value that this share of measured values are at or below. */
function percentile(xs, p) {
  if (!xs.length) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

function stdev(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / (xs.length - 1));
}

/** A number from the database, keeping "not recorded" apart from zero. */
const minutes = (v) => (v === null || v === undefined ? null : Number(v));

const OPEN_STATUSES = new Set(['waiting', 'called', 'in_service']);

/** The one outcome a visit ended in. */
function outcomeOf(r) {
  if (OPEN_STATUSES.has(r.status)) return 'open';
  if (r.status === 'served') return r.closed_reason ? 'incomplete' : 'completed';
  if (r.status === 'no_show') return 'noShow';
  if (r.status === 'left') return 'left';
  return 'cancelled';
}

const reachedCounter = (r) => r.status === 'served' || r.status === 'no_show' || r.status === 'in_service';

/** Everything a set of visits can say about itself. */
function summarise(rows, waitTargetAt) {
  const out = { arrivals: rows.length, completed: 0, incomplete: 0, left: 0, noShow: 0, cancelled: 0, open: 0 };
  const waits = []; const counter = []; const elapsed = [];
  const people = new Set();
  let identified = 0; let called = 0; let started = 0; let within = 0; let eligible = 0;

  for (const r of rows) {
    out[outcomeOf(r)] += 1;
    if (r.user_id) { people.add(r.user_id); identified += 1; }
    const wait = minutes(r.wait_min);
    if (reachedCounter(r) && wait !== null && wait >= 0) {
      called += 1;
      waits.push(wait);
      const target = waitTargetAt ? waitTargetAt(r.day) : null;
      if (target !== null && target !== undefined) { eligible += 1; if (wait <= target) within += 1; }
    }
    if (r.status === 'served') {
      started += 1;
      const svc = minutes(r.service_min); const all = minutes(r.elapsed_min);
      if (svc !== null && svc >= 0) counter.push(svc);
      if (all !== null && all >= 0) elapsed.push(all);
    }
  }

  return {
    ...out,
    called, started,
    uniqueCustomers: people.size, identifiedVisits: identified,
    identifiedPct: rate(identified, rows.length),
    completionPct: rate(out.completed, rows.length),
    noShowPct: rate(out.noShow, rows.length),
    leftPct: rate(out.left, rows.length),
    incompletePct: rate(out.incomplete, rows.length),
    waitN: waits.length,
    waitAvg: round(mean(waits)), waitMedian: round(percentile(waits, 50)), waitP90: round(percentile(waits, 90)),
    counterN: counter.length,
    counterAvg: round(mean(counter)), counterMedian: round(percentile(counter, 50)),
    elapsedN: elapsed.length, elapsedAvg: round(mean(elapsed)),
    withinTarget: eligible ? within : null, targetEligible: eligible,
    breaches: eligible ? eligible - within : null,
    withinTargetPct: rate(within, eligible),
  };
}

/** Each day from..to, as YYYY-MM-DD. Strings throughout: no timezone can shift them. */
function eachDay(from, to) {
  const days = [];
  const d = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end) { days.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return days;
}
const dowOf = (day) => new Date(`${day}T12:00:00Z`).getUTCDay();
const dayOfMonth = (day) => Number(day.slice(8, 10));
const lastDayOfMonth = (day) => new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate();
const addDays = (day, n) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/**
 * The value of one target on any date, from its change history. Before the first
 * recorded change it held that change's old value; after the last, the current one.
 */
function targetTimeline(changes, current) {
  const sorted = [...changes].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  return (day) => {
    let value = sorted.length ? sorted[0].old_value : current;
    for (const c of sorted) if (c.day <= day) value = c.new_value;
    return value === undefined ? null : value;
  };
}

/**
 * Which target applied: the branch's if it had one on that date, otherwise the
 * company's. A branch override whose start is recorded applies from that date.
 */
function applicableTarget(metric, input) {
  const col = `target_${metric}`;
  const hist = (input.targetChanges || []).filter((c) => c.metric === col);
  const company = targetTimeline(hist.filter((c) => !c.branch_id), input.companyTarget?.[col] ?? null);
  const branchHist = hist.filter((c) => c.branch_id);
  const branchNow = input.branchTarget?.[col] ?? null;
  const branch = targetTimeline(branchHist, branchNow);
  const firstBranch = branchHist.length ? [...branchHist].sort((a, b) => String(a.day).localeCompare(String(b.day)))[0].day : null;
  const at = (day) => {
    if (firstBranch ? day >= firstBranch : branchNow !== null) return Number(branch(day));
    const v = company(day);
    return v === null ? null : Number(v);
  };
  return { at, companyAt: (day) => { const v = company(day); return v === null ? null : Number(v); }, branchAt: (day) => ((firstBranch ? day >= firstBranch : branchNow !== null) ? Number(branch(day)) : null) };
}

const groupBy = (rows, key) => {
  const m = new Map();
  for (const r of rows) { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
};

/** Reasons a visit stopped short, sorted into who has to act on them. */
const REASON_GROUPS = {
  wrong_documents: ['Client documentation', 'Wrong or missing documents'],
  wrong_service: ['Client documentation', 'Joined the wrong service'],
  referred_elsewhere: ['Referral', 'Referred elsewhere'],
  system_issue: ['Internal dependency', 'System issue'],
  day_ended: ['Internal dependency', 'Day ended before it finished'],
};
const reasonInfo = (r) => REASON_GROUPS[r] || ['Unknown', 'Other or not stated'];

function reasons(rows) {
  const counts = new Map();
  for (const r of rows) {
    if (outcomeOf(r) !== 'incomplete') continue;
    counts.set(r.closed_reason, (counts.get(r.closed_reason) || 0) + 1);
  }
  return [...counts].map(([code, count]) => ({ code, group: reasonInfo(code)[0], label: reasonInfo(code)[1], count }))
    .sort((a, b) => b.count - a.count);
}

const dist = (rows, key, labels) => {
  const m = new Map();
  for (const r of rows) { const k = key(r); m.set(k, (m.get(k) || 0) + 1); }
  return [...m].map(([k, count]) => ({ key: k, label: labels ? labels[k] ?? k : k, count })).sort((a, b) => b.count - a.count);
};

/**
 * @param input.rows      one row per visit, both periods
 * @param input.period    { from, to }
 * @param input.previous  { from, to }
 */
function buildBranchReport(input) {
  const { period, previous, branch } = input;
  const openDays = String(branch.open_days ?? '1,2,3,4,5').split(',').map(Number);
  const holidays = new Map((input.holidays || []).map((h) => [h.day, h.name]));
  const inPeriod = (r) => r.day >= period.from && r.day <= period.to;
  const inPrevious = (r) => r.day >= previous.from && r.day <= previous.to;
  const rows = input.rows.filter(inPeriod);
  const prevRows = input.rows.filter(inPrevious);
  const waitT = applicableTarget('wait_minutes', input);
  const completionT = applicableTarget('completion_rate', input);
  const noShowT = applicableTarget('no_show_rate', input);
  const s = (xs) => summarise(xs, waitT.at);
  const serviceName = new Map((input.services || []).map((x) => [x.id, x.name]));
  const staffName = new Map((input.staff || []).map((x) => [x.id, x]));
  const counterInfo = new Map((input.counters || []).map((x) => [x.id, x]));

  /* ── days ─────────────────────────────────────────────── */
  const byDay = groupBy(rows, (r) => r.day);
  /* A closure names the days it covers, so a closed day has a recorded reason. */
  const closureOn = (day) => (input.closures || []).find((c) => c.starts_on <= day && c.ends_on >= day && !(c.lifted_on && c.lifted_on <= day)) || null;
  /* Who sat where comes from clocking in and out; a day's seating plan fills in
     for days before sittings were recorded. */
  const sittings = input.sittings || [];
  const seats_ = [...sittings, ...(input.assignments || [])];
  const seatsByDay = groupBy(seats_, (a) => a.day);
  const days = eachDay(period.from, period.to).map((day) => {
    const dayRows = byDay.get(day) || [];
    const open = openDays.includes(dowOf(day));
    const holiday = holidays.get(day) || null;
    const closure = closureOn(day);
    const kind = dayRows.length ? (open ? 'operating' : 'special') : closure ? 'closure' : holiday ? 'holiday' : open ? 'zero' : 'closed';
    const seats = seatsByDay.get(day) || [];
    return {
      day, dow: dowOf(day), kind, holiday, closure,
      ...s(dayRows),
      counters: new Set(seats.map((a) => a.counter_id)).size, officers: new Set(seats.map((a) => a.staff_id)).size,
      services: [...groupBy(dayRows, (r) => r.service_id)].map(([id, xs]) => ({ id, name: serviceName.get(id) || id, ...s(xs) }))
        .sort((a, b) => b.arrivals - a.arrivals),
      peakHour: dist(dayRows, (r) => r.join_hour)[0]?.key ?? null,
      closedByBranch: dayRows.filter((r) => String(r.closed_reason || '').startsWith('branch_closed')).length,
    };
  });
  const operating = days.filter((d) => d.kind === 'operating' || d.kind === 'special');

  /* ── time patterns ────────────────────────────────────── */
  const operatingByDow = new Map();
  for (const d of operating) operatingByDow.set(d.dow, (operatingByDow.get(d.dow) || 0) + 1);
  const hours = [...new Set(rows.map((r) => r.join_hour))].sort((a, b) => a - b);
  const startsByHour = new Map();
  for (const r of rows) if (r.start_hour !== null && r.start_hour !== undefined && r.status === 'served') startsByHour.set(r.start_hour, (startsByHour.get(r.start_hour) || 0) + 1);
  const hourly = hours.map((hour) => {
    const xs = rows.filter((r) => r.join_hour === hour);
    const x = s(xs);
    return { hour, arrivals: x.arrivals, perDay: round(x.arrivals / Math.max(1, operating.length)), started: startsByHour.get(hour) || 0, waitAvg: x.waitAvg, waitP90: x.waitP90, counterAvg: x.counterAvg };
  });
  const weekdays = [...operatingByDow.keys()].sort((a, b) => a - b).map((dow) => {
    const xs = rows.filter((r) => dowOf(r.day) === dow);
    const n = operatingByDow.get(dow);
    const x = s(xs);
    return { dow, operatingDays: n, arrivals: x.arrivals, perDay: round(x.arrivals / n), waitAvg: x.waitAvg, waitP90: x.waitP90, counterAvg: x.counterAvg };
  });
  /* Arrivals per operating day, for each weekday and hour. */
  const heat = weekdays.map((w) => ({
    dow: w.dow,
    cells: hours.map((h) => round(rows.filter((r) => dowOf(r.day) === w.dow && r.join_hour === h).length / w.operatingDays)),
  }));

  /* Payday and month-end, only when the dates are identifiable and repeat. */
  const isPayday = (day) => dayOfMonth(day) >= 24 && dayOfMonth(day) <= 26;
  const isMonthEnd = (day) => dayOfMonth(day) >= lastDayOfMonth(day) - 2;
  const cycle = (test) => {
    const hit = operating.filter((d) => test(d.day));
    const rest = operating.filter((d) => !isPayday(d.day) && !isMonthEnd(d.day));
    const months = new Set(hit.map((d) => d.day.slice(0, 7))).size;
    return {
      cycles: months, days: hit.length,
      arrivalsPerDay: round(mean(hit.map((d) => d.arrivals))), ordinaryPerDay: round(mean(rest.map((d) => d.arrivals))),
      waitAvg: round(mean(hit.filter((d) => d.waitAvg !== null).map((d) => d.waitAvg))),
      ordinaryWaitAvg: round(mean(rest.filter((d) => d.waitAvg !== null).map((d) => d.waitAvg))),
    };
  };

  /* Weeks, Monday to Sunday, for the longer editions. */
  const weekOf = (day) => addDays(day, -((dowOf(day) + 6) % 7));
  const weeks = [...groupBy(rows, (r) => weekOf(r.day))].sort((a, b) => a[0].localeCompare(b[0]))
    .map(([from, xs]) => ({
      from, to: addDays(from, 6), ...s(xs),
      operatingDays: new Set(xs.map((r) => r.day)).size,
      services: [...groupBy(xs, (r) => r.service_id)].map(([id, ys]) => ({ id, name: serviceName.get(id) || id, ...s(ys) }))
        .sort((a, b) => b.arrivals - a.arrivals),
    }));
  /* Successive 30-day segments, oldest first, for the 90-day edition. */
  const segments = [];
  const allDays = eachDay(period.from, period.to);
  if (allDays.length >= 60) {
    for (let end = allDays.length; end >= 30; end -= 30) {
      const seg = { from: allDays[end - 30], to: allDays[end - 1] };
      segments.unshift({ ...seg, ...s(rows.filter((r) => r.day >= seg.from && r.day <= seg.to)) });
    }
  }

  /* ── services ─────────────────────────────────────────── */
  const prevByService = groupBy(prevRows, (r) => r.service_id);
  const services = [...groupBy(rows, (r) => r.service_id)].map(([id, xs]) => {
    const prev = prevByService.get(id) || [];
    const x = s(xs);
    return {
      id, name: serviceName.get(id) || id, ...x,
      sharePct: rate(xs.length, rows.length),
      previous: s(prev),
      weekly: [...groupBy(xs, (r) => weekOf(r.day))].sort((a, b) => a[0].localeCompare(b[0])).map(([from, ys]) => ({ from, ...s(ys) })),
      reasons: reasons(xs),
      perDay: operating.map((d) => ({ day: d.day, arrivals: (byDay.get(d.day) || []).filter((r) => r.service_id === id).length })),
      hourly: hours.map((hour) => ({ hour, arrivals: xs.filter((r) => r.join_hour === hour).length, waitAvg: s(xs.filter((r) => r.join_hour === hour)).waitAvg })),
      weekdays: weekdays.map((w) => {
        const dayXs = xs.filter((r) => dowOf(r.day) === w.dow);
        return { dow: w.dow, perDay: round(dayXs.length / w.operatingDays), waitAvg: s(dayXs).waitAvg };
      }),
      staff: dist(xs.filter((r) => r.served_by), (r) => r.served_by, Object.fromEntries([...staffName].map(([k, v]) => [k, v.full_name]))),
      counters: (input.counters || []).filter((c) => c.service_id === id).length,
      seatedDays: new Set(seats_.filter((a) => counterInfo.get(a.counter_id)?.service_id === id).map((a) => a.day)).size,
    };
  }).sort((a, b) => b.arrivals - a.arrivals);

  /* ── staff ────────────────────────────────────────────── */
  /* A shift longer than a working day was never closed properly, so it says
     nothing about hours. Staffed hours are only reported where shifts cover most
     of the period: a partial denominator would make someone's workload look high. */
  const goodShifts = (input.shifts || []).filter((x) => Number(x.hours) > 0 && Number(x.hours) <= 16);
  const shiftCover = rate(new Set(goodShifts.map((x) => x.day)).size, operating.length);
  const shiftsByStaff = groupBy(shiftCover >= 80 ? goodShifts : [], (x) => x.staff_id);
  const staff = [...groupBy(rows.filter((r) => r.served_by), (r) => r.served_by)].map(([id, xs]) => {
    const person = staffName.get(id) || {};
    const served = xs.filter((r) => r.status === 'served');
    const shifts = shiftsByStaff.get(id) || [];
    const seats = seats_.filter((a) => a.staff_id === id);
    const staffedHours = shifts.length ? round(shifts.reduce((t, x) => t + Number(x.hours || 0), 0)) : null;
    const counterHours = served.reduce((t, r) => t + (minutes(r.service_min) || 0), 0) / 60;
    return {
      id, name: person.full_name || 'Unknown', role: person.role || null, ...s(xs),
      activeDays: new Set(xs.map((r) => r.day)).size,
      mix: dist(xs, (r) => r.service_id, Object.fromEntries(serviceName)),
      counters: dist(xs.filter((r) => r.counter_id), (r) => r.counter_id, Object.fromEntries([...counterInfo].map(([k, v]) => [k, v.label]))),
      seatedDays: new Set(seats.map((a) => a.day)).size,
      staffedHours, counterHours: round(counterHours),
      perStaffedHour: staffedHours ? round(served.length / staffedHours) : null,
      weeks: [...groupBy(xs, (r) => weekOf(r.day))].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([from, w]) => ({ from, ...s(w) })),
      reasons: reasons(xs),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
  /* Who to compare with: others whose main service is the same. */
  for (const p of staff) {
    const main = p.mix[0]?.key;
    const peers = staff.filter((x) => x.id !== p.id && x.mix[0]?.key === main);
    p.mainService = main ? serviceName.get(main) || main : null;
    p.peerCount = peers.length;
    p.peerCounterMedian = round(percentile(peers.map((x) => x.counterMedian).filter((x) => x !== null), 50));
  }

  /* ── counters ─────────────────────────────────────────── */
  const counters = (input.counters || []).map((c) => {
    const xs = rows.filter((r) => r.counter_id === c.id);
    const seats = seats_.filter((a) => a.counter_id === c.id);
    /* Open time is the union of sittings on each day: when one person leaves and
       another picks the counter up, it never closed. */
    const openMinutes = [...groupBy(sittings.filter((x) => x.counter_id === c.id), (x) => x.day).values()].reduce((total, day) => {
      const spans = day.map((x) => [Number(x.from_min), Number(x.to_min)]).sort((a, b) => a[0] - b[0]);
      let end = -1;
      return total + spans.reduce((t, [from, to]) => {
        if (to <= end) return t;
        const added = to - Math.max(from, end);
        end = to;
        return t + added;
      }, 0);
    }, 0);
    return {
      id: c.id, label: c.label, service: serviceName.get(c.service_id) || null, active: Boolean(c.is_active),
      openHours: sittings.some((x) => x.counter_id === c.id) ? round(openMinutes / 60) : null,
      seatedDays: new Set(seats.map((a) => a.day)).size, officers: new Set(seats.map((a) => a.staff_id)).size,
      daysUsed: new Set(xs.map((r) => r.day)).size, served: xs.filter((r) => r.status === 'served').length,
    };
  });
  /* A day people joined a service that no seated counter was recorded for. */
  const uncovered = [];
  if (seats_.length) {
    for (const d of operating) {
      const seated = new Set((seatsByDay.get(d.day) || []).map((a) => counterInfo.get(a.counter_id)?.service_id));
      for (const svc of d.services) if (!seated.has(svc.id)) uncovered.push({ day: d.day, service: svc.name, arrivals: svc.arrivals });
    }
  }

  /* ── journeys ─────────────────────────────────────────── */
  const channels = dist(rows, (r) => r.channel || 'unknown').map((c) => {
    const x = s(rows.filter((r) => (r.channel || 'unknown') === c.key));
    return { ...c, sharePct: rate(c.count, rows.length), completionPct: x.completionPct, waitAvg: x.waitAvg, noShowPct: x.noShowPct, leftPct: x.leftPct };
  });
  const REPEAT_WINDOW = 14;
  const byPerson = groupBy(rows.filter((r) => r.user_id), (r) => r.user_id);
  let repeatPeople = 0; let afterIncomplete = 0; let incompleteLinked = 0;
  for (const visits of byPerson.values()) {
    if (visits.length > 1) repeatPeople += 1;
    const sorted = [...visits].sort((a, b) => a.day.localeCompare(b.day));
    sorted.forEach((v, i) => {
      if (outcomeOf(v) !== 'incomplete') return;
      incompleteLinked += 1;
      const limit = addDays(v.day, REPEAT_WINDOW);
      if (sorted.slice(i + 1).some((n) => n.service_id === v.service_id && n.day <= limit)) afterIncomplete += 1;
    });
  }

  /* ── targets ──────────────────────────────────────────── */
  const end = period.to;
  const summary = s(rows);
  const prev = s(prevRows);
  /* Each visit is measured against the rate target in force on its day, by
     weighting each day's target by that day's visits. */
  const weightedTarget = (t) => {
    const usable = rows.map((r) => t.at(r.day)).filter((v) => v !== null);
    return usable.length ? round(mean(usable)) : null;
  };
  const targets = [
    { key: 'wait', label: 'Average wait', unit: 'min', better: 'lower', definition: 'Minutes from joining the line to being called, for visits that were called.', applicable: waitT.at(end), company: waitT.companyAt(end), branch: waitT.branchAt(end), inForce: weightedTarget(waitT), actual: summary.waitAvg, previous: prev.waitAvg, eligible: summary.waitN },
    { key: 'completion', label: 'Completed visits', unit: '%', better: 'higher', definition: 'Share of arrivals served with nothing left unfinished.', applicable: completionT.at(end), company: completionT.companyAt(end), branch: completionT.branchAt(end), inForce: weightedTarget(completionT), actual: summary.completionPct, previous: prev.completionPct, eligible: summary.arrivals },
    { key: 'noshow', label: 'No-show rate', unit: '%', better: 'lower', definition: 'Share of arrivals called who did not come forward.', applicable: noShowT.at(end), company: noShowT.companyAt(end), branch: noShowT.branchAt(end), inForce: weightedTarget(noShowT), actual: summary.noShowPct, previous: prev.noShowPct, eligible: summary.arrivals },
  ].map((t) => ({
    ...t,
    gap: t.actual === null || t.inForce === null ? null : round(t.actual - t.inForce),
    met: t.actual === null || t.inForce === null ? null : t.better === 'lower' ? t.actual <= t.inForce : t.actual >= t.inForce,
  }));

  /* ── sessions and appointments ────────────────────────── */
  const sessions = input.sessions || [];
  const appts = input.appointments || [];
  const liveAppts = appts.filter((a) => a.status !== 'cancelled' && a.status !== 'rescheduled');
  const attended = appts.filter((a) => a.checked_in_at);
  const lateMin = (a) => minutes(a.late_min);
  const apptTickets = rows.filter((r) => r.is_appointment);
  const apptServices = new Set(apptTickets.map((r) => r.service_id));
  const walkInSame = rows.filter((r) => !r.is_appointment && apptServices.has(r.service_id));
  const appointments = {
    scheduled: appts.length, attended: attended.length,
    /* A move counts once, as a move: the replacement is its own appointment. */
    rescheduled: appts.filter((a) => Number(a.moved) === 1).length,
    cancelled: appts.length - liveAppts.length - appts.filter((a) => Number(a.moved) === 1).length,
    notAttended: liveAppts.filter((a) => !a.checked_in_at).length,
    attendancePct: rate(attended.length, liveAppts.length),
    late: attended.filter((a) => lateMin(a) !== null && lateMin(a) > Number(a.late_allowed ?? 10)).length,
    early: attended.filter((a) => lateMin(a) !== null && lateMin(a) < 0).length,
    honoured: apptTickets.length, ticket: s(apptTickets), walkIns: s(walkInSame),
  };

  /* ── cases ────────────────────────────────────────────── */
  const flags = input.flags || [];
  const atStart = flags.filter((f) => f.created_day < period.from && (!f.cleared_day || f.cleared_day >= period.from));
  const opened = flags.filter((f) => f.created_day >= period.from && f.created_day <= period.to);
  const cleared = flags.filter((f) => f.cleared_day && f.cleared_day >= period.from && f.cleared_day <= period.to);
  const closing = flags.filter((f) => f.created_day <= period.to && (!f.cleared_day || f.cleared_day > period.to));
  const unresolvedByPerson = [...byPerson.values()].filter((v) => v.filter((r) => outcomeOf(r) !== 'completed').length >= 3).length;
  const cases = {
    opening: atStart.length, opened: opened.length, cleared: cleared.length, closing: closing.length,
    clearedFromPeriod: cleared.filter((f) => f.created_day >= period.from).length,
    clearedOlder: cleared.filter((f) => f.created_day < period.from).length,
    byFlag: dist(closing, (f) => f.flag),
    ages: closing.map((f) => f.age_days).filter((x) => x !== null && x !== undefined),
    medianAge: round(percentile(closing.map((f) => Number(f.age_days)), 50)),
    resolutionMedian: round(percentile(cleared.map((f) => Number(f.resolve_days)).filter((x) => !Number.isNaN(x)), 50)),
    repeatUnresolvedPeople: unresolvedByPerson,
  };

  /* ── exceptions: what the records show, never why ─────── */
  const waitsByDay = operating.map((d) => d.waitAvg).filter((x) => x !== null);
  const typicalWait = percentile(waitsByDay, 50);
  const spread = stdev(waitsByDay);
  const arrivalsByDow = (dow) => percentile(operating.filter((d) => d.dow === dow).map((d) => d.arrivals), 50);
  const exceptions = [];
  for (const c of input.closures || []) {
    exceptions.push({
      day: c.starts_on, type: c.kind === 'outage' ? 'Recorded outage' : 'Recorded closure', confirmed: true,
      detail: `${c.reason}. ${c.starts_on === c.ends_on ? 'One day' : `Through ${c.ends_on}`}${c.branch_id ? '' : ', all branches'}. Recorded by ${c.created_by_name || 'staff'}${c.lifted_on ? `; lifted on ${c.lifted_on}` : ''}.`,
    });
  }
  for (const x of sessions) {
    if (x.end_reason) exceptions.push({ day: x.day, type: 'Session ended early', confirmed: true, detail: `${x.name}: ${x.end_reason}. Ended by ${x.ended_by_name || 'staff'} ${x.ended_early_min} minutes before its planned end.` });
  }
  for (const d of days) {
    if (d.kind === 'zero') exceptions.push({ day: d.day, type: 'No activity on an operating day', detail: 'No visits are recorded. The branch may have been closed, or the records may be missing; nothing recorded says which.' });
    if (d.closedByBranch) exceptions.push({ day: d.day, type: 'Visits ended by closing time', detail: `${d.closedByBranch} visits were still open when the branch closed and were closed automatically.` });
    if (d.waitAvg !== null && spread && d.waitAvg > typicalWait + 2 * spread) exceptions.push({ day: d.day, type: 'Unusually long waits', detail: `Average wait ${d.waitAvg} min against a typical ${round(typicalWait)} min, on ${d.arrivals} arrivals.` });
    const usual = d.kind === 'operating' ? arrivalsByDow(d.dow) : null;
    if (usual && d.arrivals > usual * 1.5 && operatingByDow.get(d.dow) >= 3) exceptions.push({ day: d.day, type: 'Unusually high demand', detail: `${d.arrivals} arrivals against a typical ${round(usual, 0)} for that weekday.` });
  }

  /* ── forecast: a labelled scenario from the visits observed ── */
  const history = [...rows, ...prevRows];
  const historyDays = new Set(history.map((r) => r.day)).size;
  const openMinutes = Math.max(60, Number(branch.open_minutes) || 450);
  const forecast = {
    historyDays, sufficient: historyDays >= 28,
    days: [],
    services: [],
  };
  if (forecast.sufficient) {
    for (let i = 1; forecast.days.length < 7 && i < 15; i += 1) {
      const day = addDays(period.to, i);
      if (!openDays.includes(dowOf(day))) continue;
      const same = [...new Set(history.filter((r) => dowOf(r.day) === dowOf(day)).map((r) => r.day))];
      const totals = same.map((sd) => history.filter((r) => r.day === sd).length);
      const m = mean(totals); const sd = stdev(totals) || 0;
      forecast.days.push({ day, dow: dowOf(day), observations: totals.length, expected: round(m, 0), low: round(Math.max(0, m - sd), 0), high: round(m + sd, 0), holiday: holidays.get(day) || null });
    }
    forecast.services = services.map((svc) => {
      const perDay = svc.arrivals / Math.max(1, operating.length);
      const workloadHours = (perDay * (svc.counterAvg || 0)) / 60;
      return {
        name: svc.name, perDay: round(perDay), counterAvg: svc.counterAvg, workloadHours: round(workloadHours),
        /* Workload alone, at 85% occupancy. It estimates capacity, not waits. */
        countersNeeded: svc.counterAvg ? Math.max(1, Math.ceil(workloadHours / ((openMinutes / 60) * 0.85))) : null,
        countersAvailable: svc.counters,
      };
    });
  }

  /* ── how far the records can be trusted ───────────────── */
  const servedRows = rows.filter((r) => r.status === 'served');
  const pctOf = (test, xs) => rate(xs.filter(test).length, xs.length);
  const level = (p) => (p === null ? 'Unavailable' : p >= 99 ? 'Complete' : p >= 50 ? 'Partial' : p > 0 ? 'Partial' : 'Unavailable');
  const seatDays = new Set(seats_.map((a) => a.day).filter((d) => operating.some((o) => o.day === d))).size;
  const coverage = [
    { record: 'Visit outcomes', pct: rows.length ? 100 : null, note: 'One outcome for every visit.' },
    { record: 'Time joined and called', pct: pctOf((r) => minutes(r.wait_min) !== null, rows.filter(reachedCounter)), note: 'Visits that reached a counter.' },
    { record: 'Time at the counter', pct: pctOf((r) => minutes(r.service_min) !== null, servedRows), note: 'Served visits.' },
    { record: 'Staff who served', pct: pctOf((r) => r.served_by, servedRows), note: 'Served visits.' },
    { record: 'Identifiable customers', pct: summary.identifiedPct, note: 'Only visits with an account can be linked. Walk-ins cannot be recognised across visits.' },
    { record: 'Counter seating', pct: rate(seatDays, operating.length), note: 'Operating days with a record of who sat where.' },
    { record: 'Staffed hours (clock in and out)', pct: shiftCover, note: 'Operating days with usable shift records. Staffed hours are reported only above 80%.' },
  ].map((c) => ({ ...c, level: level(c.pct) }));

  return {
    period, previous, branch: { ...branch, openDays },
    summary, previousSummary: prev,
    days, closures: input.closures || [], operatingDays: operating.length, closedDays: days.filter((d) => ['closed', 'holiday', 'closure'].includes(d.kind)).length,
    zeroDays: days.filter((d) => d.kind === 'zero').length,
    weeks, segments, hourly, weekdays, heat, hours,
    payday: cycle(isPayday), monthEnd: cycle(isMonthEnd),
    services, staff, counters, uncovered,
    channels, reasons: reasons(rows),
    repeats: { windowDays: REPEAT_WINDOW, people: byPerson.size, repeatPeople, afterIncomplete, incompleteLinked },
    targets, targetHistory: input.targetChanges || [],
    sessions, appointments, cases, exceptions, forecast, coverage,
    ratings: input.ratings || null,
  };
}

module.exports = { buildBranchReport, summarise, percentile, outcomeOf, targetTimeline, applicableTarget, eachDay };

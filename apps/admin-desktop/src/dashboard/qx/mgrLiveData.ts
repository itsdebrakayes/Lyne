/**
 * Maps the live useDashboardData() layer onto the shape the Manager tabs read.
 *
 * Same contract as execLiveData: the tab components are the approved designs,
 * unchanged, and only the data source moves. Where the live layer genuinely
 * cannot supply something, this returns an empty list so the tab shows its own
 * empty state rather than presenting an invented number as real.
 *
 * Column names below are the ones the API actually returns — checked against
 * apps/backend/src/routes/analytics.js, not assumed.
 */
import type { MgrTabData, MgrStaff, MgrSvc, MgrTargetRow } from './MgrTabsQX';
import { num, titleCase } from '../insights';

/** "8:04 AM" from a timestamp, or a dash when there is genuinely nothing. */
const onSinceLabel = (signedIn?: unknown, firstActivity?: unknown) => {
  const raw = signedIn || firstActivity;
  if (!raw) return '—';
  const t = new Date(String(raw));
  return Number.isFinite(t.getTime())
    ? t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '—';
};

const CODE = (name?: string) => (titleCase(name) || '')
  .split(/\s+/).map((w) => w[0] || '').join('').slice(0, 3).toUpperCase() || 'SVC';

export type MgrLiveInput = {
  /** e.g. "Aug 2 – August 31, 2026". Absent means the screen is showing today. */
  periodLabel?: string;
  branchName: string; org: string; managerName: string;
  /** live queue rows for today, one per service */
  queues: any[];
  /** /analytics/services — total_visits, avg_wait_minutes, avg_service_minutes */
  services: any[];
  /** /analytics/staff — full_name, tickets_handled, avg_handle_minutes */
  staff: any[];
  /** productivity insight: { slowdowns: [], idle: [] } */
  productivity: any;
  /** /analytics/counters — the desks, and who staff_assignments seats at each */
  counters: any[];
  /** demand by hour for this branch */
  demandHourly: any[];
  demandWeekly: any[];
  /** the branch's own target when set, else the company one */
  target: any;
  companyTarget: any;
  branchTarget: any;
  /** week-scoped totals for this branch */
  avgWait: number; completionPct: number; noShowPct: number; avgService: number;
  openFrom: string; openTo: string;
  faq: Array<{ q: string; a: string }>;
  /* ── overview ── */
  servedToday: number;
  /** today's arrivals by hour, and the same hours yesterday */
  todayByHour: number[];
  yesterdayByHour: number[];
  /** balking insight — how many gave up before being called */
  balking: any;
  /** today's own funnel counts, from today's analytics summary row */
  todayJoined: number; todayCompleted: number; todayNoShows: number; todayLeft: number;
};

export function buildMgrData(i: MgrLiveInput): MgrTabData {
  /* ── the floor, built FROM the live queues ──
     The lines open on the floor today are the lines the manager can act on, so
     the live queue feed is the spine here and history only decorates it.

     It used to be the other way round: the row set came from /analytics/services
     over a week window, and live queues were folded in afterwards for the depth.
     That let a HISTORICAL query decide which lines appear on a NOW screen — so a
     branch with 44 people standing in seven lines rendered one row, because six
     of those services had no rows in wait_time_records for the week. A new
     branch, a new service, or the first morning of a pilot hit the same hole,
     which is exactly when somebody is watching. */
  const history = new Map<string, any>();
  for (const s of i.services) {
    const key = String(s.service_id || s.service_name || '');
    if (key) history.set(key, s);
  }

  const targetWait = num(i.target?.target_wait_minutes) || 20;

  const byService = new Map<string, MgrSvc>();
  for (const q of i.queues) {
    const key = String(q.service_id || q.service_name || '');
    if (!key) continue;
    const name = titleCase(q.service_name) || 'Service';
    // The customer-facing projection, straight from the API. Deliberately NOT
    // the historical average: the manager has to defend this number to somebody
    // standing at the counter holding a phone that shows it.
    const wait = Math.round(num(q.projected_wait_minutes));
    const cur = byService.get(key) || {
      id: key, code: CODE(q.service_name), name,
      waiting: 0, wait: 0, counters: 0, open: 0, longest: 0,
      state: 'open' as MgrSvc['state'],
    };
    cur.waiting += num(q.waiting_count ?? q.waiting);
    cur.longest = Math.max(cur.longest, Math.round(num(q.longest_wait_minutes)));
    cur.counters += num(q.counters_total);
    cur.open += num(q.counters_open);
    // A branch normally has one queue per service; if it ever runs more, the
    // worst projection is the one that needs attention.
    cur.wait = Math.max(cur.wait, wait);
    byService.set(key, cur);
  }

  const services: MgrSvc[] = [...byService.values()]
    .map((s) => ({
      ...s,
      // History enriches where it exists, but never decides whether the row is here.
      code: CODE(titleCase(history.get(s.id)?.service_name) || s.name),
      state: (s.wait > targetWait ? 'busy' : 'open') as MgrSvc['state'],
    }))
    .sort((a, b) => b.waiting - a.waiting);

  /* ── the floor ──
     A staff row on its own says who worked and how many they saw. The state
     (idle / running slow) comes from the productivity insight, which is the
     only thing that knows a counter has stalled while people wait. */
  const slow = new Map<string, string>();
  const idle = new Map<string, string>();
  for (const r of (Array.isArray(i.productivity?.slowdowns) ? i.productivity.slowdowns : [])) {
    if (r.staff_name) slow.set(String(r.staff_name), String(r.message || ''));
  }
  for (const r of (Array.isArray(i.productivity?.idle) ? i.productivity.idle : [])) {
    if (r.staff_name) idle.set(String(r.staff_name), String(r.message || ''));
  }

  /* Who is actually ON a desk, from the counters feed (staff_assignments).
     This is the SAME source the supervisor board reads, deliberately: the two
     roles were deriving "serving" differently and contradicting each other on
     the same eight people. */
  const onDesk = new Map<string, { counter: string; svc: string }>();
  for (const c of (Array.isArray(i.counters) ? i.counters : [])) {
    const seat = { counter: String(c.counter_label || '—'), svc: titleCase(c.service_name) || '—' };
    if (c.staff_id) onDesk.set(String(c.staff_id), seat);
    if (c.staff_name) onDesk.set(String(c.staff_name), seat);
  }

  const staff: MgrStaff[] = i.staff.map((s) => {
    const name = titleCase(s.full_name) || '—';
    const seen = Math.round(num(s.tickets_handled));
    const desk = onDesk.get(String(s.staff_id)) || onDesk.get(String(s.full_name)) || null;
    /* "Serving" means AT A DESK right now — not "handled a ticket at some point
       today", which is what tickets_handled says. The old reading marked the
       whole branch as Serving on one tab while the productivity feed called the
       same people Idle on another. */
    const state: MgrStaff['state'] = idle.has(s.full_name) ? 'idle'
      : slow.has(s.full_name) ? 'slow'
      : desk ? 'serving'
      : seen > 0 ? 'break'
      : 'off';
    return {
      id: String(s.staff_id || s.full_name),
      name,
      // Real desk and service from the counters feed; '—' only when genuinely
      // unassigned, which now MEANS something rather than being unavoidable.
      counter: desk?.counter || '—',
      svc: desk?.svc || '—',
      seen,
      avg: Math.round(num(s.avg_handle_minutes)),
      since: onSinceLabel(s.signed_in_at, s.first_activity_at),
      state,
      note: idle.get(s.full_name) || slow.get(s.full_name),
    };
  });

  /* ── demand grids ── */
  const hourLabel = (h: number) => {
    const hr = ((h + 11) % 12) + 1;
    return `${hr}${h < 12 ? 'am' : 'pm'}`;
  };
  const hourSet = [...new Set(i.demandHourly.map((c) => num(c.bucket)))].sort((a, b) => a - b);
  const hours = hourSet.map(hourLabel);
  const rowNames = [...new Set(i.demandHourly.map((c) => String(c.row_name || '')))].filter(Boolean);
  const svcHeat = rowNames.map((rn) => hourSet.map((h) => {
    const cell = i.demandHourly.find((c) => String(c.row_name) === rn && num(c.bucket) === h);
    return Math.round(num(cell?.visit_count));
  }));

  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dow = {
    labels: DOW,
    values: DOW.map((_, idx) => {
      const cell = i.demandWeekly.find((c) => num(c.bucket) === idx + 1);
      return Math.round(num(cell?.visit_count));
    }),
  };

  /* ── targets: show the company number and the branch override separately ── */
  const co = (k: string, fallback: number) => num(i.companyTarget?.[k]) || fallback;
  const br = (k: string) => (i.branchTarget && i.branchTarget[k] != null ? num(i.branchTarget[k]) : null);
  const targets: MgrTargetRow[] = [
    { key: 'wait', label: 'Average Wait', unit: 'min', now: i.avgWait, company: co('target_wait_minutes', 20), branch: br('target_wait_minutes'), goodWhen: 'down', help: 'What people served today actually waited, from joining the line to being called. The floor board shows the forecast for someone joining now; this is the experience that happened.' },
    { key: 'done', label: 'Completed Visits', unit: '%', now: i.completionPct, company: co('target_completion_rate', 85), branch: br('target_completion_rate'), goodWhen: 'up', help: 'Share of people who join and are served.' },
    { key: 'noshow', label: 'No-Show Rate', unit: '%', now: i.noShowPct, company: co('target_no_show_rate', 10), branch: br('target_no_show_rate'), goodWhen: 'down', help: 'People who take a ticket and never answer.' },
    { key: 'svc', label: 'Time At The Counter', unit: 'min', now: i.avgService, company: co('target_service_minutes', 20), branch: br('target_service_minutes'), goodWhen: 'down', help: 'How long a visit takes once called.' },
  ];

  return {
    branchName: titleCase(i.branchName) || 'Your Branch',
    org: i.org,
    managerName: titleCase(i.managerName) || '—',
    staff, services, hours, svcHeat, dow, targets,
    faq: i.faq,
    servedToday: i.servedToday,
    /* Forwarded so the stat labels can name the window they are summing. */
    periodLabel: i.periodLabel,
    todayByHour: i.todayByHour,
    yesterdayByHour: i.yesterdayByHour,
    /* The card is captioned "Today", so every COUNT in it is today's, straight
       off today's summary row. `left` used to come from /analytics/balking,
       which is a hardcoded 90-day window — so a card headed Today reported two
       people who gave up back in July, and the manager could not reconcile it
       with anything else on the screen.

       avg_renege_minutes stays 90-day because there is no per-day equivalent,
       and a single day rarely has enough abandonments to average honestly. It is
       labelled as a typical figure rather than presented as today's. */
    funnel: (() => {
      const left = Math.round(num(i.todayLeft));
      const served = i.todayCompleted;
      const noShow = i.todayNoShows;
      /* "Called forward" is everyone who reached the front — served plus the
         no-shows who were called and did not answer. It used to be
         `joined - left`, which is a different quantity entirely and produced an
         impossible funnel: 297 served out of 294 called.

         `joined` is guarded to at least the sum of its own outcomes. Today's
         summary row is regenerated while the day is still running, so its
         total_visitors can momentarily trail the outcomes counted beneath it —
         and a funnel whose first stage is smaller than its last reads as broken
         even when every individual number is right. */
      const called = served + noShow;
      const joined = Math.max(num(i.todayJoined), called + left);
      return {
        joined,
        called,
        served,
        left,
        typicalLeaveMin: i.balking?.avg_renege_minutes != null
          ? Math.round(num(i.balking.avg_renege_minutes)) : null,
      };
    })(),
    openFrom: i.openFrom, openTo: i.openTo,
    generatedOn: new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

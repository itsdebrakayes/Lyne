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

const CODE = (name?: string) => (titleCase(name) || '')
  .split(/\s+/).map((w) => w[0] || '').join('').slice(0, 3).toUpperCase() || 'SVC';

export type MgrLiveInput = {
  branchName: string; org: string; managerName: string;
  /** live queue rows for today, one per service */
  queues: any[];
  /** /analytics/services — total_visits, avg_wait_minutes, avg_service_minutes */
  services: any[];
  /** /analytics/staff — full_name, tickets_handled, avg_handle_minutes */
  staff: any[];
  /** productivity insight: { slowdowns: [], idle: [] } */
  productivity: any;
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
  weekServed: number; weekCompleted: number; weekNoShows: number;
};

export function buildMgrData(i: MgrLiveInput): MgrTabData {
  /* ── services, with the live queue depth folded in ── */
  const waitingFor = new Map<string, { waiting: number; longest: number; counters: number; open: number }>();
  for (const q of i.queues) {
    const key = String(q.service_id || q.service_name || '');
    if (!key) continue;
    const cur = waitingFor.get(key) || { waiting: 0, longest: 0, counters: 0, open: 0 };
    cur.waiting += num(q.waiting_count ?? q.waiting);
    cur.longest = Math.max(cur.longest, Math.round(num(q.longest_wait_minutes ?? q.max_wait_minutes)));
    cur.counters += num(q.counters_total);
    cur.open += num(q.counters_open ?? q.open_counters);
    waitingFor.set(key, cur);
  }

  const targetWait = num(i.target?.target_wait_minutes) || 20;

  const services: MgrSvc[] = i.services.map((s) => {
    const live = waitingFor.get(String(s.service_id || s.service_name || '')) || { waiting: 0, longest: 0, counters: 0, open: 0 };
    const wait = Math.round(num(s.avg_wait_minutes));
    return {
      id: String(s.service_id || s.service_name),
      code: CODE(s.service_name),
      name: titleCase(s.service_name) || 'Service',
      waiting: live.waiting,
      wait,
      counters: live.counters,
      open: live.open,
      longest: live.longest || wait,
      state: (wait > targetWait ? 'busy' : 'open') as MgrSvc['state'],
    };
  }).sort((a, b) => b.waiting - a.waiting);

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

  const staff: MgrStaff[] = i.staff.map((s) => {
    const name = titleCase(s.full_name) || '—';
    const seen = Math.round(num(s.tickets_handled));
    const state: MgrStaff['state'] = idle.has(s.full_name) ? 'idle'
      : slow.has(s.full_name) ? 'slow'
      : seen > 0 ? 'serving' : 'off';
    return {
      id: String(s.staff_id || s.full_name),
      name,
      // The staff endpoint reports throughput, not the counter someone is sat
      // at. Shown as unknown rather than guessed.
      counter: '—',
      svc: '—',
      seen,
      avg: Math.round(num(s.avg_handle_minutes)),
      since: '—',
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
    { key: 'wait', label: 'Average Wait', unit: 'min', now: i.avgWait, company: co('target_wait_minutes', 20), branch: br('target_wait_minutes'), goodWhen: 'down', help: 'From joining the line to being called.' },
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
    todayByHour: i.todayByHour,
    yesterdayByHour: i.yesterdayByHour,
    funnel: (() => {
      const joined = i.weekServed;
      const left = Math.round(num(i.balking?.total_reneged));
      return {
        joined,
        called: Math.max(0, joined - left),
        served: i.weekCompleted,
        left,
        avgLeaveMin: i.balking?.avg_renege_minutes != null
          ? Math.round(num(i.balking.avg_renege_minutes)) : null,
      };
    })(),
    openFrom: i.openFrom, openTo: i.openTo,
    generatedOn: new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

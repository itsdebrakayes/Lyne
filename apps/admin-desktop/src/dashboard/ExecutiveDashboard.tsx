/**
 * ExecutiveDashboard — company-wide surface in the redesigned kit.
 * Reuses the shared useDashboardData() layer and the same sub-cards as the
 * Manager dashboard, rendered business-wide.
 */
import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Building2, UserCheck, Waypoints, Grid3x3, Target, FileText, Settings, Headphones, TrendingUp } from 'lucide-react';
import { useAdminAuth } from '../hooks/useAdminAuth';
import Spotlight, { TOURS } from '../components/Spotlight';
import { useTour } from '../hooks/useTour';
import { useDashboardData } from '../hooks/useDashboardData';
import { type NavItem } from './kit';
import { Shell as QxShell, Head as QxHead, Pills as QxPills, RefreshIcon as QxRefresh, greetingFor } from '@/design/ui';
import { ExecutiveOverviewQX } from './qx/ExecutiveOverviewQX';
import { ExecDataProvider, execTab, EXEC_TAB_HEAD } from './qx/ExecTabsQX';
import { buildExecData } from './qx/execLiveData';

/* Kept verbatim from the Help & Support tab this replaced — these answers were
   written against how the system actually behaves and should not be re-guessed. */
const EXEC_FAQ = [
  { q: 'How Do I Set Company Targets?',
    a: 'Open Targets and set your average wait in minutes, the share of visits you expect to be completed, and the no-show rate you will tolerate, then save. Every branch, manager and supervisor screen is measured against those numbers straight away.' },
  { q: 'What Does The Branch Health Score Mean?',
    a: 'It is a single score out of 100 blending how the branch’s wait time compares to your target, how many visits it completes, how well it controls no-shows, and its staffing discipline. Roughly: 80+ is good, 60–79 is fair, under 60 needs attention. Open a manager to see which of the four is dragging the score down.' },
  { q: 'How Do I Support An Underperforming Branch?',
    a: 'Start with Do This Next on the Overview — it ranks issues by how much they cost you against your targets. Then open Managers for that branch’s score breakdown, and Busy Times to see which hours it is under pressure. The usual fix is moving cover to the peak hours shown there.' },
  { q: 'Where Do These Numbers Come From?',
    a: 'Every figure is counted from real tickets — someone joined a line, was called, and was either served or did not answer. Nothing is estimated except items explicitly labelled as a forecast, which come from the prediction models.' },
  { q: 'Why Does A Branch Show Fewer People Than I Counted?',
    a: 'The system only knows about people who joined a line, through the QMe app or a branch kiosk. Someone who walked up to a counter without taking a ticket was never in the queue, so they are not in the count.' },
  { q: 'How Often Do The Numbers Update?',
    a: 'They recalculate automatically in the background on a schedule, and the timestamp beside Update always tells you how fresh they are. If you need them recalculated immediately — before a meeting, say — press Update.' },
];
import { CalendarDays, MapPin } from 'lucide-react';
import { num, fmtN, titleCase, managerScores, dailyRollup, clockLabel, deriveOpsAlerts } from './insights';
import { Empty } from './ManagerDashboard';

const NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'trends', label: 'Trends', icon: TrendingUp },
  { key: 'branches', label: 'Branches', icon: Building2 },
  { key: 'managers', label: 'Managers', icon: UserCheck },
  { key: 'services', label: 'Services', icon: Waypoints },
  { key: 'busy', label: 'Busy Times', icon: Grid3x3 },
  { key: 'targets', label: 'Targets', icon: Target },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'utility' },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'utility' },
];

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function branchHeatmap(trends: any[]) {
  const byBranch = new Map<string, Map<number, number>>();
  trends.forEach((t) => {
    const name = t.branch_name || 'Branch';
    const dow = new Date(String(t.visit_date)).getDay();
    if (!byBranch.has(name)) byBranch.set(name, new Map());
    const m = byBranch.get(name)!;
    m.set(dow, (m.get(dow) || 0) + num(t.total_visits));
  });
  const max = Math.max(1, ...[...byBranch.values()].flatMap((m) => [...m.values()]));
  const order = [1, 2, 3, 4, 5, 6, 0];
  const lvl = (v: number) => (v <= 0 ? 0 : v / max > 0.66 ? 3 : v / max > 0.33 ? 2 : 1);
  const rows = [...byBranch.entries()].map(([label, m]) => ({ label: titleCase(label), levels: order.map((d) => lvl(m.get(d) || 0)) }));
  return { cols: order.length, colLabels: order.map((d) => DOW[d]), rows };
}

export default function ExecutiveDashboard() {
  const d = useDashboardData();
  const { logout } = useAdminAuth();
  const tour = useTour('executive');
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('7');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const org = d.admin?.staffRecord.business_name || 'Your Business';
  const preds = d.predictions as any[];
  const alerts = useMemo(() => deriveOpsAlerts(preds, d.productivity), [preds, d.productivity]);

  const summary = useMemo(() => dailyRollup(d.summary), [d.summary]);
  // The period pills drive the reporting window for real — every headline number
  // below recomputes from it, so the control is never decorative.
  const windowDays = period === 'today' ? 1 : Number(period) || 7;
  const week = summary.slice(-windowDays);
  const rangeLabel = week.length
    ? (week.length === 1
      ? new Date(week[0].summary_date).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
      : `${new Date(week[0].summary_date).toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${new Date(week[week.length - 1].summary_date).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}`)
    : 'No data yet';
  const served = week.reduce((t, s) => t + num(s.total_visitors), 0);
  const completed = week.reduce((t, s) => t + num(s.completed_count), 0);
  const noShows = week.reduce((t, s) => t + num(s.no_show_count), 0);
  const avgWait = Math.round(week.reduce((t, s) => t + num(s.avg_wait_time_minutes), 0) / Math.max(1, week.length));
  const last = summary[summary.length - 1] || {};
  const target = d.targets;
  const managers = managerScores(preds).sort((a, b) => num(b.manager_score) - num(a.manager_score));
  const branchCount = new Set(d.branchTrends.map((t: any) => t.branch_id)).size || managers.length;
  const top = managers[0];
  const worst = managers[managers.length - 1];
  const heat = branchHeatmap(d.branchTrends);

  // ── Week-scoped totals per branch and per service ──────────────────────────
  // Every screen must reconcile to the SAME 7 days as the Overview hero numbers.
  // Previously these tables showed the ML pipeline's much longer window, which
  // made a single branch look bigger than the whole company for "this week".
  const weekScoped = useMemo(() => {
    const rows = d.summary as any[];
    const dates = [...new Set(rows.map((s) => String(s.summary_date).slice(0, 10)))].sort();
    const keep = new Set(dates.slice(-7));
    const inWeek = rows.filter((s) => keep.has(String(s.summary_date).slice(0, 10)));
    const group = (keyOf: (r: any) => string) => {
      const m = new Map<string, { served: number; done: number; ns: number; waitSum: number; n: number }>();
      for (const r of inWeek) {
        const k = keyOf(r);
        if (!k) continue;
        const cur = m.get(k) || { served: 0, done: 0, ns: 0, waitSum: 0, n: 0 };
        cur.served += num(r.total_visitors); cur.done += num(r.completed_count);
        cur.ns += num(r.no_show_count); cur.waitSum += num(r.avg_wait_time_minutes); cur.n += 1;
        m.set(k, cur);
      }
      return m;
    };
    return { byBranch: group((r) => String(r.branch_id || '')), byService: group((r) => String(r.service_id || '')) };
  }, [d.summary]);
  const zeroWeek = { served: 0, done: 0, ns: 0, waitSum: 0, n: 0 };
  const branchWeek = (id?: string) => weekScoped.byBranch.get(String(id || '')) || zeroWeek;

  // Contextual search — only on tabs that actually have a list to filter.
  const [q, setQ] = useState('');
  useEffect(() => { setQ(''); }, [tab]);
  const SEARCHABLE: Record<string, string> = {
    branches: 'Search branches or managers…',
    managers: 'Search managers or branches…',
    services: 'Search services…',
  };
  const needle = q.trim().toLowerCase();
  const match = (...vals: any[]) => !needle || vals.some((v) => String(v ?? '').toLowerCase().includes(needle));
  const shownManagers = managers.filter((m) => match(m.branch_name, m.manager_name));
  // Services come from the API already scoped to the same 7 days (analytics_summaries
  // has no service dimension, so this is computed from wait_time_records server-side).
  const shownServices = (d.services as any[]).filter((s) => match(s.service_name));

  // ── Trends tab: "at a glance" on Overview, full depth on its own tab ──
  const [showA, setShowA] = useState(true);
  const [showB, setShowB] = useState(true);
  const [range, setRange] = useState('week');
  const [monthOffset, setMonthOffset] = useState(0);
  const RANGES: [string, string][] = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['90', '90 Days']];

  const months = useMemo(() => {
    const set = new Set(summary.map((s: any) => String(s.summary_date).slice(0, 7)));
    return [...set].sort();
  }, [summary]);
  const activeMonth = months[months.length - 1 - monthOffset] || months[months.length - 1] || '';
  const monthName = activeMonth
    ? new Date(`${activeMonth}-01T00:00:00`).toLocaleDateString([], { month: 'long', year: 'numeric' })
    : '—';

  const drill = useMemo(() => {
    if (range === 'day') {
      const byHour = new Map<number, number>();
      (d.demandHourly as any[]).forEach((c) => byHour.set(num(c.bucket), (byHour.get(num(c.bucket)) || 0) + num(c.visit_count)));
      const hours = [...byHour.keys()].sort((a, b) => a - b);
      return {
        values: hours.map((h) => byHour.get(h) || 0), labels: hours.map((h) => clockLabel(h)),
        caption: 'Arrivals by hour of day, totalled across every branch — this is where your day peaks.', unit: 'customers',
      };
    }
    if (range === 'month') {
      const rows = summary.filter((s: any) => String(s.summary_date).slice(0, 7) === activeMonth);
      return {
        values: rows.map((s: any) => num(s.total_visitors)),
        labels: rows.map((s: any) => new Date(s.summary_date).toLocaleDateString([], { day: 'numeric' })),
        caption: `Customers served each day in ${monthName}.`, unit: 'served',
      };
    }
    const rows = summary.slice(-7);
    return {
      values: rows.map((s: any) => num(s.total_visitors)),
      labels: rows.map((s: any) => new Date(s.summary_date).toLocaleDateString([], { weekday: 'short' })),
      caption: 'Customers served each day over the last 7 days.', unit: 'served',
    };
  }, [range, summary, d.demandHourly, activeMonth, monthName]);
  const drillAvg = Math.round(drill.values.reduce((a, b) => a + b, 0) / Math.max(1, drill.values.length));
  const drillPeak = drill.values.length ? drill.values.indexOf(Math.max(...drill.values)) : -1;

  // The 90-day period broken into months, each with its own graph + reading.
  const [trendReport, setTrendReport] = useState(false);
  const reportMonths = useMemo(() => {
    const byMonth = new Map<string, any[]>();
    summary.slice(-90).forEach((s: any) => {
      const k = String(s.summary_date).slice(0, 7);
      if (!byMonth.has(k)) byMonth.set(k, []);
      byMonth.get(k)!.push(s);
    });
    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [summary]);

  // 90 days is deliberately a REPORT, not a graph — 90 points at this traffic
  // is unreadable, so it's summarised week by week instead.
  const ninety = useMemo(() => {
    const rows = summary.slice(-90);
    const sum = (k: string) => rows.reduce((t: number, s: any) => t + num(s[k]), 0);
    const weeks: any[] = [];
    for (let i = 0; i < rows.length; i += 7) {
      const g = rows.slice(i, i + 7);
      if (!g.length) continue;
      weeks.push({
        from: g[0].summary_date, to: g[g.length - 1].summary_date,
        served: g.reduce((t: number, s: any) => t + num(s.total_visitors), 0),
        done: g.reduce((t: number, s: any) => t + num(s.completed_count), 0),
        ns: g.reduce((t: number, s: any) => t + num(s.no_show_count), 0),
        wait: g.reduce((t: number, s: any) => t + num(s.avg_wait_time_minutes), 0) / g.length,
      });
    }
    const best = rows.reduce((b: any, s: any) => (!b || num(s.total_visitors) > num(b.total_visitors) ? s : b), null);
    const quiet = rows.reduce((b: any, s: any) => (!b || num(s.total_visitors) < num(b.total_visitors) ? s : b), null);
    return {
      days: rows.length, served: sum('total_visitors'), done: sum('completed_count'), ns: sum('no_show_count'),
      wait: sum('avg_wait_time_minutes') / Math.max(1, rows.length),
      best, quiet, weeks: weeks.reverse(),
    };
  }, [summary]);

  const titles: Record<string, [string, string]> = {
    overview: ['The Business, In Five Seconds', `${branchCount} Branches, This Week, Against The Company Targets.`],
    trends: ['Trends', 'How The Business Is Moving Over Time — Pick A Period.'],
    branches: ['Branches', 'This Week · Ranked By Performance Score.'],
    managers: ['Managers', 'Where To Focus Your Attention This Week.'],
    services: ['Services', 'Company-Wide, Against The Wait Target.'],
    busy: ['Busy Times', 'Which Branch Is Under The Most Pressure, And When.'],
    targets: ['Company Targets', 'You Set These — Every Branch Works Toward Them.'],
    reports: ['Reports', 'A Preview Of What The Export Will Contain.'],
    settings: ['Settings', 'Company Details Shown To Customers.'],
    support: ['Help & Support', 'Common Questions For Executives.'],
  };

  const isOverview = tab === 'overview';

  /* Everything the ported tabs read, mapped from the live layer once. */
  const liveTabData = useMemo(() => buildExecData({
    summary, rawSummary: d.summary as any[], week, served, completed, noShows, avgWait,
    target, managers, branchTrends: d.branchTrends as any[], branchWeek, services: d.services as any[],
    channels: d.channels, preds, heat, org, adminName: d.admin?.name,
    faq: EXEC_FAQ,
  }), [summary, d.summary, week, served, completed, noShows, avgWait, target, managers,
       d.branchTrends, branchWeek, d.services, d.channels, preds, heat, org, d.admin]);

  return (
    <QxShell
      brand="QMe Now"
      brandSub={org}
      nav={NAV.map((n) => ({ key: n.key, label: n.label, icon: n.icon, group: n.group === 'utility' ? 'Account' : 'Main' }))}
      active={tab}
      onNav={setTab}
      notifications={alerts.length}
      account={{ name: d.admin?.name || 'Executive', role: 'Executive', email: d.admin?.staffRecord.email, onSignOut: logout }}
      search={SEARCHABLE[tab] ? { value: q, onChange: setQ, placeholder: SEARCHABLE[tab] } : undefined}
      context={<><MapPin size={13} /><span>{org}</span><b>· {branchCount} Branches</b></>}
      railCard={
        <div className="qx-railcard">
          <small>Right Now</small>
          <b>{fmtN(managers.reduce((t: number, m: any) => t + num(m.waiting_now), 0))} People Are In Line</b>
          <p>{worst ? `${titleCase(worst.branch_name)} needs the most help right now.` : 'All branches are running to target.'}</p>
          <button type="button" onClick={() => setTab('branches')}>See Which Branches</button>
        </div>
      }
      theme={theme}
      onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      head={
        <QxHead
          title={isOverview ? greetingFor(d.admin?.name) : (EXEC_TAB_HEAD[tab]?.title ?? titles[tab]?.[0] ?? '')}
          sub={isOverview
            ? `Here's how ${org} is running over the last ${windowDays === 1 ? 'day' : `${windowDays} days`}.`
            : (EXEC_TAB_HEAD[tab]?.sub ?? titles[tab]?.[1] ?? '')}
          live="Live"
          right={<>
            <QxPills value={period} onChange={setPeriod}
              options={[['today', 'Today'], ['7', '7 Days'], ['14', '14 Days'], ['30', '30 Days'], ['90', '90 Days']]} />
            <span className="qx-datechip"><CalendarDays size={14} />{rangeLabel}</span>
            <button type="button" className="qx-btn ghost" onClick={() => d.refreshAll()}><QxRefresh size={14} />Update</button>
          </>}
        />
      }
    >
      {isOverview && (
        <ExecutiveOverviewQX
          summary={summary} rawSummary={d.summary as any[]} week={week} served={served} completed={completed} noShows={noShows}
          avgWait={avgWait} target={target} managers={managers} branches={liveTabData.branches} branchWeek={branchWeek}
          branchTrends={d.branchTrends} channels={d.channels} balking={d.balking}
          preds={preds} heat={heat}
          search={q} onSearch={setQ}
          showA={showA} setShowA={setShowA} showB={showB} setShowB={setShowB}
          onNav={setTab} onRefresh={() => d.refreshAll()}
        />
      )}

      {/* Every non-overview tab is the approved design, rendering the SAME
          components as the DEV preview — only the data source differs. */}
      {tour.running ? <Spotlight steps={TOURS.executive} onDone={tour.finish} /> : null}
      {!isOverview && (
        <ExecDataProvider value={liveTabData}>
          {execTab(tab, setTab)}
        </ExecDataProvider>
      )}
    </QxShell>
  );
}


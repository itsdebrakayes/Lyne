/**
 * ManagerDashboard — branch manager surface in the redesigned kit.
 * Reuses the shared useDashboardData() layer (live queues, summary, services,
 * targets, heatmap and every ML insight) and renders it in the qa-* design.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LayoutGrid, Users, Waypoints, Grid3x3, Target, FileText, Settings, Headphones,
  AlertTriangle, TrendingUp, Clock, Info, ChevronDown, Mail, Phone, ClipboardCheck, CalendarClock,
} from 'lucide-react';
import api from '@/lib/apiClient';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useSectorTerms, lower } from '../hooks/useSectorTerms';
import Spotlight, { TOURS } from '../components/Spotlight';
import { useTour } from '../hooks/useTour';
import { useDashboardData, type ChannelMix, type ProductivitySignals } from '../hooks/useDashboardData';
import { Sparkline, Area, Card, Rec, Empty, type NavItem } from './kit';
import { num, fmtN, pct, titleCase, insightData, demandBranches, dailyRollup, clockLabel, timeLabel, deriveOpsAlerts } from './insights';
import { ReportDoc, ReportSection, ReportKpis, ReportTable } from './report';
import { CalendarDays, MapPin } from 'lucide-react';
import { Shell as QxShell, Head as QxHead, Pills as QxPills, RefreshIcon as QxRefresh, Freshness, greetingFor } from '@/design/ui';
import { MgrDataProvider, MgrOverviewQX, mgrTab, MGR_TAB_HEAD } from './qx/MgrTabsQX';
import { buildMgrData } from './qx/mgrLiveData';
import { labelFor, makeWindow, rowsIn, today, windowDaysOf } from './dateWindow';
import { DateWindowChip } from './DateWindowChip';
import { ManagerReadinessWorkspace, type ReadinessService } from '../components/dashboard/ReadinessWorkspace';
import { SessionsWorkspace } from '../components/dashboard/SessionsWorkspace';

/* Kept from the Help & Support tab this replaces — written against how the
   system actually behaves, so not re-guessed. */
const MGR_FAQ = [
  { q: 'How Do I Move Someone To A Busier Window?', a: 'Open Staff & Counters, choose the person, and pick the counter you want them on. The change takes effect on their next call — anyone already at their window is not interrupted.' },
  { q: 'What Does The Idle Flag Actually Mean?', a: 'A counter has called nobody for a sustained stretch while people are waiting for that service. It is not a judgement — a clerk can be legitimately tied up — but it is the first thing to check when a line is not moving.' },
  { q: 'Why Is My Branch Target Different From The Company One?', a: 'An executive can hold a branch to a stricter or looser number than the company target. Where an override is in force, Targets shows both so you know which one you are measured against.' },
  { q: 'Can I Change My Branch Opening Hours?', a: 'Hours are shown here but set centrally, because they also drive what customers see in the Lyne app and when remote joining opens. Contact your executive or Lyne support.' },
  { q: 'Someone Took A Ticket And Left. What Happens?', a: 'If they do not answer when called they are recorded as a no-show and the queue moves on. If they left before being called at all, they are counted as having given up waiting — that figure is on your Overview.' },
];

const NAV: NavItem[] = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'staff', label: 'Staff & Counters', icon: Users },
  { key: 'services', label: 'Services', icon: Waypoints },
  { key: 'readiness', label: 'Readiness', icon: ClipboardCheck },
  { key: 'sessions', label: 'Sessions', icon: CalendarClock },
  { key: 'busy', label: 'Busy Times', icon: Grid3x3 },
  { key: 'targets', label: 'Targets', icon: Target },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'utility' },
  { key: 'support', label: 'Help & Support', icon: Headphones, group: 'utility' },
];

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function buildHeatmap(cells: any[]) {
  const hours = [...new Set(cells.map((c) => num(c.hour)))].sort((a, b) => a - b);
  const max = Math.max(1, ...cells.map((c) => num(c.visit_count)));
  const lvl = (v: number) => (v <= 0 ? 0 : v / max > 0.66 ? 3 : v / max > 0.33 ? 2 : 1);
  const byDow = new Map<number, Map<number, number>>();
  cells.forEach((c) => {
    const d = num(c.dow); if (!byDow.has(d)) byDow.set(d, new Map());
    byDow.get(d)!.set(num(c.hour), num(c.visit_count));
  });
  const rows = [1, 2, 3, 4, 5, 6, 0].filter((d) => byDow.has(d)).map((d) => ({
    label: DOW[d], levels: hours.map((h) => lvl(byDow.get(d)!.get(h) || 0)),
  }));
  return { cols: hours.length, colLabels: hours.map(clockLabel), rows };
}

export default function ManagerDashboard() {
  const terms = useSectorTerms();
  const d = useDashboardData();
  const { logout } = useAdminAuth();
  const tour = useTour('manager');
  const [tab, setTab] = useState('overview');
  const branchName = d.admin?.staffRecord.branch_name || 'Your Branch';
  const preds = d.predictions as any[];

  const summary = useMemo(() => dailyRollup(d.summary), [d.summary]);
  /* `last` stays the most recent day. It is still the right source for the
     things that genuinely mean "right now" — the live counters, who is on
     shift — which must not move when somebody looks back at last week. */
  const last = summary[summary.length - 1] || {};

  // Contextual search — only on tabs with a list to filter.
  const [q, setQ] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  /* The pills were decorative: `period` was written by the control and read by
     nothing, and the chip beside it printed a hardcoded today that never
     changed. Every headline number came from `last` — one single day — so there
     was no period for a period control to select. */
  const [period, setPeriod] = useState('today');
  const [anchor, setAnchor] = useState(today());
  const win = useMemo(() => makeWindow(anchor, windowDaysOf(period)), [anchor, period]);
  const windowRows = useMemo(() => rowsIn(summary, win), [summary, win]);
  const servedSeries = windowRows.map((s) => num(s.completed_count));
  const org = d.admin?.staffRecord.business_name || 'Your Business';
  const todayLabel = new Date().toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  useEffect(() => { setQ(''); }, [tab]);
  const SEARCHABLE: Record<string, string> = {
    staff: 'Search staff by name or code…',
    services: 'Search services…',
  };
  const needle = q.trim().toLowerCase();
  const match = (...vals: any[]) => !needle || vals.some((v) => String(v ?? '').toLowerCase().includes(needle));
  const shownStaff = (d.staff as any[]).filter((s) => match(s.full_name, s.staff_code));
  const shownServices = (d.services as any[]).filter((s) => match(s.service_name));
  const readinessServices = useQuery({
    queryKey: ['readiness-services', d.businessId, d.branchId],
    queryFn: () => api.get<ReadinessService[]>(`/services?business_id=${d.businessId}&branch_id=${d.branchId}`),
    enabled: Boolean(d.businessId && d.branchId),
    refetchInterval: 60_000,
  });
  const waitingNow = d.queues.reduce((t, q: any) => t + num(q.waiting_count), 0);
  /* What people who have already been served ACTUALLY waited today.
     This is the number a branch is held to, so it has to be the experience that
     happened, not a forecast. It used to average estimated_wait_minutes across
     the open queues — the ETA frozen onto each ticket at the moment it was
     issued — which is neither the achieved wait nor the current projection, and
     it was quietly powering both the Overview headline and the Targets tab.
     The forward-looking number now lives on the floor board, where it belongs. */
  /* Aggregated across the selected window rather than read off one day. With
     the default "Today" window these are identical to what they were, so the
     dashboard opens exactly as it did — the difference only appears once
     somebody actually picks a period, which is the point. */
  const sumIn = (k: string) => windowRows.reduce((t, s: any) => t + num(s[k]), 0);
  const achievedWait = windowRows.length
    ? Math.round(windowRows.reduce((t, s: any) => t + num(s.avg_wait_time_minutes), 0) / windowRows.length)
    : 0;
  const completed = sumIn('completed_count');
  const totalToday = sumIn('total_visitors') || completed + sumIn('no_show_count');
  const noShows = sumIn('no_show_count');
  // The manager measures against their OWN branch target (which overlays the
  // company target); it falls back to the company target until they set one.
  const target = d.effectiveTarget;
  // A view that always carries the company target for reference, even before the
  // branch-targets query resolves (so the editor never shows "Company: 0").
  const branchTargetView = d.branchTargets || { ...d.targets, is_default: true, company: d.targets };
  const hasBranchTarget = Boolean(d.branchTargets && d.branchTargets.is_default === false);
  const goalNoun = hasBranchTarget ? 'Your target' : 'Company';

  const myScore = insightData(preds, 'manager_performance');
  const myManager = (Array.isArray(myScore?.managers) ? myScore.managers : []).find((m: any) => m.branch_id === d.branchId) || (myScore?.managers || [])[0];

  const titles: Record<string, [string, string]> = {
    overview: ['Your Week At A Glance', `How ${branchName} Is Doing Against The Targets You Set.`],
    staff: ['Staff & Counters', 'Who Is On Each Counter Right Now.'],
    services: ['Services', `This Week At ${branchName}, Against Your Wait Target.`],
    readiness: ['Readiness', `See why ${lower(terms.visitor.many)} could not finish, and keep every service checklist current.`],
    sessions: ['Sessions', `A capped day ${lower(terms.visitor.many)} register for in advance, then check in on arrival.`],
    busy: ['Busy Times', 'When To Add A Counter, And When To Train.'],
    targets: ['Targets', 'Your Branch Targets, Within The Company Target.'],
    reports: ['Reports', 'A Preview Of What The Export Will Contain.'],
    settings: ['Settings', 'Branch Details Shown To Customers.'],
    support: ['Help & Support', 'Common Questions For Branch Managers.'],
  };
  const heat = buildHeatmap(d.heatmap);
  // The bell honours this manager's own "Alerts To Me" choices, so turning a
  // threshold up genuinely quietens the feed rather than only being remembered.
  const alerts = useMemo(() => deriveOpsAlerts(preds, d.productivity, {
    prefs: {
      idleAfterMinutes: d.branchSettings?.alerts.idle_after_minutes,
      lineOverTarget: d.branchSettings?.alerts.line_over_target,
    },
  }), [preds, d.productivity, d.branchSettings]);

  /* Everything the ported manager screens read, mapped from the live layer. */
  const liveData = useMemo(() => buildMgrData({
    periodLabel: win.days > 1 ? labelFor(win) : undefined,
    branchName, org, managerName: d.admin?.name || '',
    queues: d.queues as any[], services: d.services as any[], staff: d.staff as any[],
    productivity: d.productivity, counters: d.counters as any[], demandHourly: d.demandHourly as any[], demandWeekly: d.demandWeekly as any[],
    target: d.effectiveTarget, companyTarget: d.targets, branchTarget: d.branchTargets,
    avgWait: achievedWait,
    completionPct: totalToday ? Math.round((completed / totalToday) * 100) : 0,
    noShowPct: totalToday ? +((noShows / totalToday) * 100).toFixed(1) : 0,
    avgService: Math.round(num(last.avg_service_time_minutes)),
    openFrom: timeLabel(d.branchSettings?.hours?.opening_time) || '—',
    openTo: timeLabel(d.branchSettings?.hours?.closing_time) || '—',
    faq: MGR_FAQ,
    servedToday: completed,
    todayByHour: [], yesterdayByHour: [],
    balking: d.balking,
    todayJoined: totalToday, todayCompleted: completed, todayNoShows: noShows,
    todayLeft: num(last.left_count),
  }), [branchName, org, d.admin, d.queues, d.services, d.staff, d.productivity, d.demandHourly,
       d.demandWeekly, d.effectiveTarget, d.targets, d.branchTargets, d.balking,
       achievedWait, completed, totalToday, noShows, last]);

  /* The manager asks; the supervisor acts. Sending lands in the bell of every
     active supervisor at this branch. */
  const [askState, setAskState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [askError, setAskError] = useState<string | null>(null);
  const askSupervisor = useCallback(async (message: string) => {
    setAskState('sending'); setAskError(null);
    try {
      await api.post('/notifications/staff-request', {
        branch_id: d.admin?.staffRecord?.branch_id,
        request_type: 'assignment',
        message,
      });
      setAskState('sent');
    } catch (err) {
      setAskState('error');
      setAskError(err instanceof Error ? err.message : 'Could not reach the supervisor.');
    }
  }, [d.admin]);

  /* A branch manager sets this branch's targets. The tab was read-only and told
     them to ask their executive; the API has always allowed it. */
  const qc = useQueryClient();
  const [tgtState, setTgtState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [tgtError, setTgtError] = useState<string | null>(null);
  const saveBranchTargets = useCallback(async (vals: Record<string, number>) => {
    setTgtState('saving'); setTgtError(null);
    try {
      await api.put('/targets/branch', {
        branch_id: d.admin?.staffRecord?.branch_id,
        target_wait_minutes: Math.round(vals.wait),
        target_completion_rate: Math.round(vals.done),
        target_no_show_rate: Math.round(vals.noshow),
      });
      await qc.invalidateQueries({ queryKey: ['branch-targets'] });
      setTgtState('saved');
    } catch (err) {
      setTgtState('error');
      setTgtError(err instanceof Error ? err.message : 'Could not save these targets.');
    }
  }, [d.admin, qc]);

  /* Settings tab. Saves optimistically-but-honestly: the control moves only
     after the server confirms, so a failed save cannot leave a manager believing
     a policy is in force when it is not. That was the whole complaint about this
     tab — controls that moved and changed nothing. */
  const [setState, setSetState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [setError, setSetError] = useState<string | null>(null);
  const saveBranchSettings = useCallback(async (patch: { allow_overflow?: boolean }) => {
    setSetState('saving'); setSetError(null);
    try {
      await api.put('/settings/branch', {
        branch_id: d.admin?.staffRecord?.branch_id,
        allow_overflow: patch.allow_overflow,
      });
      await qc.invalidateQueries({ queryKey: ['ops-branch-settings'] });
      setSetState('saved');
    } catch (err) {
      setSetState('error');
      setSetError(err instanceof Error ? err.message : 'Could not save this setting.');
    }
  }, [d.admin, qc]);

  const saveAlertPrefs = useCallback(async (patch: { idle_after_minutes?: number | null; line_over_target?: 'on' | 'off' }) => {
    setSetState('saving'); setSetError(null);
    try {
      await api.put('/settings/alerts', {
        // undefined would be dropped by JSON.stringify and read as "unchanged";
        // null is a real value here ("never"), so send the current one explicitly.
        idle_after_minutes: patch.idle_after_minutes === undefined
          ? (d.branchSettings?.alerts.idle_after_minutes ?? null)
          : patch.idle_after_minutes,
        line_over_target: patch.line_over_target ?? d.branchSettings?.alerts.line_over_target ?? 'on',
      });
      await qc.invalidateQueries({ queryKey: ['ops-branch-settings'] });
      setSetState('saved');
    } catch (err) {
      setSetState('error');
      setSetError(err instanceof Error ? err.message : 'Could not save this preference.');
    }
  }, [d.branchSettings, qc]);

  const worstLine = [...liveData.services].sort((a, b) => b.wait - a.wait)[0];

  const notify = useNotifications();

  return (
    <QxShell
      brand="Lyne"
      brandSub={org}
      nav={NAV.map((n) => ({ key: n.key, label: n.label, icon: n.icon, group: n.group === 'utility' ? 'Account' : 'Main' }))}
      active={tab}
      onNav={setTab}
      notifications={notify.unread}
      notify={notify}
      account={{ name: d.admin?.name || 'Manager', role: 'Branch Manager', email: d.admin?.staffRecord.email, onSignOut: logout }}
      search={SEARCHABLE[tab] ? { value: q, onChange: setQ, placeholder: SEARCHABLE[tab] } : undefined}
      context={<><MapPin size={13} /><span>{branchName}</span><b>· {liveData.services.length} Services</b></>}
      railCard={
        <div className="qx-railcard">
          <small>Right Now</small>
          <b>{fmtN(waitingNow)} People Are In Line</b>
          <p>{worstLine ? `${worstLine.name} needs a window opened.` : 'Every line is inside target.'}</p>
          <button type="button" onClick={() => setTab('staff')}>Open Staff & Counters</button>
        </div>
      }
      theme={theme}
      onTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      head={
        <QxHead
          title={tab === 'overview' ? greetingFor(d.admin?.name) : (MGR_TAB_HEAD[tab]?.title ?? titles[tab]?.[0] ?? '')}
          sub={tab === 'overview'
            ? `Here's what's happening on the floor at ${branchName}.`
            : (MGR_TAB_HEAD[tab]?.sub ?? titles[tab]?.[1] ?? '')}
          live={<Freshness at={d.lastUpdatedAt} fetching={d.isFetching} failed={d.hasError} />}
          right={<>
            {/* Only show the period pill on tabs it actually drives.
                  · readiness — has its own Today/Week/Month control
                  · busy      — a 90-day PATTERN by design; one day of data is not
                                a pattern, and the pill sat there implying the
                                heatmap was today's while it never changed
                  · reports   — the report carries its own PERIOD selector, so two
                                controls disagreed on screen (header said Today,
                                the pack said Last 30 Days) */}
            {!['readiness', 'sessions', 'busy', 'reports'].includes(tab) ? <QxPills value={period} onChange={setPeriod}
              options={[['today', 'Today'], ['7', '7 Days'], ['30', '30 Days']]} /> : null}
            {['readiness', 'sessions', 'busy', 'reports'].includes(tab)
              ? <span className="qx-datechip"><CalendarDays size={14} />{todayLabel}</span>
              : <DateWindowChip window={win} onChange={setAnchor} />}
            <button type="button" className="qx-btn ghost" onClick={() => d.refreshAll()}><QxRefresh size={14} />Update</button>
          </>}
        />
      }
    >
      {tour.running ? <Spotlight steps={TOURS.manager} onDone={tour.finish} /> : null}
      <MgrDataProvider value={{ ...liveData, onAskSupervisor: askSupervisor, askState, askError,
        onSaveBranchTargets: saveBranchTargets, targetsSaveState: tgtState, targetsSaveError: tgtError,
        targetsSetBy: d.branchTargets?.set_by_name ?? null, targetsSetAt: d.branchTargets?.updated_at ?? null,
        settings: d.branchSettings, onSaveBranchSettings: saveBranchSettings, onSaveAlertPrefs: saveAlertPrefs,
        settingsSaveState: setState, settingsSaveError: setError }}>
        {tab === 'overview' ? <MgrOverviewQX onNav={setTab} />
          : tab === 'readiness' ? <ManagerReadinessWorkspace businessId={d.businessId} branchId={d.branchId} services={readinessServices.data || []} />
            : tab === 'sessions' ? <SessionsWorkspace businessId={d.businessId} branchId={d.branchId} />
            : mgrTab(tab, setTab)}
      </MgrDataProvider>
    </QxShell>
  );
}

/* ---------- shared sub-cards (used by both dashboards) ---------- */
// Empty now lives in the shared kit; re-exported so existing importers keep working.
export { Empty };
export function initials(name?: string) { const p = (name || 'Q').trim().split(/\s+/); return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'Q'; }
export function Bar({ label, n, accent2 }: { label: string; n: number; accent2?: boolean }) {
  const v = Math.max(0, Math.min(100, n));
  return (<div className="r"><span className="lbl">{label}</span><span className="n">{v}</span><span className="bar"><i style={{ width: `${v}%`, background: accent2 ? 'var(--qa-accent-2)' : 'var(--qa-accent)' }} /></span></div>);
}
export function barPct(actual: number, target: number, lowerBetter: boolean) {
  if (!target) return 60;
  return lowerBetter ? Math.max(0, Math.min(100, (target / Math.max(1, actual)) * 100)) : Math.min(100, (actual / target) * 100);
}
export function scoreFromTargets(last: any, t: any) {
  const total = num(last.total_visitors) || 1;
  const wait = barPct(num(last.avg_wait_time_minutes), num(t.target_wait_minutes), true);
  const comp = num(last.completion_rate) || (num(last.completed_count) / total) * 100;
  const ns = 100 - (num(last.no_show_count) / total) * 100;
  return Math.round((wait * 0.4 + comp * 0.4 + ns * 0.2));
}
export function Field({ label, value }: { label: string; value: string }) {
  return <div className="qa-fld"><label>{label}</label><div className="inp">{value}</div></div>;
}
export function SvcRow({ nm, mini, chg, chgDir, w }: { nm: string; mini?: number[]; chg?: string; chgDir?: 'up' | 'down'; w?: string }) {
  return (
    <div className="qa-svcrow" style={w && !mini ? { gridTemplateColumns: '1fr auto' } : undefined}>
      <span className="nm">{nm}</span>
      {mini ? <span className="mini"><Sparkline values={mini} tone={chgDir === 'down' ? 'neg' : 'accent'} w={82} h={28} /></span> : null}
      {chg ? <span className={`chg ${chgDir || 'up'}`}>{chg}</span> : w ? <span className="qa-num" style={{ color: 'var(--qa-dim)', fontSize: 12, fontWeight: 600 }}>{w}</span> : null}
    </div>
  );
}

export function ServedChart({ summary }: { summary: any[] }) {
  const rows = summary.slice(-7);
  if (!rows.length) return <Empty msg="No daily data yet." />;
  const vals = rows.map((s) => num(s.completed_count));
  const labels = rows.map((s) => new Date(s.summary_date).toLocaleDateString([], { month: 'short', day: 'numeric' }));
  const best = vals.indexOf(Math.max(...vals));
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);   // real reference, not a made-up target
  return (
    <>
      <div className="qa-legend" style={{ marginBottom: 6 }}>
        <span style={{ color: 'var(--qa-accent)' }}><span className="ln" /><span style={{ color: 'var(--qa-dim)' }}>Customers Served</span></span>
        <span><span className="dash" /><span style={{ color: 'var(--qa-dim)' }}>Daily Average · {avg}</span></span>
      </div>
      <div className="qa-chartwrap">
        <Area values={vals} labels={labels} target={avg} targetLabel={`Avg ${avg}`} unitLabel="served"
          marker={{ i: best, label: `${labels[best]} · ${vals[best]} served`, delta: 'Best Day', dir: 'up' }} h={250} />
      </div>
      <div className="qa-cfooter">
        <div><div className="fl">Avg / Day</div><div className="fv qa-num">{avg}</div></div>
        <div><div className="fl">Best Day</div><div className="fv pos qa-num">{Math.max(...vals)}</div></div>
        <div><div className="fl">Period</div><div className="fv qa-num">{rows.length} Days</div></div>
      </div>
    </>
  );
}

export function ChannelMixCard({ data, span }: { data: ChannelMix | null; span: number }) {
  if (!data || !data.total) {
    return <Card span={span} title="Walk-in vs Online" cap="How Customers Reach The Line"><Empty msg="No channel data yet." /></Card>;
  }
  const get = (ch: string) => data.channels.find((c) => c.channel === ch);
  // Only two channels exist in the product; 'unknown' is legacy rows with no
  // channel recorded, never a 'walk-in desk' (see #66).
  const app = get('app'); const kiosk = get('kiosk'); const unknown = get('unknown');
  const legend: Array<[string, typeof app]> = [['Online — the app', app], ['Kiosk — at the branch', kiosk]];
  if (kiosk && kiosk.count) legend.push(['Kiosk — staff-added', kiosk]);
  return (
    <Card span={span} title="Walk-in vs Online" cap="How Customers Reach The Line · Last 90 Days">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{data.self_service_pct}%</span>
        <span className="mini">joined online — the other {fmtN(data.staffed_intake)} were keyed in at the counter</span>
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', margin: '12px 0 10px' }}>
        <i style={{ width: `${app?.pct || 0}%`, background: 'linear-gradient(90deg,var(--qa-accent),var(--qa-accent-2))' }} />
        <i style={{ width: `${kiosk?.pct || 0}%`, background: 'var(--qa-surface-3)' }} />
        {kiosk && kiosk.pct > 0 && <i style={{ width: `${kiosk.pct}%`, background: 'var(--qa-accent-2)' }} />}
      </div>
      {legend.map(([label, c]) => (
        <div key={label} className="qa-svcrow">
          <span className="nm">{label}</span>
          <span className="mini">{c?.avg_wait != null ? `~${c.avg_wait}m wait` : ''}</span>
          <span className="chg up">{c?.pct || 0}%</span>
        </div>
      ))}
    </Card>
  );
}

export function ProductivityCard({ data, span }: { data: ProductivitySignals | null; span: number }) {
  const idle = data?.idle || [];
  const slow = data?.slowdowns || [];
  const has = idle.length + slow.length > 0;
  return (
    <Card span={span} title="Windows Needing Attention" cap="Live · Stalled Stations & Slow Windows During A Rush">
      {has ? (
        <div style={{ display: 'grid', gap: 8 }}>
          {idle.slice(0, 4).map((x, i) => (
            <Rec key={`i${i}`} tone="crit" title={`${x.counter_label} — stalled`}
              body={`${x.staff_name} has called no one for ${x.idle_minutes} min while ${x.waiting} wait for ${x.service_name}. Send someone over or reassign.`} />
          ))}
          {slow.slice(0, 3).map((x, i) => (
            <Rec key={`s${i}`} tone="warn" title={`${x.counter_label} — running slow`}
              body={`Serving ~${Math.round(x.current_avg)} min per customer vs the usual ~${Math.round(x.baseline)} for ${x.service_name}. Check what's holding this window up.`} />
          ))}
        </div>
      ) : <div className="mini" style={{ padding: '6px 2px' }}>Every staffed window is keeping pace with its line.</div>}
    </Card>
  );
}

export function TrafficCard({ services, span }: { services: any[]; span: number }) {
  const rows = [...services].sort((a, b) => num(b.total_visits) - num(a.total_visits)).slice(0, 5);
  const maxV = Math.max(1, ...rows.map((s) => num(s.total_visits)));
  return (
    <Card span={span} title="Traffic By Service" cap="This Week · Busiest First">
      {rows.length ? rows.map((s) => {
        const share = num(s.total_visits) / maxV;   // real share of the busiest service
        return (
          <div key={s.service_id || s.service_name} className="qa-svcrow">
            <span className="nm">{titleCase(s.service_name)}</span>
            <span className="mini" style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ height: 7, width: '100%', borderRadius: 5, background: 'var(--qa-surface-3)', overflow: 'hidden' }}>
                <i style={{ display: 'block', height: '100%', width: `${Math.max(6, share * 100)}%`, background: 'linear-gradient(90deg,var(--qa-accent),var(--qa-accent-2))' }} />
              </span>
            </span>
            <span className="chg up">{fmtN(s.total_visits)}</span>
          </div>
        );
      }) : <Empty msg="No service data yet." />}
    </Card>
  );
}

export function WaitForecastCard({ preds, span }: { preds: any[]; span: number }) {
  const data = insightData(preds, 'wait_time_predictions');
  const hours: any[] = Array.isArray(data?.hours) ? data.hours : [];
  const peak = hours.length ? hours.reduce((a, b) => (num(b.predicted_wait) > num(a.predicted_wait) ? b : a)) : null;
  const vals = hours.map((h) => num(h.predicted_wait));
  return (
    <Card span={span} title="Wait Forecast" cap="Tomorrow, By Hour · From Visit History">
      <div className="qa-spot">
        {peak ? (
          <>
            <div className="price qa-num">{Math.round(num(peak.predicted_wait))} <span style={{ fontSize: 14, color: 'var(--qa-dim)', fontWeight: 700 }}>min at {clockLabel(num(peak.hour))}m</span></div>
            <div className="sub"><span className="qa-delta bad" style={{ fontSize: 11 }}>Peak</span> {String(data?.summary || 'Predicted busiest window')}</div>
            <div className="qa-chartwrap" style={{ marginTop: 8 }}><Area values={vals} color="accent-2" compact sharp h={120} /></div>
          </>
        ) : <Empty msg="No wait forecast yet." />}
      </div>
    </Card>
  );
}

export function DemandCard({ preds, branchId, span }: { preds: any[]; branchId?: string; span: number }) {
  const branches = demandBranches(preds, branchId);
  const byDate = new Map<string, { label: string; expected: number; surge: boolean }>();
  branches.forEach((b) => (b.next_7_days || []).forEach((day: any) => {
    const cur = byDate.get(day.date) || { label: day.dow, expected: 0, surge: false };
    cur.expected += num(day.expected_arrivals);
    cur.surge = cur.surge || Boolean(day.is_month_end) || Boolean(day.is_pre_holiday);
    byDate.set(day.date, cur);
  }));
  const days = [...byDate.entries()].map(([date, v]) => ({ date, ...v }));
  const max = Math.max(1, ...days.map((x) => x.expected));
  return (
    <Card span={span} title="Expected Demand · Next 7 Days" cap="Forecast Arrivals — Schedule & Holiday Aware">
      {days.length ? days.map((day) => (
        <div key={day.date} className="qa-svcrow" style={{ gridTemplateColumns: '1fr 1fr 44px' }}>
          <span className="nm">{day.label} · {new Date(day.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
          <span className="bar" style={{ height: 7, borderRadius: 5, background: 'var(--qa-surface-3)', overflow: 'hidden', alignSelf: 'center' }}>
            <i style={{ display: 'block', height: '100%', width: `${Math.max(8, (day.expected / max) * 100)}%`, background: day.surge ? 'var(--qa-neg)' : 'var(--qa-accent)' }} />
          </span>
          <span className="qa-num" style={{ textAlign: 'right', fontWeight: 800, fontSize: 12.5 }}>{day.expected}</span>
        </div>
      )) : <Empty msg="No demand forecast yet." />}
    </Card>
  );
}

export function StaffingCard({ preds, branchId, span }: { preds: any[]; branchId?: string; span: number }) {
  const data = insightData(preds, 'staffing_recommendation');
  const branches: any[] = Array.isArray(data?.branches) ? data.branches : [];
  const b = (branchId && branches.find((x) => x.branch_id === branchId)) || branches[0];
  const plan: any[] = Array.isArray(b?.hourly_plan) ? b.hourly_plan : [];
  const over = plan.filter((p) => p.over_capacity);
  const peak = plan.length ? plan.reduce((a, c) => (num(c.recommended_counters) > num(a.recommended_counters) ? c : a)) : null;
  return (
    <Card span={span} title="Who's Needed Where" cap="Counters To Open, From Forecast Demand">
      {plan.length ? (
        <>
          {peak ? <Rec tone="crit" icon={<AlertTriangle size={16} />} title={`Peak at ${clockLabel(num(peak.hour))}m needs ${num(peak.recommended_counters)} counters`} body={`Hold waits under ${num(b?.target_wait_minutes) || 20} min; ${over.length} hour(s) are short-staffed.`} /> : null}
          {over.slice(0, 1).map((p) => (
            <Rec key={p.hour} tone="info" icon={<Clock size={16} />} title={`Add a counter at ${clockLabel(num(p.hour))}m`} body={`Demand exceeds the ${num(p.available_counters)} counters available.`} />
          ))}
        </>
      ) : <Empty msg="No staffing plan yet." />}
    </Card>
  );
}

export function ImproveCard({ preds, span }: { preds: any[]; span: number }) {
  const ta = insightData(preds, 'target_attainment');
  const metrics: any[] = Array.isArray(ta?.metrics) ? ta.metrics : [];
  const off = metrics.filter((m) => m.status !== 'on_track');
  const anomalies: any[] = (insightData(preds, 'operational_anomalies')?.anomalies) || [];
  const LABEL: Record<string, string> = { avg_wait_minutes: 'Average Wait', completion_rate_pct: 'Completion Rate', no_show_rate_pct: 'No-Show Rate' };
  return (
    <Card span={span} title="What To Improve" cap="Ranked By Impact On Your Targets">
      {off.length || anomalies.length ? (
        <>
          {off.map((m) => (
            <Rec key={m.metric} tone={m.status === 'off_track' ? 'crit' : 'warn'} icon={<Target size={16} />}
              title={`${LABEL[m.metric] || titleCase(m.metric)} is ${m.status === 'off_track' ? 'off track' : 'at risk'}`}
              body={`Now ${m.current}, projected ${m.projected} against a target of ${m.target}.`}
              target={<>Trend: <b>{titleCase(m.trend)}</b></>} />
          ))}
          {anomalies.slice(0, 2).map((a, i) => (
            <Rec key={`a${i}`} tone="warn" icon={<TrendingUp size={16} />} title={`${titleCase(a.branch_name)} · ${titleCase(a.metric)} broke from the norm`} body={`${a.value} on ${a.date} vs a typical ${a.expected}.`} />
          ))}
        </>
      ) : <Rec tone="info" icon={<Info size={16} />} title="On track across your targets" body="No at-risk metrics or unusual days right now." />}
    </Card>
  );
}

export function TargetsCard({ target, last, completed, total, noShows, span, big, title, cap, goalLabel = 'Company' }: { target: any; last: any; completed: number; total: number; noShows: number; span: number; big?: boolean; title?: string; cap?: string; goalLabel?: string }) {
  const rows = [
    { label: 'Average Wait', actual: Math.round(num(last.avg_wait_time_minutes)), goal: num(target.target_wait_minutes), unit: ' min', lowerBetter: true },
    { label: 'Completed Visits', actual: Math.round(num(last.completion_rate) || (completed / Math.max(1, total)) * 100), goal: num(target.target_completion_rate), unit: '%', lowerBetter: false },
    { label: 'No-Show Rate', actual: Math.round((noShows / Math.max(1, total)) * 100), goal: num(target.target_no_show_rate), unit: '%', lowerBetter: true },
  ];
  return (
    <Card span={span} title={title || 'Your Branch Targets'} cap={cap || 'Set Your Own — Within The Company Target'}>
      {rows.map((r) => {
        const onTrack = r.lowerBetter ? r.actual <= r.goal : r.actual >= r.goal;
        const width = r.lowerBetter ? Math.min(100, (r.goal / Math.max(1, r.actual)) * 100) : Math.min(100, (r.actual / Math.max(1, r.goal)) * 100);
        return (
          <div key={r.label} className="qa-targetrow">
            <span className="tl">{r.label}<small>{goalLabel}: {r.goal}{r.unit}</small></span>
            <span className="qa-tgpill" style={{ background: onTrack ? 'var(--qa-pos-soft)' : 'var(--qa-neg-soft)', color: onTrack ? 'var(--qa-pos)' : 'var(--qa-neg)' }}>{onTrack ? 'On Track' : 'Behind'}</span>
            <div className="qa-tprog"><div className="bar"><i style={{ width: `${width}%`, background: onTrack ? 'var(--qa-accent)' : 'var(--qa-neg)' }} /></div><span className="v">{r.actual}{r.unit} / {r.goal}{r.unit}</span></div>
          </div>
        );
      })}
    </Card>
  );
}

/**
 * Editable company targets (executives only — the API restricts PUT /targets to
 * the executive role). Every branch is measured against whatever is saved here.
 */
export function SetTargetsCard({ target, businessId, span }: { target: any; businessId?: string; span: number }) {
  const qc = useQueryClient();
  const [wait, setWait] = useState('');
  const [done, setDone] = useState('');
  const [noShow, setNoShow] = useState('');
  const [saved, setSaved] = useState(false);

  // Seed the inputs from the saved targets once they load.
  useEffect(() => {
    setWait(String(num(target.target_wait_minutes) || ''));
    setDone(String(num(target.target_completion_rate) || ''));
    setNoShow(String(num(target.target_no_show_rate) || ''));
  }, [target.target_wait_minutes, target.target_completion_rate, target.target_no_show_rate]);

  const save = useMutation({
    mutationFn: () => api.put('/targets', {
      business_id: businessId,
      target_wait_minutes: Number(wait),
      target_completion_rate: Number(done),
      target_no_show_rate: Number(noShow),
    }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['ops-targets', businessId] });
      window.setTimeout(() => setSaved(false), 2600);
    },
  });

  const fields: Array<[string, string, string, string, (v: string) => void, string]> = [
    ['Average wait', 'The longest a customer should wait', 'minutes', wait, setWait, '1'],
    ['Completed visits', 'Share of customers actually served', '%', done, setDone, '1'],
    ['No-show rate', "Share who don't turn up after being called", '%', noShow, setNoShow, '0'],
  ];

  return (
    <Card span={span} title="Set Company Targets" cap="You Set These — Every Branch Works Toward Them">
      {fields.map(([label, hint, unit, val, set, min]) => (
        <div key={label} className="qa-setrow">
          <span className="sl">{label}<small>{hint}</small></span>
          <span className="si">
            <input type="number" min={min} max={unit === '%' ? 100 : 240} value={val}
              onChange={(e) => set(e.target.value)} aria-label={label} />
            <i>{unit}</i>
          </span>
        </div>
      ))}
      <div className="qa-setfoot">
        <button type="button" className="qa-update" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save targets'}
        </button>
        {saved ? <span className="ok">Saved — every branch now works toward these.</span> : null}
        {save.isError ? <span className="bad">Couldn’t save. Check the numbers and try again.</span> : null}
      </div>
    </Card>
  );
}

/**
 * Editable BRANCH targets (managers, for their own branch — the API pins a
 * manager to their branch and lets executives set any branch). These overlay
 * the company target the branch inherits, which is shown inline as the
 * reference so the manager can go tighter or looser with eyes open.
 */
export function SetBranchTargetsCard({ target, branchId, span }: { target: any; branchId?: string; span: number }) {
  const qc = useQueryClient();
  const [wait, setWait] = useState('');
  const [done, setDone] = useState('');
  const [noShow, setNoShow] = useState('');
  const [saved, setSaved] = useState(false);
  const company = target?.company || {};
  const inheriting = target?.is_default !== false; // no branch row yet → inheriting company

  useEffect(() => {
    setWait(String(num(target.target_wait_minutes) || ''));
    setDone(String(num(target.target_completion_rate) || ''));
    setNoShow(String(num(target.target_no_show_rate) || ''));
  }, [target.target_wait_minutes, target.target_completion_rate, target.target_no_show_rate]);

  const save = useMutation({
    mutationFn: () => api.put('/targets/branch', {
      branch_id: branchId,
      target_wait_minutes: Number(wait),
      target_completion_rate: Number(done),
      target_no_show_rate: Number(noShow),
    }),
    onSuccess: () => {
      setSaved(true);
      qc.invalidateQueries({ queryKey: ['ops-branch-targets', branchId] });
      window.setTimeout(() => setSaved(false), 2600);
    },
  });

  const fields: Array<[string, string, string, string, (v: string) => void, string]> = [
    ['Average wait', `Company target: ${num(company.target_wait_minutes)} min`, 'minutes', wait, setWait, '1'],
    ['Completed visits', `Company target: ${num(company.target_completion_rate)}%`, '%', done, setDone, '1'],
    ['No-show rate', `Company target: ${num(company.target_no_show_rate)}%`, '%', noShow, setNoShow, '0'],
  ];

  return (
    <Card span={span} title="Set Your Branch Targets" cap={inheriting ? 'Inheriting The Company Target — Set Your Own To Refine It' : 'Your Branch Works To These, Within The Company Target'}>
      {fields.map(([label, hint, unit, val, set, min]) => (
        <div key={label} className="qa-setrow">
          <span className="sl">{label}<small>{hint}</small></span>
          <span className="si">
            <input type="number" min={min} max={unit === '%' ? 100 : 240} value={val}
              onChange={(e) => set(e.target.value)} aria-label={label} />
            <i>{unit}</i>
          </span>
        </div>
      ))}
      <div className="qa-setfoot">
        <button type="button" className="qa-update" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? 'Saving…' : 'Save branch targets'}
        </button>
        {saved ? <span className="ok">Saved — your branch now works to these.</span> : null}
        {save.isError ? <span className="bad">Couldn’t save. Check the numbers and try again.</span> : null}
      </div>
    </Card>
  );
}

export function TargetTrendCard({ preds, span }: { preds: any[]; span: number }) {
  const ta = insightData(preds, 'target_attainment');
  const wait = (Array.isArray(ta?.metrics) ? ta.metrics : []).find((m: any) => m.metric === 'avg_wait_minutes');
  return (
    <Card span={span} title="Average Wait vs Target" cap="Projected To Your Horizon">
      {wait ? (
        <>
          <div className="qa-spot"><div className="price qa-num">{wait.projected} <span style={{ fontSize: 14, color: 'var(--qa-dim)', fontWeight: 700 }}>min projected</span></div>
            <div className="sub">Now {wait.current} · Target {wait.target} · {titleCase(wait.trend)}</div></div>
          <div className="qa-note" style={{ color: wait.status === 'on_track' ? 'var(--qa-pos)' : 'var(--qa-warn)' }}>
            <Info size={14} />{wait.status === 'on_track' ? 'On track to hit your wait target.' : wait.status === 'at_risk' ? 'At risk — within the confidence band of the target.' : 'Off track — trending away from the target.'}
          </div>
        </>
      ) : <Empty msg="No target projection yet." />}
    </Card>
  );
}

export function ServicesTable({ services, target }: { services: any[]; target: number }) {
  return (
    <Card span={12} title="All Services" cap={`This Week · Against Your ${target} Min Wait Target`}>
      <div className="qa-chartwrap"><table className="qa-dtable">
        <thead><tr><th>Service</th><th className="r">Avg Wait</th><th className="r">Served</th><th className="r">Completed</th><th>vs Target</th></tr></thead>
        <tbody>
          {services.length ? services.map((s: any) => {
            const wait = Math.round(num(s.avg_wait_minutes));
            const state = wait <= target * 0.75 ? ['good', 'Under'] : wait <= target ? ['ok', 'On Target'] : ['over', 'Over'];
            const compRate = s.completed != null && s.total_visits ? Math.round((num(s.completed) / num(s.total_visits)) * 100) : null;
            return (
              <tr key={s.service_id || s.service_name}>
                <td><b>{titleCase(s.service_name)}</b></td>
                <td className="r qa-num">{wait} min</td>
                <td className="r qa-num">{fmtN(s.total_visits)}</td>
                <td className="r qa-num">{compRate != null ? `${compRate}%` : '—'}</td>
                <td><span className={`qa-tgpill ${state[0]}`}>{state[1]}</span></td>
              </tr>
            );
          }) : <tr><td colSpan={5}><Empty msg="No service data yet." /></td></tr>}
        </tbody>
      </table></div>
    </Card>
  );
}

const dayLabel = (d: any) => (d ? new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '—');

/** Plain-language reading of a period — the "so what" under each chart. */
export function periodBlurb(rows: any[], target: any, scope: string) {
  if (!rows.length) return 'No activity recorded for this period yet.';
  const served = rows.reduce((t, s) => t + num(s.total_visitors), 0);
  const done = rows.reduce((t, s) => t + num(s.completed_count), 0);
  const wait = rows.reduce((t, s) => t + num(s.avg_wait_time_minutes), 0) / rows.length;
  const best = rows.reduce((b: any, s: any) => (!b || num(s.total_visitors) > num(b.total_visitors) ? s : b), null);
  const goal = num(target?.target_wait_minutes) || 20;
  const doneP = Math.round((done / Math.max(1, served)) * 100);
  const over = Math.round(wait - goal);
  const waitSentence = over > 0
    ? `the average wait was ${Math.round(wait)} minutes — ${over} above the ${goal}-minute target`
    : `the average wait was ${Math.round(wait)} minutes, inside the ${goal}-minute target`;
  return `${scope} served ${fmtN(served)} customers over ${rows.length} day${rows.length === 1 ? '' : 's'} `
    + `(${fmtN(Math.round(served / rows.length))} a day on average), busiest on ${dayLabel(best?.summary_date)} `
    + `with ${fmtN(num(best?.total_visitors))}. ${doneP}% of visits were completed and ${waitSentence}.`;
}

export function ReportsTab({ summary, last, completed, total, noShows, scope, services = [], target = {}, preds = [], branches = [] }: {
  summary: any[]; last: any; completed: number; total: number; noShows: number; scope: string;
  services?: any[]; target?: any; preds?: any[]; branches?: any[];
}) {
  const served = summary.reduce((t, s) => t + num(s.total_visitors), 0) || total;
  const done = summary.reduce((t, s) => t + num(s.completed_count), 0) || completed;
  const ns = summary.reduce((t, s) => t + num(s.no_show_count), 0) || noShows;
  const from = dayLabel(summary[0]?.summary_date);
  const to = dayLabel(summary[summary.length - 1]?.summary_date);

  const ta = insightData(preds, 'target_attainment');
  const offTrack: any[] = (Array.isArray(ta?.metrics) ? ta.metrics : []).filter((m: any) => m.status !== 'on_track');
  const anomalies: any[] = (insightData(preds, 'operational_anomalies')?.anomalies) || [];
  const LABEL: Record<string, string> = {
    avg_wait_minutes: 'Average wait', completion_rate_pct: 'Completion rate', no_show_rate_pct: 'No-show rate',
  };

  return (
    <div className="qa-grid">
      <ReportDoc
        title={`${scope} Performance Report`}
        subtitle={`${from} – ${to}`}
        meta={`Generated ${new Date().toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })} · Lyne`}
        filename={`Lyne-${scope}-Report-${to.replace(/\s/g, '')}`}
      >
        <ReportSection heading="Summary">
          <ReportKpis items={[
            ['Customers served', fmtN(served)],
            ['Completed', `${fmtN(done)} · ${pct((done / Math.max(1, served)) * 100)}`],
            ['Average wait', `${Math.round(num(last.avg_wait_time_minutes))} min`],
            ['No-shows', `${fmtN(ns)} · ${pct((ns / Math.max(1, served)) * 100)}`],
          ]} />
        </ReportSection>

        <ReportSection heading="Customers served per day" blurb={periodBlurb(summary, target, scope)}>
          <ServedChart summary={summary} />
        </ReportSection>

        {services.length ? (
          <ReportSection
            heading="Service breakdown"
            blurb={`${services.length} services ran in this period. Anything marked over target is where customers waited longest.`}
          >
            <ReportTable
              head={['Service', 'Served', 'Completed', 'Avg wait', 'vs target']}
              rows={services.map((s: any) => {
                const w = Math.round(num(s.avg_wait_minutes));
                const goal = num(target?.target_wait_minutes) || 20;
                return [
                  titleCase(s.service_name), fmtN(num(s.total_visits)),
                  pct((num(s.completed) / Math.max(1, num(s.total_visits))) * 100),
                  `${w} min`, w > goal ? 'Over' : 'On target',
                ];
              })}
            />
          </ReportSection>
        ) : null}

        {branches.length ? (
          <ReportSection heading="Branch breakdown" blurb="Ranked by overall performance score, out of 100.">
            <ReportTable
              head={['Branch', 'Manager', 'Score', 'Avg wait', 'Completion']}
              rows={branches.map((b: any) => [
                titleCase(b.branch_name), titleCase(b.manager_name),
                Math.round(num(b.manager_score)), `${Math.round(num(b.avg_wait_minutes))} min`,
                `${Math.round(num(b.completion_rate))}%`,
              ])}
            />
          </ReportSection>
        ) : null}

        <ReportSection
          heading="What to improve"
          blurb={offTrack.length || anomalies.length
            ? 'Ranked by impact on your targets. Each item is measured against the goals you set.'
            : 'Nothing is off track against your targets for this period.'}
        >
          {offTrack.map((m: any) => (
            <p key={m.metric} className="blurb">
              <b>{LABEL[m.metric] || titleCase(m.metric)} is {m.status === 'off_track' ? 'off track' : 'at risk'}.</b>{' '}
              Now {m.current}, projected {m.projected} against a target of {m.target}. Trend: {titleCase(m.trend)}.
            </p>
          ))}
          {anomalies.slice(0, 3).map((a: any, i: number) => (
            <p key={`a${i}`} className="blurb">
              <b>{titleCase(a.branch_name)} · {titleCase(a.metric)} broke from the norm.</b>{' '}
              {a.value} on {a.date} against a typical {a.expected}.
            </p>
          ))}
          {!offTrack.length && !anomalies.length ? (
            <p className="blurb">No at-risk metrics or unusual days were detected in this period.</p>
          ) : null}
        </ReportSection>
      </ReportDoc>
    </div>
  );
}

export type HelpTopic = { q: string; a: string };

/** Expandable help. Answers describe what the app actually does today —
 *  no topic promises a screen or button that doesn't exist. */
export function SupportTab({ role, topics }: { role: string; topics: HelpTopic[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="qa-grid">
      <Card span={7} title="Help Topics" cap={`Common Questions For ${role} · Tap To Expand`}>
        {topics.map((t, i) => (
          <div key={t.q} className={`qa-faq${open === i ? ' on' : ''}`}>
            <button type="button" className="qa-faqq" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              <span>{t.q}</span><i><ChevronDown size={16} /></i>
            </button>
            {open === i ? <p className="qa-faqa">{t.a}</p> : null}
          </div>
        ))}
      </Card>
      <Card span={5} title="Contact Lyne Support" cap="We Reply Within One Business Day">
        <a className="qa-contact" href="mailto:customersupport@uselyne.com">
          <i><Mail size={16} /></i><span><b>customersupport@uselyne.com</b><small>Email us — best for questions with screenshots</small></span>
        </a>
        <a className="qa-contact" href="tel:+18765550199">
          <i><Phone size={16} /></i><span><b>+1 (876) 555-0199</b><small>Call us — best when a line is down</small></span>
        </a>
        <Field label="Support Hours" value="8am–8pm, Mon–Sat" />
        <div className="qa-note"><Info size={14} />Tell us your branch and what you were doing when it happened — it gets you a fix much faster.</div>
      </Card>
    </div>
  );
}
